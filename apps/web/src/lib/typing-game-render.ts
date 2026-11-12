/**
 * Renderer canvas untuk game "Laskar Kata": langit berbintang berlapis (paralaks), nebula,
 * pesawat vektor buatan sendiri, label kata, laser, ledakan partikel, gelombang kejut, angka skor
 * melayang, dan guncangan layar. Hanya menggambar; semua aturan ada di typing-game.ts.
 */
import type { Enemy, EnemyKind, GameEvent, TypingGame } from './typing-game';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'ring' | 'text' | 'smoke';
  text?: string;
  r?: number;
}

interface Star {
  x: number;
  y: number;
  s: number;
  a: number;
  layer: number;
  tw: number;
}

const ACCENT = '#eab54d';
const INK_LIGHT = '#f3eee4';
const HULL: Record<EnemyKind, { fill: string; edge: string; glow: string }> = {
  scout: { fill: '#e98a98', edge: '#7a2432', glow: '#ff9fb0' },
  fighter: { fill: '#9db8d8', edge: '#2b4a63', glow: '#a8d4ff' },
  heavy: { fill: '#c9b48a', edge: '#5a4a2a', glow: '#ffd27a' },
  boss: { fill: '#c96d4b', edge: '#5b2414', glow: '#ff8a5c' },
  mine: { fill: '#eab54d', edge: '#6f4908', glow: '#ffd27a' },
};
const LAYER_SPEED = [10, 22, 44];
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private nebula?: HTMLCanvasElement;
  private particles: Particle[] = [];
  private shake = 0;
  private redFlash = 0;
  private clock = 0;
  private scale = 1;
  private dpr = 1;
  reducedMotion = false;

  constructor(
    private canvas: HTMLCanvasElement,
    public W: number,
    public H: number,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.seedStars();
  }

  private seedStars() {
    this.stars = [];
    const counts = [80, 50, 26];
    counts.forEach((n, layer) => {
      for (let i = 0; i < n; i++)
        this.stars.push({
          x: Math.random() * this.W,
          y: Math.random() * this.H,
          s: [0.7, 1.2, 1.9][layer] * (0.7 + Math.random() * 0.6),
          a: [0.45, 0.7, 0.95][layer] * (0.6 + Math.random() * 0.4),
          layer,
          tw: Math.random() * Math.PI * 2,
        });
    });
  }

  /** Ukuran dunia baru (misalnya layar sempit) dan ukuran canvas di layar. */
  resize(W: number, H: number, cssW: number, dpr: number) {
    const changed = W !== this.W || H !== this.H;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.scale = cssW / W;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(((cssW * H) / W) * dpr);
    if (changed || !this.nebula) {
      this.seedStars();
      this.nebula = this.makeNebula();
    }
  }

  private makeNebula(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const g = c.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, '#070a17');
    bg.addColorStop(1, '#120c1a');
    g.fillStyle = bg;
    g.fillRect(0, 0, this.W, this.H);
    const blob = (x: number, y: number, r: number, color: string) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, this.W, this.H);
    };
    blob(this.W * 0.18, this.H * 0.28, this.W * 0.42, 'rgba(154,67,34,0.22)');
    blob(this.W * 0.82, this.H * 0.18, this.W * 0.36, 'rgba(50,86,107,0.28)');
    blob(this.W * 0.62, this.H * 0.86, this.W * 0.5, 'rgba(143,94,10,0.16)');
    return c;
  }

  // --- Kejadian -> efek -----------------------------------------------------------------------
  consume(events: readonly GameEvent[], game: TypingGame | null) {
    const many = this.reducedMotion ? 0.4 : 1;
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const p = game?.player;
          if (p)
            this.sparks(
              p.x + Math.cos(p.angle) * 22,
              p.y + Math.sin(p.angle) * 22,
              3,
              ACCENT,
              70,
              160,
            );
          break;
        }
        case 'hit':
          this.sparks(e.x, e.y, Math.round(6 * many), HULL[e.kind].glow, 60, 220);
          break;
        case 'explode': {
          const big =
            e.kind === 'boss' ? 4 : e.kind === 'heavy' ? 1.6 : e.kind === 'mine' ? 0.6 : 1;
          this.sparks(e.x, e.y, Math.round(22 * big * many), HULL[e.kind].glow, 80 * big, 420);
          this.sparks(e.x, e.y, Math.round(10 * big * many), '#ffffff', 60 * big, 300);
          this.smoke(e.x, e.y, Math.round(6 * big * many));
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: 0,
            vy: 0,
            life: 0,
            max: 420 * Math.sqrt(big),
            size: 2,
            color: HULL[e.kind].glow,
            kind: 'ring',
            r: 24 * big,
          });
          if (e.score)
            this.particles.push({
              x: e.x,
              y: e.y - 10,
              vx: 0,
              vy: -38,
              life: 0,
              max: 900,
              size: e.kind === 'boss' ? 26 : 16,
              color: ACCENT,
              kind: 'text',
              text: `+${e.score}`,
            });
          if (e.kind === 'boss') this.shake = Math.max(this.shake, 16);
          else if (e.kind === 'heavy') this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'damage':
          this.sparks(e.x, e.y, Math.round(30 * many), '#ff6b5c', 120, 500);
          this.shake = Math.max(this.shake, 14);
          this.redFlash = 1;
          break;
        case 'emp':
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: 0,
            vy: 0,
            life: 0,
            max: 900,
            size: 4,
            color: '#8fd3ff',
            kind: 'ring',
            r: Math.max(this.W, this.H) * 1.1,
          });
          this.shake = Math.max(this.shake, 8);
          break;
        case 'miss':
          if (game) this.sparks(game.player.x, game.player.y, 4, '#ff6b5c', 40, 160);
          break;
        default:
          break;
      }
    }
  }

  private sparks(x: number, y: number, n: number, color: string, speed: number, life: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0,
        max: life * (0.5 + Math.random() * 0.8),
        size: 1 + Math.random() * 2.2,
        color,
        kind: 'spark',
      });
    }
  }

  private smoke(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * 18,
        vy: Math.sin(a) * 18 - 6,
        life: 0,
        max: 700 + Math.random() * 400,
        size: 8 + Math.random() * 10,
        color: 'rgba(160,150,140,',
        kind: 'smoke',
      });
    }
  }

  // --- Gambar satu frame ----------------------------------------------------------------------
  draw(game: TypingGame | null, dt: number, running: boolean) {
    const ctx = this.ctx;
    const s = dt / 1000;
    this.clock += dt;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);

    // Guncangan layar.
    let ox = 0;
    let oy = 0;
    if (this.shake > 0.2 && !this.reducedMotion) {
      ox = (Math.random() - 0.5) * this.shake;
      oy = (Math.random() - 0.5) * this.shake;
    }
    this.shake *= Math.pow(0.0015, s);

    if (this.nebula) ctx.drawImage(this.nebula, 0, 0, this.W, this.H);
    ctx.save();
    ctx.translate(ox, oy);

    // Bintang berlapis bergerak turun (paralaks); diam saat jeda.
    for (const st of this.stars) {
      if (running) st.y += LAYER_SPEED[st.layer] * s;
      if (st.y > this.H + 2) {
        st.y = -2;
        st.x = Math.random() * this.W;
      }
      const tw = 0.75 + 0.25 * Math.sin(this.clock / 600 + st.tw);
      ctx.globalAlpha = st.a * tw;
      ctx.fillStyle = st.layer === 2 ? '#fff4dc' : '#dfe6ff';
      ctx.fillRect(st.x, st.y, st.s, st.s * (st.layer === 2 && running ? 2.2 : 1));
    }
    ctx.globalAlpha = 1;

    if (game) {
      for (const e of game.enemies) this.drawEnemy(e, game.targetId === e.id);
      this.drawBullets(game);
      this.drawPlayer(game);
      for (const e of game.enemies) this.drawLabel(e, game.targetId === e.id);
    }
    this.drawParticles(running ? dt : 0);
    ctx.restore();

    if (this.redFlash > 0.01) {
      const g = ctx.createRadialGradient(
        this.W / 2,
        this.H / 2,
        this.H * 0.3,
        this.W / 2,
        this.H / 2,
        this.H,
      );
      g.addColorStop(0, 'rgba(255,60,40,0)');
      g.addColorStop(1, `rgba(255,60,40,${0.45 * this.redFlash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
      this.redFlash *= Math.pow(0.02, s);
    }
  }

  private drawPlayer(game: TypingGame) {
    const ctx = this.ctx;
    const p = game.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(1.35, 1.35);
    // Api mesin berkedip.
    const flick = 0.75 + Math.random() * 0.5;
    const fg = ctx.createLinearGradient(-14, 0, -14 - 26 * flick, 0);
    fg.addColorStop(0, 'rgba(255,214,122,0.95)');
    fg.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-14 - 26 * flick, 0);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();
    // Badan pesawat.
    ctx.beginPath();
    const hull: [number, number][] = [
      [24, 0],
      [-4, -9],
      [-14, -18],
      [-9, -4],
      [-15, 0],
      [-9, 4],
      [-14, 18],
      [-4, 9],
    ];
    hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#efe6d4';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#8f5e0a';
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(2, -3.5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(2, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Cincin perisai: satu busur per perisai tersisa.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const on = i < game.shields;
      ctx.strokeStyle = on ? 'rgba(143,211,255,0.55)' : 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      const a0 = Math.PI * 0.95 + (i * Math.PI * 1.1) / 3;
      ctx.arc(0, 0, 40, a0, a0 + (Math.PI * 1.1) / 3 - 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  private path(points: [number, number][]) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }

  private drawEnemy(e: Enemy, targeted: boolean) {
    const ctx = this.ctx;
    const c = HULL[e.kind];
    const fill = e.flash > 0 ? '#ffffff' : c.fill;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.doomed) ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);

    if (e.kind === 'boss') {
      this.drawBoss(e, fill);
      ctx.restore();
      return;
    }
    ctx.scale(1.35, 1.35);
    if (e.kind === 'mine') {
      const spin = this.clock / 300;
      ctx.rotate(spin);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 6 : 11;
        const a = (i / 16) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.fillStyle = Math.sin(this.clock / 120) > 0 ? '#ff5a3c' : '#5a1a10';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (targeted) this.brackets(e);
      return;
    }

    ctx.rotate(e.angle);
    // Cahaya mesin di belakang.
    ctx.fillStyle = c.glow;
    ctx.globalAlpha = 0.5 + Math.random() * 0.3;
    const back = e.kind === 'heavy' ? -23 : e.kind === 'fighter' ? -12 : -9;
    ctx.beginPath();
    ctx.arc(back, 0, e.kind === 'heavy' ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (e.kind === 'scout')
      this.path([
        [15, 0],
        [-10, -10],
        [-5, 0],
        [-10, 10],
      ]);
    else if (e.kind === 'fighter')
      this.path([
        [17, 0],
        [3, -6],
        [-6, -18],
        [-13, -16],
        [-8, 0],
        [-13, 16],
        [-6, 18],
        [3, 6],
      ]);
    else
      this.path([
        [24, 0],
        [13, -15],
        [-12, -19],
        [-23, -9],
        [-23, 9],
        [-12, 19],
        [13, 15],
      ]);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = c.edge;
    ctx.stroke();
    // Detail kokpit dan panel.
    ctx.fillStyle = c.edge;
    if (e.kind === 'heavy') {
      ctx.fillRect(-14, -2, 26, 4);
      ctx.fillRect(-8, -12, 3, 24);
    } else {
      ctx.beginPath();
      ctx.arc(4, 0, e.kind === 'fighter' ? 3 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (targeted) this.brackets(e);
  }

  private drawBoss(e: Enemy, fill: string) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, -24, 0, 24);
    g.addColorStop(0, fill === '#ffffff' ? '#ffffff' : '#e08a64');
    g.addColorStop(1, fill === '#ffffff' ? '#ffffff' : '#6b2a18');
    // Kubah.
    ctx.fillStyle = '#f3d9b8';
    ctx.beginPath();
    ctx.ellipse(0, -12, 26, 20, 0, Math.PI, 0);
    ctx.fill();
    // Piringan.
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 72, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5b2414';
    ctx.stroke();
    // Lampu berkedip berurutan.
    for (let i = 0; i < 9; i++) {
      const on = Math.floor(this.clock / 140) % 9 === i;
      ctx.fillStyle = on ? '#ffe9a8' : '#3a140b';
      ctx.beginPath();
      ctx.arc(-56 + i * 14, 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pancaran bawah.
    ctx.fillStyle = 'rgba(255,138,92,0.35)';
    ctx.beginPath();
    ctx.moveTo(-20, 18);
    ctx.lineTo(20, 18);
    ctx.lineTo(0, 30 + Math.random() * 8);
    ctx.closePath();
    ctx.fill();
    // Sisa nyawa (kata) sebagai titik di atas kubah.
    const left = e.queue.length + 1;
    for (let i = 0; i < left; i++) {
      ctx.fillStyle = ACCENT;
      ctx.fillRect(-((left - 1) * 12) / 2 + i * 12 - 4, -42, 8, 5);
    }
  }

  /** Penanda target terkunci di sekeliling musuh. */
  private brackets(e: Enemy) {
    const ctx = this.ctx;
    const r = e.r + 8;
    const k = 7;
    const pulse = 1 + Math.sin(this.clock / 90) * 0.06;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(sx * r, sy * (r - k));
      ctx.lineTo(sx * r, sy * r);
      ctx.lineTo(sx * (r - k), sy * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLabel(e: Enemy, targeted: boolean) {
    if (e.doomed || e.y < -40) return;
    const ctx = this.ctx;
    ctx.font = `600 ${e.kind === 'boss' ? 18 : 15}px ${MONO}`;
    const done = e.word.slice(0, e.typed);
    const rest = e.word.slice(e.typed);
    const wDone = ctx.measureText(done).width;
    const wRest = ctx.measureText(rest).width;
    const w = wDone + wRest + 14;
    const h = e.kind === 'boss' ? 26 : 22;
    let x = e.x - w / 2;
    x = Math.max(4, Math.min(this.W - w - 4, x));
    const y = e.y + e.r + (e.kind === 'boss' ? 14 : 10);
    ctx.fillStyle = targeted ? 'rgba(40,26,6,0.9)' : 'rgba(8,10,20,0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    if (targeted) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ACCENT;
    ctx.fillText(done, x + 7, y + h / 2 + 1);
    ctx.fillStyle = INK_LIGHT;
    ctx.fillText(rest, x + 7 + wDone, y + h / 2 + 1);
  }

  private drawBullets(game: TypingGame) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of game.bullets) {
      const t = game.enemies.find((e) => e.id === b.target);
      const ang = t ? Math.atan2(t.y - b.y, t.x - b.x) : game.player.angle;
      const tx = b.x - Math.cos(ang) * 22;
      const ty = b.y - Math.sin(ang) * 22;
      ctx.strokeStyle = 'rgba(255,190,90,0.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = '#fff1c8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    const s = dt / 1000;
    ctx.save();
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= Math.pow(0.12, s);
      p.vy *= Math.pow(0.12, s);
      const k = 1 - p.life / p.max;
      if (k <= 0) continue;
      if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `${p.color}${(0.18 * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * k + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.r ?? 30) * (1 - k * k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'text') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.font = `700 ${p.size}px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = p.color;
        ctx.fillText(p.text ?? '', p.x, p.y);
        ctx.textAlign = 'start';
      }
    }
    ctx.restore();
    this.particles = this.particles.filter((p) => p.life < p.max);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }
}
