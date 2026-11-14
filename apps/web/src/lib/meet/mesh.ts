/**
 * Mesh WebRTC: satu RTCPeerConnection ke setiap peserta lain (maksimal 3).
 *
 * Peserta yang baru masuk ("offerer") membuat transceiver audio+video dan mengirim tawaran ke
 * setiap peserta lama; peserta lama memakai transceiver yang terbentuk dari tawaran itu (diubah
 * ke sendrecv) sehingga kedua sisi punya tepat satu transceiver audio dan satu video. Negosiasi
 * ulang (ICE restart) memakai pola "perfect negotiation": bila tawaran bertabrakan, peserta
 * "sopan" (ID lebih besar) mengalah. Ganti kamera/layar/blur cukup dengan replaceTrack.
 */
import type { SignalData } from './signal';

export type PeerConn = 'connecting' | 'connected' | 'failed';

interface Link {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  stream: MediaStream;
}

export interface MeshEvents {
  signal: (to: number, data: SignalData) => void;
  stream: (id: number, stream: MediaStream) => void;
  conn: (id: number, state: PeerConn) => void;
}

/** Batas bitrate video per penerima: makin banyak peserta, makin kecil (upload terbagi). */
export function videoBitrate(peers: number): number {
  return peers <= 1 ? 1_500_000 : peers === 2 ? 900_000 : 600_000;
}

export class Mesh {
  private links = new Map<number, Link>();
  private audio: MediaStreamTrack | null = null;
  private video: MediaStreamTrack | null = null;

  constructor(
    private me: number,
    private ice: RTCIceServer[],
    private on: MeshEvents,
  ) {}

  /** Track yang dikirim ke semua peserta (null = tidak ada). */
  setTracks(audio: MediaStreamTrack | null, video: MediaStreamTrack | null) {
    this.audio = audio;
    this.video = video;
    for (const link of this.links.values()) void this.applyTracks(link);
  }

  private async applyTracks(link: Link) {
    await Promise.all(
      link.pc.getTransceivers().map((t) => {
        if (t.currentDirection === 'stopped') return undefined;
        const track = t.receiver.track.kind === 'audio' ? this.audio : this.video;
        return t.sender.replaceTrack(track).catch(() => undefined);
      }),
    );
  }

  private videoSender(pc: RTCPeerConnection) {
    return pc.getTransceivers().find((t) => t.receiver.track.kind === 'video')?.sender;
  }

  private async limitBitrate() {
    const max = videoBitrate(this.links.size);
    for (const { pc } of this.links.values()) {
      const sender = this.videoSender(pc);
      if (!sender) continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) continue;
      params.encodings[0].maxBitrate = max;
      await sender.setParameters(params).catch(() => undefined);
    }
  }

  /** Siapkan koneksi ke peserta `id`; `offerer` = kita yang memulai (kita peserta baru). */
  add(id: number, offerer: boolean) {
    if (this.links.has(id)) return;
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const link: Link = {
      pc,
      polite: this.me > id,
      makingOffer: false,
      ignoreOffer: false,
      stream: new MediaStream(),
    };
    this.links.set(id, link);
    if (offerer) {
      pc.addTransceiver(this.audio ?? 'audio', { direction: 'sendrecv' });
      pc.addTransceiver(this.video ?? 'video', { direction: 'sendrecv' });
    }

    pc.ontrack = ({ track }) => {
      link.stream.addTrack(track);
      this.on.stream(id, link.stream);
    };
    pc.onicecandidate = ({ candidate }) =>
      this.on.signal(id, { candidate: candidate ? candidate.toJSON() : null });
    pc.onnegotiationneeded = async () => {
      try {
        link.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) this.on.signal(id, { description: pc.localDescription.toJSON() });
      } catch {
        // Akan dicoba lagi pada negosiasi berikutnya.
      } finally {
        link.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        this.on.conn(id, 'connected');
        void this.limitBitrate();
      } else if (s === 'failed') {
        this.on.conn(id, 'failed');
        pc.restartIce();
      } else if (s === 'new' || s === 'connecting') this.on.conn(id, 'connecting');
    };
    this.on.conn(id, 'connecting');
    void this.limitBitrate();
  }

  async signal(from: number, data: SignalData) {
    if (!this.links.has(from)) this.add(from, false);
    const link = this.links.get(from)!;
    const { pc } = link;
    try {
      if ('description' in data) {
        const d = data.description;
        const collision =
          d.type === 'offer' && (link.makingOffer || pc.signalingState !== 'stable');
        link.ignoreOffer = !link.polite && collision;
        if (link.ignoreOffer) return;
        await pc.setRemoteDescription(d);
        if (d.type === 'offer') {
          // Transceiver dari tawaran lawan: ikut mengirim audio/video kita.
          for (const t of pc.getTransceivers()) {
            if (t.direction === 'recvonly') t.direction = 'sendrecv';
          }
          await this.applyTracks(link);
          await pc.setLocalDescription();
          if (pc.localDescription)
            this.on.signal(from, { description: pc.localDescription.toJSON() });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (e) {
          if (!link.ignoreOffer) throw e;
        }
      }
    } catch {
      // Pesan yang datang tidak berurutan dilewati; ICE/negosiasi berikutnya memperbaikinya.
    }
  }

  remove(id: number) {
    const link = this.links.get(id);
    if (!link) return;
    link.pc.close();
    this.links.delete(id);
    void this.limitBitrate();
  }

  close() {
    for (const id of [...this.links.keys()]) this.remove(id);
  }
}
