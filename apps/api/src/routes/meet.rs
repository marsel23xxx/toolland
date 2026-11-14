//! GET /api/tools/v1/meet (WebSocket): signaling Rapat Video. Lihat services/meet.rs.
//!
//! Satu loop per koneksi: pesan masuk diteruskan ke room, pesan untuk koneksi ini dikirim dari
//! antrean, ping tiap 25 detik (Cloudflare memutus WebSocket yang diam 100 detik), dan koneksi
//! ditutup bila tidak ada hello dalam 10 detik, diam 70 detik, atau mengirim terlalu banyak pesan.

use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    time::{Duration, Instant},
};

use axum::{
    extract::{
        ConnectInfo, State,
        ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade},
    },
    http::{Extensions, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use tokio::sync::mpsc;

use crate::{
    services::meet::{self, In, Joined, Out},
    state::AppState,
};

const HELLO_TIMEOUT: Duration = Duration::from_secs(10);
const IDLE_TIMEOUT: Duration = Duration::from_secs(70);
const PING_EVERY: Duration = Duration::from_secs(25);
/// Pesan per detik per koneksi (ICE candidate datang beruntun saat tersambung).
const MAX_PER_SECOND: u32 = 60;
const MAX_MESSAGE: usize = 64 * 1024;

fn client_ip(headers: &HeaderMap, ext: &Extensions) -> IpAddr {
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse().ok())
        .or_else(|| ext.get::<ConnectInfo<SocketAddr>>().map(|c| c.0.ip()))
        .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED))
}

/// Browser selalu mengirim Origin pada WebSocket. Hanya halaman Toolland sendiri (origin sama
/// dengan Host) atau origin di TOOLLAND_MEET_ORIGINS yang boleh memakai signaling ini.
fn origin_ok(headers: &HeaderMap, extra: &[String]) -> bool {
    let Some(origin) = headers.get("origin").and_then(|v| v.to_str().ok()) else {
        // Bukan browser (misalnya tes); tetap kena batas per IP.
        return true;
    };
    let origin = origin.trim_end_matches('/');
    if extra.iter().any(|o| o == origin) {
        return true;
    }
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    origin
        .split_once("://")
        .is_some_and(|(_, rest)| !host.is_empty() && rest.eq_ignore_ascii_case(host))
}

pub async fn handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    ext: Extensions,
    ws: WebSocketUpgrade,
) -> Response {
    super::record("meet", 101, Instant::now());
    if !origin_ok(&headers, &state.cfg.meet_origins) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let ip = client_ip(&headers, &ext);
    ws.max_message_size(MAX_MESSAGE)
        .max_frame_size(MAX_MESSAGE)
        .on_upgrade(move |socket| run(socket, state, ip))
}

async fn close(socket: &mut WebSocket, reason: &'static str) {
    let _ = socket
        .send(Message::Close(Some(CloseFrame {
            code: 4000,
            reason: reason.into(),
        })))
        .await;
}

async fn run(mut socket: WebSocket, state: AppState, ip: IpAddr) {
    let meet = state.meet.clone();
    if !meet.connect(ip) {
        close(&mut socket, "too-many").await;
        return;
    }
    let id = meet.new_id();
    let (tx, mut rx) = mpsc::channel::<Out>(256);
    let mut room: Option<String> = None;
    let started = Instant::now();
    let mut last_seen = Instant::now();
    let mut window = Instant::now();
    let mut count = 0u32;
    let mut ping = tokio::time::interval(PING_EVERY);
    ping.tick().await;
    let mut check = tokio::time::interval(Duration::from_secs(5));

    let reason: &'static str = loop {
        tokio::select! {
            msg = socket.recv() => {
                let Some(Ok(msg)) = msg else { break "" };
                last_seen = Instant::now();
                let text = match msg {
                    Message::Text(t) => t,
                    Message::Close(_) => break "",
                    // Pong/ping dijawab otomatis; biner tidak dipakai.
                    _ => continue,
                };
                if window.elapsed() >= Duration::from_secs(1) {
                    window = Instant::now();
                    count = 0;
                }
                count += 1;
                if count > MAX_PER_SECOND {
                    break "rate";
                }
                let Ok(parsed) = serde_json::from_str::<In>(text.as_str()) else {
                    continue;
                };
                match (&room, parsed) {
                    (None, In::Hello { room: r, name }) => {
                        let (true, Some(name)) = (meet::valid_room(&r), meet::clean_name(&name)) else {
                            break "invalid";
                        };
                        match meet.join(&r, id, name, tx.clone()) {
                            Joined::Refused(why) => break why,
                            Joined::In | Joined::Waiting => room = Some(r),
                        }
                    }
                    (None, _) => break "invalid",
                    (Some(_), In::Ping) => {
                        if socket.send(Message::Text(r#"{"t":"pong"}"#.into())).await.is_err() {
                            break "";
                        }
                    }
                    (Some(_), In::Hello { .. }) => {}
                    (Some(r), other) => meet.handle(r, id, other),
                }
            }
            out = rx.recv() => {
                match out {
                    Some(Out::Text(t)) => {
                        if socket.send(Message::Text(t.into())).await.is_err() {
                            break "";
                        }
                    }
                    Some(Out::Close(why)) => break why,
                    None => break "",
                }
            }
            _ = ping.tick() => {
                if socket.send(Message::Ping(Default::default())).await.is_err() {
                    break "";
                }
            }
            _ = check.tick() => {
                if room.is_none() && started.elapsed() > HELLO_TIMEOUT {
                    break "timeout";
                }
                if last_seen.elapsed() > IDLE_TIMEOUT {
                    break "idle";
                }
            }
        }
    };

    if let Some(r) = &room {
        meet.leave(r, id);
    }
    meet.disconnect(ip);
    if !reason.is_empty() {
        close(&mut socket, reason).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_hanya_dari_situs_sendiri() {
        let h = |origin: &str, host: &str| {
            let mut m = HeaderMap::new();
            m.insert("origin", origin.parse().unwrap());
            m.insert("host", host.parse().unwrap());
            m
        };
        assert!(origin_ok(
            &h("https://julian-marcell.com", "julian-marcell.com"),
            &[]
        ));
        assert!(origin_ok(
            &h("http://localhost:4321", "localhost:4321"),
            &[]
        ));
        assert!(!origin_ok(
            &h("https://jahat.example", "julian-marcell.com"),
            &[]
        ));
        assert!(origin_ok(
            &h("http://localhost:5173", "127.0.0.1:8082"),
            &["http://localhost:5173".into()]
        ));
        assert!(origin_ok(&HeaderMap::new(), &[]));
    }
}
