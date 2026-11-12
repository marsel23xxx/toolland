/**
 * Logika game mengetik luar angkasa "Laskar Kata": pesawat musuh turun membawa kata, setiap huruf
 * yang benar menembakkan laser ke musuh yang sedang dikunci, kata selesai = musuh hancur. Musuh
 * yang menabrak pesawat pemain mengurangi perisai; perisai habis = game selesai.
 *
 * Murni (tanpa DOM): komponen memanggil update(dt) tiap frame dan input(huruf) tiap ketukan, lalu
 * renderer menggambar state dan menghabiskan `events` untuk efek visual dan suara. Koordinat dalam
 * satuan dunia (W x H), waktu dalam milidetik.
 */
import { netWpm, summarize, type Grade, type Keystroke, type Summary } from './typing';

export type EnemyKind = 'scout' | 'fighter' | 'heavy' | 'boss' | 'mine';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  word: string;
  /** Jumlah huruf yang sudah ditembak. */
  typed: number;
  x: number;
  y: number;
  /** Arah hadap (radian) untuk digambar. */
  angle: number;
  speed: number;
  /** Jari-jari tabrakan. */
  r: number;
  /** Bos: kata-kata berikutnya (nyawa). */
  queue: string[];
  /** Kata selesai, menunggu laser terakhir sampai lalu meledak. */
  doomed: boolean;
  doomedAt: number;
  /** Sisa waktu kilatan putih saat terkena (ms). */
  flash: number;
  /** Fase goyangan agar gerak tiap musuh berbeda. */
  phase: number;
  /** Bos: waktu menembakkan ranjau berikutnya. */
  nextMine: number;
}

export interface Bullet {
  x: number;
  y: number;
  target: number;
  /** Laser terakhir sebuah kata: musuh meledak saat laser ini sampai. */
  kill: boolean;
}

export type GameEvent =
  | { type: 'shot'; x: number; y: number }
  | { type: 'hit'; x: number; y: number; kind: EnemyKind }
  | { type: 'explode'; x: number; y: number; kind: EnemyKind; score: number }
  | { type: 'miss' }
  | { type: 'damage'; x: number; y: number; shields: number }
  | { type: 'wave'; wave: number; boss: boolean }
  | { type: 'bossWord'; left: number }
  | { type: 'emp'; x: number; y: number }
  | { type: 'gameover' };

export interface GameOptions {
  W: number;
  H: number;
  words: readonly string[];
  rnd?: () => number;
}

export const SHIELDS = 3;
export const MAX_EMP = 3;
/** Lama jeda antar gelombang (ms), dipakai untuk spanduk "Gelombang n". */
export const WAVE_BREAK = 2200;

const SPEED: Record<EnemyKind, number> = {
  scout: 1.5,
  fighter: 1,
  heavy: 0.62,
  boss: 0,
  mine: 1.85,
};
const RADIUS: Record<EnemyKind, number> = { scout: 19, fighter: 24, heavy: 32, boss: 46, mine: 14 };
const LENGTHS: Record<EnemyKind, [number, number]> = {
  scout: [2, 4],
  fighter: [4, 7],
  heavy: [7, 12],
  boss: [7, 12],
  mine: [2, 3],
};

/** Jumlah musuh biasa di gelombang n. */
export const waveCount = (n: number) => Math.min(26, 4 + 2 * n);
/** Jeda kemunculan musuh (ms). */
export const spawnInterval = (n: number) => Math.max(520, 2000 - 110 * n);
/** Kecepatan dasar (satuan dunia per detik). */
export const baseSpeed = (n: number) => Math.min(72, 26 + 3.2 * n);
export const isBossWave = (n: number) => n % 5 === 0;
/**
 * Waktu aktif mengetik: jeda antar ketukan dihitung maksimal 1,5 detik, sehingga waktu menunggu
 * musuh muncul tidak menurunkan KPM.
 */
export function activeMs(keys: readonly Keystroke[]): number {
  let ms = 0;
  for (let i = 1; i < keys.length; i++) ms += Math.min(1500, keys[i].t - keys[i - 1].t);
  return keys.length ? ms + 300 : 0;
}

/** Nilai game dari gelombang yang dicapai, dibatasi akurasi (sama seperti tes klasik). */
export function gameGrade(wave: number, acc: number): Grade {
  const byWave: Grade =
    wave >= 10 ? 'S' : wave >= 7 ? 'A' : wave >= 5 ? 'B' : wave >= 3 ? 'C' : 'D';
  const cap: Grade = acc < 75 ? 'C' : acc < 85 ? 'B' : acc < 93 ? 'A' : 'S';
  const order: Grade[] = ['D', 'C', 'B', 'A', 'S'];
  return order[Math.min(order.indexOf(byWave), order.indexOf(cap))];
}

/** Pengali skor dari combo huruf benar beruntun. */
export const multiplier = (combo: number) => Math.min(5, 1 + Math.floor(combo / 20));

export class TypingGame {
  readonly W: number;
  readonly H: number;
  readonly player: { x: number; y: number; angle: number };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  events: GameEvent[] = [];
  phase: 'ready' | 'break' | 'play' | 'over' = 'ready';
  wave = 0;
  /** Waktu permainan berjalan (ms, tanpa jeda pause). */
  t = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  shields = SHIELDS;
  emps = 1;
  destroyed = 0;
  targetId: number | null = null;
  keys: Keystroke[] = [];
  correctChars = 0;

  private readonly words: readonly string[];
  private readonly rnd: () => number;
  private nextId = 1;
  private spawnLeft = 0;
  private spawnAt = 0;
  private breakUntil = 0;
  private byLength = new Map<number, string[]>();

  constructor(o: GameOptions) {
    this.W = o.W;
    this.H = o.H;
    this.words = o.words;
    this.rnd = o.rnd ?? Math.random;
    this.player = { x: o.W / 2, y: o.H - 56, angle: -Math.PI / 2 };
    for (const w of o.words) {
      const list = this.byLength.get(w.length) ?? [];
      list.push(w);
      this.byLength.set(w.length, list);
    }
  }

  get target(): Enemy | undefined {
    return this.targetId == null ? undefined : this.enemies.find((e) => e.id === this.targetId);
  }

  get multiplier() {
    return multiplier(this.combo);
  }

  start() {
    if (this.phase !== 'ready') return;
    this.beginWave(1);
  }

  // --- Gelombang dan kemunculan musuh -----------------------------------------------------------
  private beginWave(n: number) {
    this.wave = n;
    this.phase = 'break';
    this.breakUntil = this.t + WAVE_BREAK;
    const boss = isBossWave(n);
    this.spawnLeft = boss ? Math.ceil(waveCount(n) / 2) : waveCount(n);
    this.events.push({ type: 'wave', wave: n, boss });
  }

  /** Kata acak dengan panjang dalam rentang, huruf pertama sebisa mungkin belum dipakai musuh lain. */
  pickWord(min: number, max: number): string {
    const used = new Set(this.enemies.filter((e) => !e.doomed).map((e) => e.word[e.typed] ?? ''));
    const pool: string[] = [];
    for (let len = min; len <= max; len++) pool.push(...(this.byLength.get(len) ?? []));
    const list = pool.length ? pool : [...this.words];
    let w = list[Math.floor(this.rnd() * list.length)];
    for (let i = 0; i < 24 && used.has(w[0]); i++) w = list[Math.floor(this.rnd() * list.length)];
    return w;
  }

  private kindFor(n: number): EnemyKind {
    const scout = Math.max(0.25, 0.48 - 0.02 * n);
    const heavy = Math.min(0.32, 0.04 + 0.028 * n);
    const r = this.rnd();
    return r < scout ? 'scout' : r < scout + heavy ? 'heavy' : 'fighter';
  }

  spawn(kind: EnemyKind, x?: number, y = -30): Enemy {
    const [min, max] = LENGTHS[kind];
    const e: Enemy = {
      id: this.nextId++,
      kind,
      word: this.pickWord(min, max),
      typed: 0,
      x: x ?? 60 + this.rnd() * (this.W - 120),
      y,
      angle: Math.PI / 2,
      speed: baseSpeed(this.wave) * SPEED[kind],
      r: RADIUS[kind],
      queue: [],
      doomed: false,
      doomedAt: 0,
      flash: 0,
      phase: this.rnd() * Math.PI * 2,
      nextMine: this.t + 2500,
    };
    if (kind === 'boss') {
      e.x = this.W / 2;
      e.y = -60;
      e.queue = [this.pickWord(min, max), this.pickWord(min, max)];
    }
    this.enemies.push(e);
    return e;
  }

  // --- Satu langkah simulasi ------------------------------------------------------------------
  update(dt: number) {
    if (this.phase === 'ready' || this.phase === 'over') return;
    dt = Math.min(dt, 60);
    this.t += dt;
    const s = dt / 1000;

    if (this.phase === 'break' && this.t >= this.breakUntil) {
      this.phase = 'play';
      this.spawnAt = this.t;
      if (isBossWave(this.wave)) this.spawn('boss');
    }
    if (this.phase === 'play' && this.spawnLeft > 0 && this.t >= this.spawnAt) {
      this.spawn(this.kindFor(this.wave));
      this.spawnLeft--;
      this.spawnAt = this.t + spawnInterval(this.wave) * (0.7 + this.rnd() * 0.6);
    }

    const p = this.player;
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.doomed) continue;
      if (e.kind === 'boss') {
        // Bos turun ke atas layar lalu bergoyang kiri-kanan sambil melepas ranjau.
        const restY = 92;
        if (e.y < restY) e.y = Math.min(restY, e.y + 40 * s);
        e.x = this.W / 2 + Math.sin(this.t / 1600 + e.phase) * (this.W / 2 - 110);
        e.angle = Math.PI / 2;
        if (this.phase === 'play' && this.t >= e.nextMine && e.y >= restY) {
          this.spawn('mine', e.x, e.y + e.r);
          e.nextMine = this.t + Math.max(1600, 3600 - 120 * this.wave);
        }
        continue;
      }
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let vx = (dx / d) * e.speed;
      const vy = (dy / d) * e.speed;
      // Pengintai meliuk agar lebih sulit ditebak.
      if (e.kind === 'scout') vx += Math.sin(this.t / 420 + e.phase) * 26;
      e.x += vx * s;
      e.y += vy * s;
      e.angle = Math.atan2(vy, vx);
      if (d < e.r + 22) this.crash(e);
    }

    // Laser mengejar target; laser terakhir sebuah kata meledakkan musuh.
    for (const b of this.bullets) {
      const e = this.enemies.find((x) => x.id === b.target);
      if (!e) {
        b.target = -1;
        continue;
      }
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const d = Math.hypot(dx, dy);
      const step = 1500 * s;
      if (d <= step + e.r * 0.4) {
        b.target = -1;
        e.flash = 90;
        this.events.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind });
        if (b.kill && e.doomed) this.explode(e);
      } else {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
      }
    }
    this.bullets = this.bullets.filter((b) => b.target !== -1);
    // Jaga-jaga: musuh yang sudah selesai pasti meledak walau lasernya hilang.
    for (const e of this.enemies) if (e.doomed && this.t - e.doomedAt > 500) this.explode(e);
    this.enemies = this.enemies.filter((e) => e.id > 0);

    const tgt = this.target;
    const aim = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : -Math.PI / 2;
    p.angle += (aim - p.angle) * Math.min(1, s * 14);

    if (this.phase === 'play' && this.spawnLeft === 0 && this.enemies.length === 0)
      this.beginWave(this.wave + 1);
  }

  private explode(e: Enemy) {
    if (e.id < 0) return;
    const base = e.kind === 'boss' ? 500 : e.kind === 'mine' ? 5 : 10 * e.word.length;
    const score = base * this.multiplier;
    this.score += score;
    this.destroyed++;
    if (e.kind === 'boss') this.emps = Math.min(MAX_EMP, this.emps + 1);
    this.events.push({ type: 'explode', x: e.x, y: e.y, kind: e.kind, score });
    if (this.targetId === e.id) this.targetId = null;
    e.id = -e.id;
  }

  private crash(e: Enemy) {
    this.shields--;
    this.combo = 0;
    this.events.push({ type: 'damage', x: e.x, y: e.y, shields: this.shields });
    if (this.targetId === e.id) this.targetId = null;
    e.id = -Math.abs(e.id);
    if (this.shields <= 0) {
      this.phase = 'over';
      this.events.push({ type: 'gameover' });
    }
  }

  // --- Masukan pemain -------------------------------------------------------------------------
  /** Satu huruf diketik. Mengembalikan true bila tepat sasaran. */
  input(ch: string): boolean {
    if (this.phase !== 'play' && this.phase !== 'break') return false;
    const c = ch.toLowerCase();
    if (!/^[a-z]$/.test(c)) return false;
    let e = this.target;
    if (!e) {
      // Kunci musuh terdekat dengan pemain yang hurufnya cocok.
      let best: Enemy | undefined;
      for (const x of this.enemies)
        if (!x.doomed && x.y > -20 && x.word[x.typed] === c && (!best || x.y > best.y)) best = x;
      e = best;
      if (e) this.targetId = e.id;
    }
    const ok = !!e && e.word[e.typed] === c;
    this.keys.push({ t: this.t, ok });
    if (!ok || !e) {
      this.combo = 0;
      this.events.push({ type: 'miss' });
      return false;
    }
    e.typed++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const p = this.player;
    this.events.push({ type: 'shot', x: p.x, y: p.y });
    // Dorongan kecil ke belakang terasa seperti benturan laser.
    if (e.kind !== 'boss') {
      const push = e.kind === 'heavy' ? 2.5 : 5;
      e.x -= Math.cos(e.angle) * push;
      e.y -= Math.sin(e.angle) * push;
    }
    const done = e.typed >= e.word.length;
    this.bullets.push({ x: p.x, y: p.y, target: e.id, kill: done && !e.queue.length });
    if (done) {
      this.correctChars += e.word.length + 1;
      if (e.queue.length) {
        // Bos: lanjut ke kata berikutnya, kunci dilepas agar pemain bisa menembak ranjau.
        e.word = e.queue.shift()!;
        e.typed = 0;
        this.targetId = null;
        this.score += 50 * this.multiplier;
        this.events.push({ type: 'bossWord', left: e.queue.length + 1 });
      } else {
        e.doomed = true;
        e.doomedAt = this.t;
        this.targetId = null;
      }
    }
    return true;
  }

  /** Lepas kunci target (Backspace). Huruf yang sudah tertembak tetap. */
  release() {
    this.targetId = null;
  }

  /** Bom EMP: hancurkan semua musuh biasa di layar. */
  emp(): boolean {
    if (this.phase !== 'play' || this.emps <= 0) return false;
    this.emps--;
    this.events.push({ type: 'emp', x: this.player.x, y: this.player.y });
    for (const e of this.enemies) if (e.kind !== 'boss' && !e.doomed && e.y > -20) this.explode(e);
    this.enemies = this.enemies.filter((e) => e.id > 0);
    return true;
  }

  /** Akhiri permainan (tombol Selesai). */
  quit() {
    if (this.phase === 'over' || this.phase === 'ready') return;
    // Kata yang sudah tuntas tetap dihitung walau lasernya belum sampai.
    for (const e of this.enemies) if (e.doomed) this.explode(e);
    this.enemies = this.enemies.filter((e) => e.id > 0);
    this.phase = 'over';
    this.events.push({ type: 'gameover' });
  }

  /** KPM dari waktu aktif mengetik (untuk HUD dan hasil). */
  get wpm(): number {
    const partial = this.target ? this.target.typed : 0;
    return netWpm(this.correctChars + partial, Math.max(1000, activeMs(this.keys)));
  }

  /** Ringkasan seperti tes klasik, ditambah data khas game. */
  summary(): Summary & { score: number; wave: number; destroyed: number; maxCombo: number } {
    const partial = this.target ? this.target.typed : 0;
    const sum = summarize(this.keys, this.correctChars + partial, Math.max(1000, this.t));
    const active = Math.max(1000, activeMs(this.keys));
    return {
      ...sum,
      wpm: this.wpm,
      raw: netWpm(this.keys.length, active),
      grade: this.keys.length ? gameGrade(this.wave, sum.accuracy) : 'D',
      score: this.score,
      wave: this.wave,
      destroyed: this.destroyed,
      maxCombo: this.maxCombo,
    };
  }
}
