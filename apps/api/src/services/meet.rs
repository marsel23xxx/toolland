//! Rapat Video: server signaling WebRTC untuk room kecil (peer-to-peer, maksimal 4 orang).
//!
//! Video dan suara tidak lewat server ini; server hanya mempertemukan peserta, meneruskan pesan
//! SDP/ICE, chat, dan status mic/kamera di antara peserta room yang sama. Semua room ada di
//! memori dan hilang saat kosong. ID room dikirim di pesan pertama (bukan di URL) supaya tidak
//! masuk log akses. Chat tidak disimpan.
//!
//! Alur: pesan pertama `hello {room, name}`. Room baru: pengirim menjadi host dan langsung
//! masuk. Room yang sudah ada: masuk ruang tunggu (kalau aktif) sampai host menerima, ditolak
//! bila room dikunci atau penuh.

use std::{
    collections::HashMap,
    net::IpAddr,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::mpsc;

/// Peserta aktif maksimal per room (mesh P2P mulai berat di atas ini).
pub const MAX_PEERS: usize = 4;
/// Antrean ruang tunggu maksimal per room.
pub const MAX_WAITING: usize = 8;
/// Umur maksimal room.
pub const MAX_ROOM_AGE: Duration = Duration::from_secs(12 * 3600);
const MAX_CHAT: usize = 1000;
const MAX_NAME: usize = 40;

/// Pesan ke satu koneksi: teks JSON, atau perintah menutup koneksi dengan alasan.
#[derive(Debug)]
pub enum Out {
    Text(String),
    Close(&'static str),
}

pub type Tx = mpsc::Sender<Out>;

/// Pesan dari klien.
#[derive(Debug, Deserialize)]
#[serde(tag = "t", rename_all = "kebab-case")]
pub enum In {
    Hello { room: String, name: String },
    Signal { to: u64, data: Value },
    Chat { text: String },
    State { mic: bool, cam: bool, screen: bool },
    Admit { id: u64 },
    Deny { id: u64 },
    Kick { id: u64 },
    Lock { on: bool },
    Lobby { on: bool },
    Ping,
}

#[derive(Debug, Serialize, Clone)]
pub struct PeerInfo {
    pub id: u64,
    pub name: String,
}

struct Peer {
    id: u64,
    name: String,
    tx: Tx,
}

struct Room {
    host: u64,
    locked: bool,
    lobby: bool,
    peers: Vec<Peer>,
    waiting: Vec<Peer>,
    created: Instant,
}

impl Room {
    fn find(&self, id: u64) -> Option<&Peer> {
        self.peers.iter().find(|p| p.id == id)
    }
    fn broadcast(&self, msg: &str, except: Option<u64>) {
        for p in &self.peers {
            if Some(p.id) != except {
                send(&p.tx, msg);
            }
        }
    }
    fn room_state(&self) -> String {
        serde_json::json!({"t": "room", "locked": self.locked, "lobby": self.lobby}).to_string()
    }
}

fn send(tx: &Tx, msg: &str) {
    // Penerima lambat (antrean penuh) dilewati; koneksinya akan putus sendiri.
    let _ = tx.try_send(Out::Text(msg.to_owned()));
}

/// Hasil hello.
#[derive(Debug, PartialEq, Eq)]
pub enum Joined {
    /// Langsung masuk room.
    In,
    /// Menunggu persetujuan host.
    Waiting,
    /// Ditolak dengan alasan (room-full, locked, waiting-full, busy).
    Refused(&'static str),
}

pub struct Meet {
    rooms: Mutex<HashMap<String, Room>>,
    next_id: AtomicU64,
    max_rooms: usize,
    /// Konfigurasi ICE (STUN, nanti TURN) dalam JSON, dikirim ke klien saat masuk.
    ice: Value,
    per_ip: Mutex<HashMap<IpAddr, usize>>,
    max_per_ip: usize,
}

/// ID room: 8-32 huruf kecil, angka, atau tanda hubung.
pub fn valid_room(id: &str) -> bool {
    (8..=32).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// Nama tampilan: tanpa karakter kontrol, dipangkas, maksimal 40 karakter.
pub fn clean_name(name: &str) -> Option<String> {
    let s: String = name
        .chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let s: String = s.chars().take(MAX_NAME).collect();
    (!s.is_empty()).then_some(s)
}

impl Meet {
    pub fn new(max_rooms: usize, max_per_ip: usize, ice: Value) -> Self {
        Self {
            rooms: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            max_rooms,
            ice,
            per_ip: Mutex::new(HashMap::new()),
            max_per_ip,
        }
    }

    /// Catat koneksi baru dari satu IP; false bila sudah terlalu banyak.
    pub fn connect(&self, ip: IpAddr) -> bool {
        let mut map = self.per_ip.lock().unwrap();
        let n = map.entry(ip).or_insert(0);
        if *n >= self.max_per_ip {
            return false;
        }
        *n += 1;
        true
    }

    pub fn disconnect(&self, ip: IpAddr) {
        let mut map = self.per_ip.lock().unwrap();
        if let Some(n) = map.get_mut(&ip) {
            *n -= 1;
            if *n == 0 {
                map.remove(&ip);
            }
        }
    }

    pub fn new_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    pub fn room_count(&self) -> usize {
        self.rooms.lock().unwrap().len()
    }

    fn welcome(&self, room: &Room, id: u64) -> String {
        let peers: Vec<PeerInfo> = room
            .peers
            .iter()
            .filter(|p| p.id != id)
            .map(|p| PeerInfo {
                id: p.id,
                name: p.name.clone(),
            })
            .collect();
        serde_json::json!({
            "t": "welcome",
            "you": id,
            "host": room.host,
            "locked": room.locked,
            "lobby": room.lobby,
            "peers": peers,
            "ice": self.ice,
        })
        .to_string()
    }

    /// Masuk ke room (hello). Mengirim welcome/waiting/knock lewat channel masing-masing.
    pub fn join(&self, room_id: &str, id: u64, name: String, tx: Tx) -> Joined {
        let mut rooms = self.rooms.lock().unwrap();
        let Some(room) = rooms.get_mut(room_id) else {
            if rooms.len() >= self.max_rooms {
                return Joined::Refused("busy");
            }
            let room = Room {
                host: id,
                locked: false,
                lobby: true,
                peers: vec![Peer { id, name, tx }],
                waiting: Vec::new(),
                created: Instant::now(),
            };
            send(&room.peers[0].tx, &self.welcome(&room, id));
            rooms.insert(room_id.to_owned(), room);
            return Joined::In;
        };
        if room.locked {
            return Joined::Refused("locked");
        }
        if room.peers.len() >= MAX_PEERS {
            return Joined::Refused("room-full");
        }
        if room.lobby {
            if room.waiting.len() >= MAX_WAITING {
                return Joined::Refused("waiting-full");
            }
            let knock = serde_json::json!({"t": "knock", "id": id, "name": name}).to_string();
            if let Some(h) = room.find(room.host) {
                send(&h.tx, &knock);
            }
            send(&tx, r#"{"t":"waiting"}"#);
            room.waiting.push(Peer { id, name, tx });
            return Joined::Waiting;
        }
        Self::admit_peer(self, room, Peer { id, name, tx });
        Joined::In
    }

    fn admit_peer(&self, room: &mut Room, peer: Peer) {
        let join =
            serde_json::json!({"t": "peer-join", "id": peer.id, "name": peer.name}).to_string();
        room.broadcast(&join, None);
        let id = peer.id;
        let tx = peer.tx.clone();
        room.peers.push(peer);
        send(&tx, &self.welcome(room, id));
    }

    /// Pesan dari peserta yang sudah ada di room atau ruang tunggu.
    pub fn handle(&self, room_id: &str, from: u64, msg: In) {
        let mut rooms = self.rooms.lock().unwrap();
        let Some(room) = rooms.get_mut(room_id) else {
            return;
        };
        // Orang di ruang tunggu tidak boleh mengirim apa pun selain ping.
        let Some(me) = room.find(from) else {
            return;
        };
        let is_host = room.host == from;
        match msg {
            In::Signal { to, data } => {
                if let Some(p) = room.find(to) {
                    let m = serde_json::json!({"t": "signal", "from": from, "data": data});
                    send(&p.tx, &m.to_string());
                }
            }
            In::Chat { text } => {
                let text: String = text.chars().take(MAX_CHAT).collect();
                if text.trim().is_empty() {
                    return;
                }
                let m =
                    serde_json::json!({"t": "chat", "from": from, "name": me.name, "text": text});
                room.broadcast(&m.to_string(), None);
            }
            In::State { mic, cam, screen } => {
                let m = serde_json::json!({"t": "state", "from": from, "mic": mic, "cam": cam, "screen": screen});
                room.broadcast(&m.to_string(), Some(from));
            }
            In::Admit { id } if is_host => {
                if room.peers.len() >= MAX_PEERS {
                    return;
                }
                if let Some(i) = room.waiting.iter().position(|p| p.id == id) {
                    let peer = room.waiting.remove(i);
                    self.admit_peer(room, peer);
                    let m = serde_json::json!({"t": "knock-cancel", "id": id}).to_string();
                    send(&room.find(room.host).unwrap().tx, &m);
                }
            }
            In::Deny { id } if is_host => {
                if let Some(i) = room.waiting.iter().position(|p| p.id == id) {
                    let peer = room.waiting.remove(i);
                    let _ = peer.tx.try_send(Out::Close("denied"));
                }
            }
            In::Kick { id } if is_host && id != from => {
                if let Some(i) = room.peers.iter().position(|p| p.id == id) {
                    let peer = room.peers.remove(i);
                    let _ = peer.tx.try_send(Out::Close("kicked"));
                    let m = serde_json::json!({"t": "peer-leave", "id": id}).to_string();
                    room.broadcast(&m, None);
                }
            }
            In::Lock { on } if is_host => {
                room.locked = on;
                room.broadcast(&room.room_state(), None);
            }
            In::Lobby { on } if is_host => {
                room.lobby = on;
                // Ruang tunggu dimatikan: semua yang menunggu langsung masuk (selama muat).
                if !on {
                    while !room.waiting.is_empty() && room.peers.len() < MAX_PEERS {
                        let peer = room.waiting.remove(0);
                        self.admit_peer(room, peer);
                    }
                }
                room.broadcast(&room.room_state(), None);
            }
            _ => {}
        }
    }

    /// Peserta keluar (koneksi putus). Host pindah ke peserta berikutnya; room tanpa peserta
    /// aktif ditutup, termasuk yang masih menunggu.
    pub fn leave(&self, room_id: &str, id: u64) {
        let mut rooms = self.rooms.lock().unwrap();
        let Some(room) = rooms.get_mut(room_id) else {
            return;
        };
        if let Some(i) = room.waiting.iter().position(|p| p.id == id) {
            room.waiting.remove(i);
            if let Some(h) = room.find(room.host) {
                send(
                    &h.tx,
                    &serde_json::json!({"t": "knock-cancel", "id": id}).to_string(),
                );
            }
            return;
        }
        let Some(i) = room.peers.iter().position(|p| p.id == id) else {
            return;
        };
        room.peers.remove(i);
        if room.peers.is_empty() {
            for w in room.waiting.drain(..) {
                let _ = w.tx.try_send(Out::Close("ended"));
            }
            rooms.remove(room_id);
            return;
        }
        room.broadcast(
            &serde_json::json!({"t": "peer-leave", "id": id}).to_string(),
            None,
        );
        if room.host == id {
            room.host = room.peers[0].id;
            room.broadcast(
                &serde_json::json!({"t": "host", "id": room.host}).to_string(),
                None,
            );
            // Host baru perlu tahu siapa saja yang sedang menunggu.
            for w in &room.waiting {
                let m = serde_json::json!({"t": "knock", "id": w.id, "name": w.name}).to_string();
                send(&room.peers[0].tx, &m);
            }
        }
    }

    /// Tutup room yang sudah melewati umur maksimal.
    pub fn sweep(&self) {
        let mut rooms = self.rooms.lock().unwrap();
        rooms.retain(|_, r| {
            let alive = r.created.elapsed() < MAX_ROOM_AGE;
            if !alive {
                for p in r.peers.iter().chain(r.waiting.iter()) {
                    let _ = p.tx.try_send(Out::Close("expired"));
                }
            }
            alive
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn peer(meet: &Meet) -> (u64, Tx, mpsc::Receiver<Out>) {
        let (tx, rx) = mpsc::channel(32);
        (meet.new_id(), tx, rx)
    }

    fn drain(rx: &mut mpsc::Receiver<Out>) -> Vec<Value> {
        let mut out = Vec::new();
        while let Ok(m) = rx.try_recv() {
            match m {
                Out::Text(s) => out.push(serde_json::from_str(&s).unwrap()),
                Out::Close(r) => out.push(serde_json::json!({"t": "close", "reason": r})),
            }
        }
        out
    }
    fn types(v: &[Value]) -> Vec<String> {
        v.iter()
            .map(|m| m["t"].as_str().unwrap().to_owned())
            .collect()
    }

    fn meet() -> Meet {
        Meet::new(
            10,
            3,
            serde_json::json!([{"urls": "stun:stun.example:3478"}]),
        )
    }

    #[test]
    fn nama_dan_id_room() {
        assert!(valid_room("abcd-1234"));
        assert!(!valid_room("ABCD1234"));
        assert!(!valid_room("pendek"));
        assert!(!valid_room("ada spasi1"));
        assert_eq!(
            clean_name("  Budi\n  Santoso\u{0} ").as_deref(),
            Some("Budi Santoso")
        );
        assert_eq!(clean_name(" \t "), None);
        assert_eq!(clean_name(&"x".repeat(80)).unwrap().len(), MAX_NAME);
    }

    #[test]
    fn host_ruang_tunggu_terima_dan_signal() {
        let m = meet();
        let (a, ta, mut ra) = peer(&m);
        assert_eq!(m.join("room-uji-1", a, "Ana".into(), ta), Joined::In);
        let w = drain(&mut ra);
        assert_eq!(w[0]["t"], "welcome");
        assert_eq!(w[0]["host"], a);
        assert_eq!(w[0]["ice"][0]["urls"], "stun:stun.example:3478");

        let (b, tb, mut rb) = peer(&m);
        assert_eq!(m.join("room-uji-1", b, "Budi".into(), tb), Joined::Waiting);
        assert_eq!(types(&drain(&mut rb)), ["waiting"]);
        let knock = drain(&mut ra);
        assert_eq!(knock[0]["t"], "knock");
        assert_eq!(knock[0]["name"], "Budi");

        // Peserta yang menunggu tidak bisa mengirim signal atau mengakui diri.
        m.handle("room-uji-1", b, In::Admit { id: b });
        m.handle(
            "room-uji-1",
            b,
            In::Signal {
                to: a,
                data: Value::Null,
            },
        );
        assert!(drain(&mut ra).is_empty());

        m.handle("room-uji-1", a, In::Admit { id: b });
        assert_eq!(types(&drain(&mut ra)), ["peer-join", "knock-cancel"]);
        let wb = drain(&mut rb);
        assert_eq!(wb[0]["t"], "welcome");
        assert_eq!(wb[0]["peers"][0]["id"], a);

        m.handle(
            "room-uji-1",
            b,
            In::Signal {
                to: a,
                data: serde_json::json!({"sdp": "x"}),
            },
        );
        let s = drain(&mut ra);
        assert_eq!(s[0]["from"], b);
        assert_eq!(s[0]["data"]["sdp"], "x");
    }

    #[test]
    fn kunci_penuh_tolak_keluarkan_dan_host_pindah() {
        let m = meet();
        let (a, ta, mut ra) = peer(&m);
        m.join("room-uji-2", a, "Ana".into(), ta);
        m.handle("room-uji-2", a, In::Lobby { on: false });
        let mut rx = Vec::new();
        let mut ids = Vec::new();
        for n in 0..3 {
            let (id, tx, r) = peer(&m);
            assert_eq!(m.join("room-uji-2", id, format!("P{n}"), tx), Joined::In);
            rx.push(r);
            ids.push(id);
        }
        let (e, te, _re) = peer(&m);
        assert_eq!(
            m.join("room-uji-2", e, "Eko".into(), te),
            Joined::Refused("room-full")
        );

        // Bukan host tidak bisa mengeluarkan orang.
        m.handle("room-uji-2", ids[0], In::Kick { id: ids[1] });
        assert!(!types(&drain(&mut rx[1])).contains(&"close".to_owned()));
        m.handle("room-uji-2", a, In::Kick { id: ids[1] });
        assert_eq!(drain(&mut rx[1]).last().unwrap()["reason"], "kicked");

        m.handle("room-uji-2", a, In::Lock { on: true });
        let (f, tf, _rf) = peer(&m);
        assert_eq!(
            m.join("room-uji-2", f, "Fani".into(), tf),
            Joined::Refused("locked")
        );

        drain(&mut ra);
        drain(&mut rx[0]);
        m.leave("room-uji-2", a);
        let got = drain(&mut rx[0]);
        assert_eq!(types(&got), ["peer-leave", "host"]);
        assert_eq!(got[1]["id"], ids[0]);
        m.leave("room-uji-2", ids[0]);
        m.leave("room-uji-2", ids[2]);
        assert_eq!(m.room_count(), 0);
    }

    #[test]
    fn host_keluar_saat_ada_yang_menunggu_menutup_room() {
        let m = meet();
        let (a, ta, _ra) = peer(&m);
        m.join("room-uji-3", a, "Ana".into(), ta);
        let (b, tb, mut rb) = peer(&m);
        m.join("room-uji-3", b, "Budi".into(), tb);
        m.handle("room-uji-3", a, In::Deny { id: b });
        assert_eq!(drain(&mut rb).last().unwrap()["reason"], "denied");
        let (c, tc, mut rc) = peer(&m);
        m.join("room-uji-3", c, "Citra".into(), tc);
        m.leave("room-uji-3", a);
        assert_eq!(drain(&mut rc).last().unwrap()["reason"], "ended");
        assert_eq!(m.room_count(), 0);
    }

    #[test]
    fn batas_koneksi_per_ip_dan_jumlah_room() {
        let m = Meet::new(1, 2, Value::Null);
        let ip: IpAddr = "203.0.113.9".parse().unwrap();
        assert!(m.connect(ip) && m.connect(ip));
        assert!(!m.connect(ip));
        m.disconnect(ip);
        assert!(m.connect(ip));
        let (a, ta, _ra) = peer(&m);
        m.join("room-uji-4", a, "Ana".into(), ta);
        let (b, tb, _rb) = peer(&m);
        assert_eq!(
            m.join("room-uji-5", b, "Budi".into(), tb),
            Joined::Refused("busy")
        );
    }

    #[test]
    fn chat_dipotong_dan_kosong_diabaikan() {
        let m = meet();
        let (a, ta, mut ra) = peer(&m);
        m.join("room-uji-6", a, "Ana".into(), ta);
        drain(&mut ra);
        m.handle("room-uji-6", a, In::Chat { text: "   ".into() });
        assert!(drain(&mut ra).is_empty());
        m.handle(
            "room-uji-6",
            a,
            In::Chat {
                text: "y".repeat(5000),
            },
        );
        let c = drain(&mut ra);
        assert_eq!(c[0]["text"].as_str().unwrap().len(), MAX_CHAT);
        assert_eq!(c[0]["name"], "Ana");
    }
}
