/**
 * Klien signaling Rapat Video (WebSocket ke /api/tools/v1/meet). Server hanya mempertemukan
 * peserta dan meneruskan pesan; video tidak lewat server. Lihat apps/api/src/services/meet.rs.
 */

export interface PeerInfo {
  id: number;
  name: string;
}

/** Pesan dari server. */
export type ServerMsg =
  | {
      t: 'welcome';
      you: number;
      host: number;
      locked: boolean;
      lobby: boolean;
      peers: PeerInfo[];
      ice: RTCIceServer[];
    }
  | { t: 'waiting' }
  | { t: 'knock'; id: number; name: string }
  | { t: 'knock-cancel'; id: number }
  | { t: 'peer-join'; id: number; name: string }
  | { t: 'peer-leave'; id: number }
  | { t: 'host'; id: number }
  | { t: 'room'; locked: boolean; lobby: boolean }
  | { t: 'signal'; from: number; data: SignalData }
  | { t: 'chat'; from: number; name: string; text: string }
  | { t: 'state'; from: number; mic: boolean; cam: boolean; screen: boolean }
  | { t: 'pong' };

export type SignalData =
  { description: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit | null };

/** Pesan ke server. */
export type ClientMsg =
  | { t: 'hello'; room: string; name: string }
  | { t: 'signal'; to: number; data: SignalData }
  | { t: 'chat'; text: string }
  | { t: 'state'; mic: boolean; cam: boolean; screen: boolean }
  | { t: 'admit' | 'deny' | 'kick'; id: number }
  | { t: 'lock' | 'lobby'; on: boolean }
  | { t: 'ping' };

/**
 * Alasan koneksi ditutup: dari server (denied, kicked, locked, room-full, waiting-full, busy,
 * ended, expired, too-many, rate, invalid, timeout, idle) atau "network" bila putus sendiri.
 */
export type CloseReason = string;

export const ROOM_RE = /^[a-z0-9-]{8,32}$/;

/** ID room acak seperti "abc-defg-hij" (10 huruf/angka, sekitar 51 bit). */
export function newRoomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const s = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
}

/** Ambil ID room dari teks yang ditempel: link lengkap, "#r=...", atau ID saja. */
export function parseRoom(input: string): string | null {
  const s = input.trim().toLowerCase();
  const m = /[#&?]r=([a-z0-9-]+)/.exec(s) ?? /^([a-z0-9-]+)$/.exec(s);
  return m && ROOM_RE.test(m[1]) ? m[1] : null;
}

export class Signal {
  private ws: WebSocket;
  private ping: ReturnType<typeof setInterval> | undefined;
  private closed = false;

  constructor(
    url: string,
    hello: { room: string; name: string },
    private onMessage: (m: ServerMsg) => void,
    private onClose: (reason: CloseReason) => void,
  ) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.send({ t: 'hello', ...hello });
      this.ping = setInterval(() => this.send({ t: 'ping' }), 20_000);
    };
    this.ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        // Pesan rusak diabaikan.
      }
    };
    this.ws.onclose = (e) => {
      clearInterval(this.ping);
      if (this.closed) return;
      this.closed = true;
      this.onClose(e.code === 4000 && e.reason ? e.reason : 'network');
    };
  }

  send(m: ClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /** Keluar atas kemauan sendiri (tanpa memanggil onClose). */
  close() {
    this.closed = true;
    clearInterval(this.ping);
    this.ws.close(1000);
  }
}

/** URL WebSocket signaling di domain yang sama dengan halaman. */
export function signalUrl(loc: Location = location): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/api/tools/v1/meet`;
}
