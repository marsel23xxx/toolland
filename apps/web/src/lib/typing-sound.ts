/**
 * Efek suara game mengetik, disintesis dengan Web Audio (tanpa file audio). AudioContext baru
 * dibuat pada ketukan pertama karena browser menolak memutar suara sebelum ada interaksi.
 */
import type { GameEvent } from './typing-game';

export class GameSound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  muted = false;

  private ensure(): AudioContext | undefined {
    if (this.muted) return undefined;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return undefined;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    vol: number,
    delay = 0,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, cutoff: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  /** Bunyikan efek untuk satu kejadian game. */
  play(e: GameEvent) {
    switch (e.type) {
      case 'shot':
        this.tone('square', 1320, 520, 0.07, 0.05);
        break;
      case 'miss':
        this.tone('triangle', 180, 120, 0.09, 0.12);
        break;
      case 'explode':
        this.burst(
          e.kind === 'boss' ? 1.1 : e.kind === 'heavy' ? 0.5 : 0.32,
          e.kind === 'boss' ? 0.9 : 0.45,
          e.kind === 'boss' ? 2400 : 3200,
        );
        break;
      case 'damage':
        this.burst(0.45, 0.8, 900);
        this.tone('sawtooth', 160, 50, 0.4, 0.15);
        break;
      case 'bossWord':
        this.tone('square', 220, 440, 0.18, 0.08);
        break;
      case 'emp':
        this.tone('sine', 90, 900, 0.5, 0.25);
        this.burst(0.7, 0.5, 5000);
        break;
      case 'wave':
        [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.09, i * 0.09));
        break;
      case 'gameover':
        [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.32, 0.12, i * 0.22));
        break;
    }
  }

  close() {
    void this.ctx?.close();
    this.ctx = undefined;
  }
}
