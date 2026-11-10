/**
 * Sistem desain template PPT: palet warna, tiga gaya (Geometris Berani, Minimal Elegan, Gradien
 * Modern), dan tata letak slide yang dipakai bersama semua template. Tiap gaya punya cover,
 * pembatas bagian, penutup, bingkai slide isi, dan gaya kartu sendiri.
 */
import type { DocAssets } from '../docs/form';
import { SLIDE, type El, type Fill, type Slide, type TextEl, type TextPara } from './model';

export type StyleId = 'geo' | 'minimal' | 'gradient';
export const STYLE_IDS: StyleId[] = ['geo', 'minimal', 'gradient'];

export interface Palette {
  id: string;
  name: { id: string; en: string };
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
  light: string;
}

export const PALETTES: Palette[] = [
  {
    id: 'nila',
    name: { id: 'Biru samudra', en: 'Ocean blue' },
    primary: '1f3a5f',
    secondary: '3a7ca5',
    accent: 'f2a541',
    dark: '13243b',
    light: 'eef3f8',
  },
  {
    id: 'daun',
    name: { id: 'Hijau daun', en: 'Leaf green' },
    primary: '2f5d3a',
    secondary: '6a994e',
    accent: 'f4b942',
    dark: '1a3321',
    light: 'eff5ed',
  },
  {
    id: 'terakota',
    name: { id: 'Terakota', en: 'Terracotta' },
    primary: '9a3f24',
    secondary: 'd17a4f',
    accent: '2f6f73',
    dark: '3a1a10',
    light: 'fbf1ea',
  },
  {
    id: 'ungu',
    name: { id: 'Ungu senja', en: 'Dusk violet' },
    primary: '4b2e83',
    secondary: '8b5fbf',
    accent: 'ff8a5b',
    dark: '25163f',
    light: 'f3eefb',
  },
  {
    id: 'arang',
    name: { id: 'Hitam & oranye', en: 'Charcoal & orange' },
    primary: '1f1f1f',
    secondary: '4a4a4a',
    accent: 'ff5a1f',
    dark: '111111',
    light: 'f4f3f1',
  },
];

export const STYLE_NAMES: Record<StyleId, { id: string; en: string }> = {
  geo: { id: 'Geometris Berani', en: 'Bold Geometric' },
  minimal: { id: 'Minimal Elegan', en: 'Elegant Minimal' },
  gradient: { id: 'Gradien Modern', en: 'Modern Gradient' },
};

/** Campur warna hex a ke b sebanyak t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a, 16);
  const pb = parseInt(b, 16);
  return [16, 8, 0]
    .map((s) => {
      const x = (pa >> s) & 255;
      const y = (pb >> s) & 255;
      return Math.round(x + (y - x) * t)
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Asset = DocAssets[string];

const para = (text: string, o: Partial<TextPara> & { b?: boolean; i?: boolean } = {}): TextPara => {
  const { b, i, ...rest } = o;
  return { runs: [{ text, b, i }], ...rest };
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');

const BODY: Box = { x: 64, y: 150, w: 832, h: 330 };

/** Perkiraan kasar tinggi teks (untuk menentukan tinggi kartu; teks tetap dijaga muat oleh fit). */
function estimate(text: string, size: number, width: number, lead = 1.3) {
  const perLine = Math.max(8, width / (size * 0.5));
  return Math.max(1, Math.ceil(text.length / perLine)) * size * lead;
}

export class Deck {
  readonly slides: Slide[] = [];
  readonly p: Palette;
  readonly grad: Fill;
  private n = 0;

  constructor(
    readonly style: StyleId,
    palette: Palette,
    readonly footer = '',
  ) {
    this.p = palette;
    this.grad = {
      grad: {
        angle: 35,
        stops: [
          [palette.primary, 0],
          [palette.secondary, 1],
        ],
      },
    };
  }

  // --- Elemen dasar ----------------------------------------------------------------------------
  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: Fill,
    extra: Partial<Extract<El, { t: 'shape' }>> = {},
  ): El {
    return { t: 'shape', geom: 'rect', x, y, w, h, fill, ...extra };
  }
  round(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: Fill,
    line?: { color: string; w: number; opacity?: number },
  ): El {
    return { t: 'shape', geom: 'round', x, y, w, h, r, fill, line };
  }
  circle(
    x: number,
    y: number,
    d: number,
    fill?: Fill,
    line?: { color: string; w: number; opacity?: number },
  ): El {
    return { t: 'shape', geom: 'ellipse', x, y, w: d, h: d, fill, line };
  }
  poly(x: number, y: number, w: number, h: number, pts: [number, number][], fill: Fill): El {
    return { t: 'shape', geom: 'poly', x, y, w, h, pts, fill };
  }
  text(
    b: Box,
    paras: TextPara[] | string,
    size: number,
    color: string,
    o: Partial<TextEl> = {},
  ): TextEl {
    return {
      t: 'text',
      ...b,
      paras: typeof paras === 'string' ? [para(paras)] : paras,
      size,
      color,
      fit: true,
      ...o,
    };
  }
  img(
    b: Box,
    a: Asset,
    mode: 'cover' | 'contain' = 'cover',
    shape: 'rect' | 'round' | 'ellipse' = 'rect',
    r = 0,
  ): El {
    return { t: 'img', ...b, data: a.data, type: a.type, iw: a.w, ih: a.h, mode, shape, r };
  }

  get ink() {
    return this.style === 'minimal' ? '2b2b2b' : this.p.dark;
  }
  get body() {
    return this.style === 'minimal' ? '555555' : '3f3f46';
  }
  get tint() {
    return mix(this.p.primary, 'ffffff', 0.9);
  }

  // --- Bingkai slide isi -------------------------------------------------------------------------
  /** Slide isi baru: latar, hiasan, judul, dan nomor halaman sesuai gaya. */
  frame(title: string, eyebrow = ''): { els: El[]; body: Box } {
    this.n++;
    const p = this.p;
    const els: El[] = [];
    let bg: Fill;
    const num = String(this.slides.length + 1).padStart(2, '0');
    if (this.style === 'geo') {
      bg = { color: 'ffffff' };
      els.push(
        this.rect(0, 0, 14, SLIDE.h, { color: p.primary }),
        this.poly(
          790,
          0,
          170,
          118,
          [
            [0.3, 0],
            [1, 0],
            [1, 1],
          ],
          { color: p.primary },
        ),
        this.poly(
          872,
          0,
          88,
          62,
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          { color: p.accent },
        ),
        this.poly(
          0,
          470,
          70,
          70,
          [
            [0, 0],
            [1, 1],
            [0, 1],
          ],
          { color: p.accent, opacity: 0.9 },
        ),
      );
      if (eyebrow)
        els.push(
          this.text(
            { x: 64, y: 36, w: 640, h: 18 },
            [para(eyebrow.toUpperCase(), { b: true })],
            11,
            p.accent,
            { track: 1.5, fit: false },
          ),
        );
      els.push(
        this.text({ x: 64, y: 56, w: 700, h: 52 }, [para(title, { b: true })], 30, p.dark, {
          valign: 'b',
        }),
        this.rect(64, 116, 56, 5, { color: p.accent }),
        this.circle(886, 486, 38, { color: p.dark }),
        this.text(
          { x: 886, y: 486, w: 38, h: 38 },
          [para(num, { b: true, align: 'c' })],
          11,
          'ffffff',
          { valign: 'm', fit: false },
        ),
      );
    } else if (this.style === 'minimal') {
      bg = { color: mix(p.light, 'ffffff', 0.55) };
      els.push(
        this.circle(872, 26, 52, { color: mix(p.primary, 'ffffff', 0.86) }),
        this.circle(906, 64, 14, { color: p.accent }),
      );
      if (eyebrow)
        els.push(
          this.rect(64, 46, 26, 1.5, { color: p.accent }),
          this.text(
            { x: 100, y: 38, w: 600, h: 16 },
            [para(eyebrow.toUpperCase(), { b: true })],
            9.5,
            p.primary,
            { track: 2, fit: false },
          ),
        );
      els.push(
        this.text({ x: 64, y: 58, w: 760, h: 64 }, [para(title)], 32, this.ink, { valign: 'b' }),
        this.rect(64, 500, 832, 0.75, { color: 'd8d4cb' }),
        this.text({ x: 64, y: 507, w: 600, h: 16 }, this.footer, 9, '8a8478', { fit: false }),
        this.text({ x: 796, y: 507, w: 100, h: 16 }, [para(num, { align: 'r' })], 9, '8a8478', {
          fit: false,
        }),
      );
    } else {
      bg = { color: mix(p.primary, 'ffffff', 0.945) };
      els.push(
        this.circle(700, -170, 430, { ...this.grad, opacity: 0.14 }),
        this.circle(-110, 420, 250, { color: p.accent, opacity: 0.12 }),
      );
      if (eyebrow) {
        const w = Math.min(420, eyebrow.length * 7 + 30);
        els.push(
          this.round(64, 34, w, 22, 11, this.grad),
          this.text(
            { x: 64, y: 34, w, h: 22 },
            [para(eyebrow.toUpperCase(), { b: true, align: 'c' })],
            9,
            'ffffff',
            { valign: 'm', track: 1, fit: false },
          ),
        );
      }
      els.push(
        this.text({ x: 64, y: 62, w: 740, h: 58 }, [para(title, { b: true })], 30, p.dark, {
          valign: 'b',
        }),
        this.round(
          860,
          492,
          60,
          24,
          12,
          { color: 'ffffff' },
          { color: mix(p.primary, 'ffffff', 0.8), w: 0.75 },
        ),
        this.text(
          { x: 860, y: 492, w: 60, h: 24 },
          [para(num, { b: true, align: 'c' })],
          10,
          p.primary,
          { valign: 'm', fit: false },
        ),
      );
    }
    this.slides.push({ bg, els });
    return { els, body: { ...BODY } };
  }

  /** Kartu berlatar sesuai gaya; mengembalikan kotak isi di dalamnya. */
  card(els: El[], b: Box): Box {
    const p = this.p;
    if (this.style === 'geo') {
      els.push(
        this.rect(b.x, b.y, b.w, b.h, { color: mix(p.primary, 'ffffff', 0.93) }),
        this.rect(b.x, b.y, 6, b.h, { color: p.primary }),
      );
      return { x: b.x + 20, y: b.y + 16, w: b.w - 34, h: b.h - 30 };
    }
    if (this.style === 'minimal') {
      els.push(this.rect(b.x, b.y, b.w, 2, { color: p.primary }));
      return { x: b.x, y: b.y + 16, w: b.w, h: b.h - 18 };
    }
    els.push(
      this.round(
        b.x,
        b.y,
        b.w,
        b.h,
        14,
        { color: 'ffffff' },
        { color: mix(p.primary, 'ffffff', 0.82), w: 0.75 },
      ),
    );
    return { x: b.x + 18, y: b.y + 16, w: b.w - 36, h: b.h - 30 };
  }

  /** Lencana nomor sesuai gaya. */
  badge(els: El[], x: number, y: number, n: number | string, d = 34) {
    const p = this.p;
    const label = typeof n === 'number' ? String(n).padStart(2, '0') : n;
    if (this.style === 'geo') els.push(this.rect(x, y, d, d, { color: p.primary }));
    else if (this.style === 'gradient') els.push(this.circle(x, y, d, this.grad));
    else {
      els.push(
        this.text({ x, y, w: d * 1.6, h: d }, [para(label)], d * 0.62, p.primary, {
          valign: 'm',
          fit: false,
        }),
      );
      return;
    }
    els.push(
      this.text({ x, y, w: d, h: d }, [para(label, { b: true, align: 'c' })], d * 0.36, 'ffffff', {
        valign: 'm',
        fit: false,
      }),
    );
  }

  // --- Slide khusus gaya: cover, pembatas, penutup ---------------------------------------------
  cover(o: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    meta?: string[];
    logo?: Asset;
    photo?: Asset;
  }) {
    const p = this.p;
    const els: El[] = [];
    let bg: Fill;
    const meta = (o.meta ?? []).filter(Boolean).map((m, i) => para(m, { b: i === 0, after: 2 }));
    if (this.style === 'geo') {
      bg = { color: 'ffffff' };
      els.push(
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0, 0],
            [0.62, 0],
            [0.49, 1],
            [0, 1],
          ],
          { color: p.primary },
        ),
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0.62, 0],
            [0.665, 0],
            [0.535, 1],
            [0.49, 1],
          ],
          { color: p.accent },
        ),
        this.poly(
          0,
          330,
          210,
          210,
          [
            [0, 0],
            [1, 1],
            [0, 1],
          ],
          { color: p.dark, opacity: 0.35 },
        ),
        this.circle(690, 250, 360, { color: p.light }),
        this.circle(820, 40, 110, undefined, { color: p.accent, w: 3 }),
        this.circle(900, 210, 22, { color: p.accent }),
        this.circle(640, 450, 14, { color: p.primary }),
      );
      if (o.photo)
        els.push(this.img({ x: 640, y: 120, w: 280, h: 280 }, o.photo, 'cover', 'ellipse'));
      else if (o.logo) els.push(this.img({ x: 700, y: 170, w: 200, h: 200 }, o.logo, 'contain'));
      if (o.eyebrow)
        els.push(
          this.text(
            { x: 60, y: 96, w: 460, h: 20 },
            [para(o.eyebrow.toUpperCase(), { b: true })],
            11,
            p.accent,
            { track: 2, fit: false },
          ),
        );
      els.push(
        this.text(
          { x: 60, y: 122, w: 470, h: 200 },
          [para(o.title, { b: true, lead: 1.08 })],
          42,
          'ffffff',
          { valign: 'b' },
        ),
        this.rect(60, 336, 70, 6, { color: p.accent }),
      );
      if (o.subtitle)
        els.push(
          this.text(
            { x: 60, y: 352, w: 440, h: 56 },
            o.subtitle,
            15,
            mix('ffffff', p.primary, 0.15),
          ),
        );
      if (meta.length)
        els.push(this.text({ x: 60, y: 420, w: 400, h: 90 }, meta, 12, 'ffffff', { valign: 'b' }));
    } else if (this.style === 'minimal') {
      bg = { color: mix(p.light, 'ffffff', 0.55) };
      els.push(
        this.circle(560, 40, 460, { color: mix(p.primary, 'ffffff', 0.87) }),
        this.circle(830, 380, 110, { color: p.accent }),
        this.circle(560, 60, 40, undefined, { color: p.primary, w: 1 }),
        this.rect(64, 140, 1.5, 260, { color: p.primary }),
      );
      if (o.photo)
        els.push(this.img({ x: 600, y: 80, w: 380, h: 380 }, o.photo, 'cover', 'ellipse'));
      else if (o.logo) els.push(this.img({ x: 660, y: 160, w: 260, h: 220 }, o.logo, 'contain'));
      if (o.eyebrow)
        els.push(
          this.text(
            { x: 86, y: 140, w: 440, h: 16 },
            [para(o.eyebrow.toUpperCase(), { b: true })],
            10,
            p.primary,
            { track: 2.5, fit: false },
          ),
        );
      els.push(
        this.text({ x: 86, y: 162, w: 470, h: 180 }, [para(o.title, { lead: 1.1 })], 44, this.ink, {
          valign: 't',
        }),
      );
      if (o.subtitle)
        els.push(this.text({ x: 86, y: 346, w: 440, h: 50 }, o.subtitle, 15, '5a5a5a'));
      if (meta.length)
        els.push(
          this.text({ x: 86, y: 410, w: 420, h: 90 }, meta, 11.5, '5a5a5a', { valign: 'b' }),
        );
    } else {
      bg = {
        grad: {
          angle: 35,
          stops: [
            [p.primary, 0],
            [p.secondary, 1],
          ],
        },
      };
      els.push(
        this.circle(600, -140, 500, { color: 'ffffff', opacity: 0.08 }),
        this.circle(720, 250, 380, undefined, { color: 'ffffff', w: 2, opacity: 0.35 }),
        this.circle(-90, 380, 280, { color: 'ffffff', opacity: 0.07 }),
        this.circle(870, 110, 44, { color: p.accent }),
      );
      if (o.photo)
        els.push(this.img({ x: 640, y: 120, w: 290, h: 290 }, o.photo, 'cover', 'ellipse'));
      else if (o.logo)
        els.push(
          this.circle(650, 130, 270, { color: 'ffffff', opacity: 0.95 }),
          this.img({ x: 690, y: 170, w: 190, h: 190 }, o.logo, 'contain'),
        );
      if (o.eyebrow) {
        const w = Math.min(400, o.eyebrow.length * 7.5 + 34);
        els.push(
          this.round(64, 104, w, 26, 13, { color: 'ffffff', opacity: 0.18 }),
          this.text(
            { x: 64, y: 104, w, h: 26 },
            [para(o.eyebrow.toUpperCase(), { b: true, align: 'c' })],
            10,
            'ffffff',
            { valign: 'm', track: 1.5, fit: false },
          ),
        );
      }
      els.push(
        this.text(
          { x: 64, y: 140, w: 520, h: 190 },
          [para(o.title, { b: true, lead: 1.08 })],
          44,
          'ffffff',
          { valign: 'b' },
        ),
      );
      if (o.subtitle)
        els.push(
          this.text(
            { x: 64, y: 340, w: 500, h: 50 },
            o.subtitle,
            15,
            mix('ffffff', p.primary, 0.12),
          ),
        );
      if (meta.length)
        els.push(
          this.round(64, 404, 440, 96, 16, { color: 'ffffff', opacity: 0.14 }),
          this.text({ x: 64, y: 404, w: 440, h: 96 }, meta, 11.5, 'ffffff', {
            valign: 'm',
            pad: 16,
          }),
        );
    }
    this.slides.push({ bg, els });
  }

  section(o: { number: number; title: string; subtitle?: string }) {
    const p = this.p;
    const els: El[] = [];
    let bg: Fill;
    const num = String(o.number).padStart(2, '0');
    if (this.style === 'geo') {
      bg = { color: p.primary };
      els.push(
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0.62, 0],
            [1, 0],
            [1, 1],
            [0.48, 1],
          ],
          { color: p.dark, opacity: 0.45 },
        ),
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0.58, 0],
            [0.62, 0],
            [0.48, 1],
            [0.44, 1],
          ],
          { color: p.accent },
        ),
        this.text({ x: 70, y: 110, w: 360, h: 170 }, [para(num, { b: true })], 130, p.accent, {
          valign: 'b',
          fit: false,
        }),
        this.text(
          { x: 70, y: 290, w: 400, h: 110 },
          [para(o.title, { b: true, lead: 1.1 })],
          40,
          'ffffff',
        ),
      );
      if (o.subtitle)
        els.push(
          this.text(
            { x: 70, y: 404, w: 360, h: 60 },
            o.subtitle,
            15,
            mix('ffffff', p.primary, 0.2),
          ),
        );
    } else if (this.style === 'minimal') {
      bg = { color: mix(p.primary, 'ffffff', 0.9) };
      els.push(
        this.circle(640, 120, 300, { color: mix(p.primary, 'ffffff', 0.78) }),
        this.circle(830, 330, 70, { color: p.accent }),
        this.text(
          { x: 64, y: 90, w: 400, h: 190 },
          [para(num)],
          150,
          mix(p.primary, 'ffffff', 0.45),
          { valign: 'b', fit: false },
        ),
        this.text({ x: 64, y: 290, w: 560, h: 110 }, [para(o.title, { lead: 1.1 })], 40, this.ink),
        this.rect(64, 408, 60, 2, { color: p.accent }),
      );
      if (o.subtitle)
        els.push(this.text({ x: 64, y: 420, w: 520, h: 60 }, o.subtitle, 14, '5a5a5a'));
    } else {
      bg = {
        grad: {
          angle: 35,
          stops: [
            [p.primary, 0],
            [p.secondary, 1],
          ],
        },
      };
      els.push(
        this.circle(560, 60, 440, undefined, { color: 'ffffff', w: 2, opacity: 0.3 }),
        this.circle(640, 140, 280, { color: 'ffffff', opacity: 0.08 }),
        this.circle(850, 400, 50, { color: p.accent }),
        this.text(
          { x: 64, y: 90, w: 400, h: 190 },
          [para(num, { b: true })],
          140,
          mix('ffffff', p.secondary, 0.4),
          { valign: 'b', fit: false },
        ),
        this.text(
          { x: 64, y: 290, w: 560, h: 110 },
          [para(o.title, { b: true, lead: 1.1 })],
          40,
          'ffffff',
        ),
      );
      if (o.subtitle)
        els.push(
          this.text(
            { x: 64, y: 404, w: 500, h: 60 },
            o.subtitle,
            15,
            mix('ffffff', p.primary, 0.12),
          ),
        );
    }
    this.slides.push({ bg, els });
  }

  closing(o: { title: string; subtitle?: string; lines?: string[]; logo?: Asset }) {
    const p = this.p;
    const els: El[] = [];
    let bg: Fill;
    const lines = (o.lines ?? []).filter(Boolean).map((l) => para(l, { after: 3 }));
    if (this.style === 'geo') {
      bg = { color: 'ffffff' };
      els.push(
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0.42, 0],
            [1, 0],
            [1, 1],
            [0.55, 1],
          ],
          { color: p.primary },
        ),
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0.375, 0],
            [0.42, 0],
            [0.55, 1],
            [0.505, 1],
          ],
          { color: p.accent },
        ),
        this.circle(-60, -60, 180, { color: p.light }),
        this.circle(860, 420, 160, undefined, { color: p.accent, w: 3 }),
        this.text(
          { x: 60, y: 150, w: 360, h: 150 },
          [para(o.title, { b: true, lead: 1.05 })],
          52,
          p.dark,
          { valign: 'b' },
        ),
        this.rect(60, 314, 70, 6, { color: p.accent }),
      );
      if (o.subtitle)
        els.push(this.text({ x: 60, y: 332, w: 330, h: 70 }, o.subtitle, 15, this.body));
      if (o.logo) els.push(this.img({ x: 640, y: 170, w: 200, h: 200 }, o.logo, 'contain'));
      if (lines.length)
        els.push(
          this.text(
            { x: o.logo ? 600 : 580, y: o.logo ? 390 : 200, w: 320, h: o.logo ? 110 : 200 },
            lines,
            13,
            'ffffff',
            { valign: o.logo ? 't' : 'm' },
          ),
        );
    } else if (this.style === 'minimal') {
      bg = { color: mix(p.light, 'ffffff', 0.55) };
      els.push(
        this.circle(330, 20, 300, { color: mix(p.primary, 'ffffff', 0.88) }),
        this.circle(600, 220, 60, { color: p.accent }),
        this.text(
          { x: 80, y: 150, w: 800, h: 100 },
          [para(o.title, { align: 'c' })],
          56,
          this.ink,
          { valign: 'm' },
        ),
        this.rect(450, 262, 60, 2, { color: p.accent }),
      );
      if (o.subtitle)
        els.push(
          this.text(
            { x: 160, y: 278, w: 640, h: 50 },
            [para(o.subtitle, { align: 'c' })],
            15,
            '5a5a5a',
          ),
        );
      if (lines.length)
        els.push(
          this.text(
            { x: 160, y: 340, w: 640, h: 120 },
            lines.map((l) => ({ ...l, align: 'c' as const })),
            12,
            '5a5a5a',
          ),
        );
    } else {
      bg = {
        grad: {
          angle: 35,
          stops: [
            [p.primary, 0],
            [p.secondary, 1],
          ],
        },
      };
      els.push(
        this.circle(-120, -160, 460, { color: 'ffffff', opacity: 0.08 }),
        this.circle(700, 260, 360, undefined, { color: 'ffffff', w: 2, opacity: 0.3 }),
        this.circle(160, 400, 40, { color: p.accent }),
        this.text(
          { x: 80, y: 130, w: 800, h: 100 },
          [para(o.title, { b: true, align: 'c' })],
          56,
          'ffffff',
          { valign: 'm' },
        ),
      );
      if (o.subtitle)
        els.push(
          this.text(
            { x: 160, y: 236, w: 640, h: 50 },
            [para(o.subtitle, { align: 'c' })],
            15,
            mix('ffffff', p.primary, 0.12),
          ),
        );
      if (lines.length)
        els.push(
          this.round(240, 310, 480, 140, 18, { color: 'ffffff', opacity: 0.14 }),
          this.text(
            { x: 240, y: 310, w: 480, h: 140 },
            lines.map((l) => ({ ...l, align: 'c' as const })),
            12.5,
            'ffffff',
            { valign: 'm', pad: 18 },
          ),
        );
    }
    this.slides.push({ bg, els });
  }

  // --- Tata letak isi --------------------------------------------------------------------------
  /** Daftar poin, dengan kotak sorotan opsional di kanan. */
  bullets(o: {
    title: string;
    eyebrow?: string;
    intro?: string;
    items: string[];
    callout?: { value?: string; text: string };
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.filter(Boolean);
    if (!o.callout && !o.intro && items.length && items.length <= 6) {
      this.rows(els, b, items);
      return;
    }
    const w = o.callout ? 520 : b.w;
    const paras: TextPara[] = [];
    if (o.intro) paras.push(para(o.intro, { after: 12, color: this.body }));
    for (const it of o.items.filter(Boolean))
      paras.push(para(it, { bullet: 'dot', after: 10, lead: 1.25 }));
    els.push(this.text({ x: b.x, y: b.y, w, h: b.h }, paras, 19, this.ink));
    if (o.callout) {
      const c = this.card(els, { x: b.x + 552, y: b.y, w: b.w - 552, h: b.h });
      const cp: TextPara[] = [];
      if (o.callout.value)
        cp.push(
          para(o.callout.value, { b: true, size: 44, color: this.p.primary, after: 8, lead: 1 }),
        );
      cp.push(para(o.callout.text, { lead: 1.3 }));
      els.push(this.text(c, cp, 15, this.body, { valign: 'm' }));
    }
  }

  /** Poin sebagai baris: penanda, garis pemisah, atau kartu per baris sesuai gaya. */
  private rows(els: El[], b: Box, items: string[]) {
    const p = this.p;
    const n = items.length;
    const gap = this.style === 'gradient' ? 12 : 0;
    const h = Math.min(80, (b.h - gap * (n - 1)) / n);
    items.forEach((it, i) => {
      const y = b.y + i * (h + gap);
      let tx = b.x + 44;
      if (this.style === 'geo') {
        els.push(this.rect(b.x, y + h / 2 - 14, 28, 28, { color: i % 2 ? p.accent : p.primary }));
        els.push(
          this.text(
            { x: b.x, y: y + h / 2 - 14, w: 28, h: 28 },
            [para(String(i + 1), { b: true, align: 'c' })],
            12,
            'ffffff',
            { valign: 'm', fit: false },
          ),
        );
        if (i < n - 1)
          els.push(this.rect(b.x + 44, y + h - 0.5, b.w - 44, 0.75, { color: 'e3e5ea' }));
      } else if (this.style === 'minimal') {
        els.push(
          this.text(
            { x: b.x, y, w: 40, h },
            [para(String(i + 1).padStart(2, '0'))],
            15,
            p.primary,
            { valign: 'm', fit: false },
          ),
        );
        els.push(this.rect(b.x, y + h - 0.5, b.w, 0.75, { color: 'd8d4cb' }));
      } else {
        els.push(
          this.round(
            b.x,
            y,
            b.w,
            h,
            12,
            { color: 'ffffff' },
            { color: mix(p.primary, 'ffffff', 0.82), w: 0.75 },
          ),
        );
        els.push(this.circle(b.x + 16, y + h / 2 - 9, 18, this.grad));
        tx = b.x + 50;
      }
      els.push(
        this.text(
          { x: tx, y, w: b.x + b.w - tx - 12, h },
          [para(it, { lead: 1.25 })],
          18,
          this.ink,
          { valign: 'm' },
        ),
      );
    });
  }

  twoCol(o: {
    title: string;
    eyebrow?: string;
    left: { head: string; items: string[] };
    right: { head: string; items: string[] };
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const gap = 28;
    const w = (b.w - gap) / 2;
    [o.left, o.right].forEach((col, i) => {
      const inner = this.card(els, { x: b.x + i * (w + gap), y: b.y, w, h: b.h });
      els.push(
        this.text(
          { ...inner, h: 30 },
          [para(col.head, { b: true })],
          18,
          this.style === 'minimal' ? this.ink : this.p.primary,
          { valign: 't' },
        ),
        this.text(
          { x: inner.x, y: inner.y + 40, w: inner.w, h: inner.h - 40 },
          col.items.filter(Boolean).map((x) => para(x, { bullet: 'dot', after: 8, lead: 1.25 })),
          15,
          this.body,
        ),
      );
    });
  }

  cards(o: { title: string; eyebrow?: string; items: { title: string; text: string }[] }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.filter((x) => x.title || x.text).slice(0, 6);
    const n = items.length || 1;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const gap = 22;
    const w = (b.w - gap * (cols - 1)) / cols;
    const maxH = (b.h - gap * (rows - 1)) / rows;
    const ts = rows > 1 ? 12.5 : 14.5;
    const need =
      Math.max(...items.map((it) => estimate(it.text, ts, w - 40))) +
      (rows > 1 ? 28 : 34) +
      12 +
      30 +
      34;
    const h = Math.min(maxH, Math.max(rows > 1 ? 120 : 170, need));
    const top0 = b.y + (b.h - (h * rows + gap * (rows - 1))) / 2;
    items.forEach((it, i) => {
      const x = b.x + (i % cols) * (w + gap);
      const y = top0 + Math.floor(i / cols) * (h + gap);
      const inner = this.card(els, { x, y, w, h });
      this.badge(els, inner.x, inner.y, i + 1, rows > 1 ? 28 : 34);
      const top = (rows > 1 ? 28 : 34) + 12;
      els.push(
        this.text(
          { x: inner.x, y: inner.y + top, w: inner.w, h: 26 },
          [para(it.title, { b: true })],
          rows > 1 ? 15 : 18,
          this.ink,
        ),
        this.text(
          { x: inner.x, y: inner.y + top + 30, w: inner.w, h: inner.h - top - 30 },
          [para(it.text, { lead: 1.3 })],
          ts,
          this.body,
        ),
      );
    });
  }

  stats(o: {
    title: string;
    eyebrow?: string;
    items: { value: string; label: string; note?: string }[];
    note?: string;
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.filter((x) => x.value || x.label).slice(0, 4);
    const n = items.length || 1;
    const gap = 22;
    const h = o.note ? b.h - 70 : b.h;
    const w = (b.w - gap * (n - 1)) / n;
    items.forEach((it, i) => {
      const inner = this.card(els, { x: b.x + i * (w + gap), y: b.y, w, h });
      const big = this.p.primary;
      els.push(
        this.text(
          { x: inner.x, y: inner.y + 10, w: inner.w, h: inner.h * 0.45 },
          [para(it.value, { b: this.style !== 'minimal', lead: 1 })],
          n > 3 ? 40 : 52,
          big,
          { valign: 'b', oneLine: true },
        ),
        this.rect(inner.x, inner.y + inner.h * 0.45 + 22, 36, 3, { color: this.p.accent }),
        this.text(
          { x: inner.x, y: inner.y + inner.h * 0.45 + 36, w: inner.w, h: inner.h * 0.55 - 36 },
          [
            para(it.label, { b: true, after: 4 }),
            ...(it.note ? [para(it.note, { color: this.body, size: 12 })] : []),
          ],
          15,
          this.ink,
        ),
      );
    });
    if (o.note)
      els.push(
        this.text({ x: b.x, y: b.y + b.h - 50, w: b.w, h: 50 }, o.note, 14, this.body, {
          valign: 'b',
        }),
      );
  }

  process(o: { title: string; eyebrow?: string; steps: { title: string; text: string }[] }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const steps = o.steps.filter((s) => s.title || s.text).slice(0, 5);
    const n = steps.length || 1;
    const gap = 18;
    const w = (b.w - gap * (n - 1)) / n;
    const p = this.p;
    if (this.style === 'geo') {
      steps.forEach((s, i) => {
        const x = b.x + i * (w + gap);
        // Chevron: ujung kanan runcing (kecuali terakhir), ujung kiri bertakik (kecuali pertama).
        const first = i === 0;
        const last = i === n - 1;
        const pts: [number, number][] = [
          [0, 0],
          [last ? 1 : 0.9, 0],
          ...(last ? [] : ([[1, 0.5]] as [number, number][])),
          [last ? 1 : 0.9, 1],
          [0, 1],
          ...(first ? [] : ([[0.08, 0.5]] as [number, number][])),
        ];
        els.push(
          this.poly(x, b.y, w + (last ? 0 : 14), 64, pts, {
            color: i % 2 ? p.secondary : p.primary,
          }),
        );
        els.push(
          this.text(
            { x: x + (first ? 18 : 30), y: b.y, w: w - 40, h: 64 },
            [para(`${String(i + 1).padStart(2, '0')}`, { b: true })],
            22,
            'ffffff',
            { valign: 'm', fit: false },
          ),
        );
      });
    } else if (this.style === 'minimal') {
      els.push(this.rect(b.x + 8, b.y + 20, b.w - 16, 1, { color: mix(p.primary, 'ffffff', 0.6) }));
      steps.forEach((_, i) => {
        const x = b.x + i * (w + gap);
        els.push(
          this.circle(x, b.y + 8, 24, { color: i === n - 1 ? p.accent : p.primary }),
          this.text(
            { x: x + 34, y: b.y + 4, w: 60, h: 30 },
            [para(String(i + 1).padStart(2, '0'))],
            18,
            p.primary,
            { valign: 'm', fit: false },
          ),
        );
      });
    } else {
      els.push(this.rect(b.x + 30, b.y + 31, b.w - 60, 3, { ...this.grad, opacity: 0.35 }));
      steps.forEach((_, i) => {
        const x = b.x + i * (w + gap);
        els.push(
          this.circle(x, b.y + 6, 52, this.grad),
          this.text(
            { x, y: b.y + 6, w: 52, h: 52 },
            [para(String(i + 1), { b: true, align: 'c' })],
            20,
            'ffffff',
            { valign: 'm', fit: false },
          ),
        );
      });
    }
    steps.forEach((s, i) => {
      const x = b.x + i * (w + gap);
      const y = b.y + 88;
      const inner =
        this.style === 'gradient'
          ? this.card(els, { x, y, w, h: b.h - 88 })
          : { x, y, w: w - 6, h: b.h - 88 };
      els.push(
        this.text(
          { x: inner.x, y: inner.y, w: inner.w, h: 46 },
          [para(s.title, { b: true, lead: 1.15 })],
          16,
          this.ink,
        ),
        this.text(
          { x: inner.x, y: inner.y + 52, w: inner.w, h: inner.h - 52 },
          [para(s.text, { lead: 1.3 })],
          12.5,
          this.body,
        ),
      );
    });
  }

  chart(o: {
    title: string;
    eyebrow?: string;
    bars: { label: string; value: number }[];
    unit?: string;
    format?: (n: number) => string;
    notes?: string[];
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const bars = o.bars.filter((x) => x.label || x.value).slice(0, 12);
    const cw = o.notes?.length ? 540 : b.w;
    const max = Math.max(1, ...bars.map((x) => x.value));
    const fmt = o.format ?? ((n: number) => n.toLocaleString('id-ID'));
    const p = this.p;
    const area = { x: b.x, y: b.y + 24, w: cw, h: b.h - 70 };
    const n = bars.length || 1;
    const slot = area.w / n;
    const bw = Math.min(64, slot * 0.6);
    els.push(
      this.rect(area.x, area.y + area.h, area.w, 1.2, { color: mix(p.dark, 'ffffff', 0.7) }),
    );
    if (o.unit)
      els.push(
        this.text({ x: b.x, y: b.y - 4, w: cw, h: 18 }, o.unit, 11, this.body, { fit: false }),
      );
    bars.forEach((bar, i) => {
      const h = Math.max(2, (bar.value / max) * (area.h - 26));
      const x = area.x + i * slot + (slot - bw) / 2;
      const y = area.y + area.h - h;
      const last = i === n - 1;
      const fill: Fill =
        this.style === 'gradient'
          ? {
              grad: {
                angle: 90,
                stops: [
                  [p.secondary, 0],
                  [p.primary, 1],
                ],
              },
            }
          : this.style === 'geo'
            ? { color: last ? p.accent : p.primary }
            : { color: last ? p.primary : mix(p.primary, 'ffffff', 0.6) };
      els.push(
        this.style === 'gradient'
          ? this.round(x, y, bw, h, Math.min(8, bw / 2), fill)
          : this.rect(x, y, bw, h, fill),
        this.text(
          { x: x - 20, y: y - 22, w: bw + 40, h: 18 },
          [para(fmt(bar.value), { b: true, align: 'c' })],
          11,
          this.ink,
          { fit: false },
        ),
        this.text(
          { x: area.x + i * slot, y: area.y + area.h + 6, w: slot, h: 36 },
          [para(bar.label, { align: 'c' })],
          n > 8 ? 9 : 11,
          this.body,
        ),
      );
    });
    if (o.notes?.length) {
      const inner = this.card(els, { x: b.x + 572, y: b.y, w: b.w - 572, h: b.h });
      els.push(
        this.text(
          inner,
          o.notes.filter(Boolean).map((x) => para(x, { bullet: 'dot', after: 8, lead: 1.3 })),
          14,
          this.body,
          { valign: 'm' },
        ),
      );
    }
  }

  table(o: { title: string; eyebrow?: string; head: string[]; rows: string[][] }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const cols = Math.max(1, o.head.length);
    const rows = o.rows.filter((r) => r.some(Boolean)).slice(0, 8);
    const rh = Math.min(42, b.h / (rows.length + 1));
    const cw = b.w / cols;
    const p = this.p;
    const headFill: Fill =
      this.style === 'gradient'
        ? this.grad
        : this.style === 'geo'
          ? { color: p.primary }
          : { color: 'ffffff', opacity: 0 };
    if (this.style === 'gradient') els.push(this.round(b.x, b.y, b.w, rh, 10, headFill));
    else if (this.style === 'geo') els.push(this.rect(b.x, b.y, b.w, rh, headFill));
    const headColor = this.style === 'minimal' ? p.primary : 'ffffff';
    o.head.forEach((hd, c) =>
      els.push(
        this.text(
          { x: b.x + c * cw, y: b.y, w: cw, h: rh },
          [para(hd.toUpperCase(), { b: true })],
          11,
          headColor,
          { valign: 'm', pad: 10, track: 0.5 },
        ),
      ),
    );
    if (this.style === 'minimal')
      els.push(this.rect(b.x, b.y + rh - 1, b.w, 1.5, { color: p.primary }));
    rows.forEach((r, i) => {
      const y = b.y + rh * (i + 1);
      if (this.style !== 'minimal' && i % 2 === 1)
        els.push(this.rect(b.x, y, b.w, rh, { color: mix(p.primary, 'ffffff', 0.93) }));
      if (this.style === 'minimal')
        els.push(this.rect(b.x, y + rh - 0.5, b.w, 0.5, { color: 'd8d4cb' }));
      r.slice(0, cols).forEach((cell, c) =>
        els.push(
          this.text(
            { x: b.x + c * cw, y, w: cw, h: rh },
            [para(cell, { b: c === 0 })],
            12.5,
            c === 0 ? this.ink : this.body,
            { valign: 'm', pad: 10 },
          ),
        ),
      );
    });
  }

  quote(o: { text: string; by?: string; eyebrow?: string; photo?: Asset }) {
    const p = this.p;
    const els: El[] = [];
    let bg: Fill;
    let color: string;
    if (this.style === 'minimal') {
      bg = { color: mix(p.light, 'ffffff', 0.55) };
      color = this.ink;
      els.push(this.circle(70, 60, 140, { color: mix(p.primary, 'ffffff', 0.88) }));
    } else if (this.style === 'geo') {
      bg = { color: p.dark };
      color = 'ffffff';
      els.push(
        this.poly(
          0,
          0,
          SLIDE.w,
          SLIDE.h,
          [
            [0.8, 0],
            [1, 0],
            [1, 1],
            [0.65, 1],
          ],
          { color: p.primary },
        ),
        this.rect(0, 0, 14, SLIDE.h, { color: p.accent }),
      );
    } else {
      bg = {
        grad: {
          angle: 35,
          stops: [
            [p.primary, 0],
            [p.secondary, 1],
          ],
        },
      };
      color = 'ffffff';
      els.push(this.circle(640, -120, 420, { color: 'ffffff', opacity: 0.08 }));
    }
    // Dengan foto: foto bulat di kiri, kutipan bergeser ke kanan.
    const qx = o.photo ? 400 : 120;
    const qw = o.photo ? 480 : 720;
    if (o.photo) {
      els.push(this.circle(96, 126, 268, { color: p.accent }));
      els.push(this.img({ x: 110, y: 140, w: 240, h: 240 }, o.photo, 'cover', 'ellipse'));
    }
    els.push(
      this.text(
        { x: qx - 10, y: 70, w: 140, h: 140 },
        [para('\u201c', { b: true })],
        160,
        p.accent,
        { fit: false },
      ),
      this.text(
        { x: qx, y: 170, w: qw, h: 220 },
        [para(o.text, { lead: 1.3 })],
        o.photo ? 26 : 30,
        color,
        { valign: 'm' },
      ),
    );
    if (o.by)
      els.push(
        this.rect(qx, 410, 40, 3, { color: p.accent }),
        this.text({ x: qx, y: 422, w: qw, h: 30 }, [para(o.by, { b: true })], 14, color),
      );
    this.slides.push({ bg, els });
  }

  imageText(o: {
    title: string;
    eyebrow?: string;
    text?: string;
    items?: string[];
    image?: Asset;
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const iw = 380;
    const paras: TextPara[] = [];
    if (o.text)
      paras.push(
        ...o.text
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((t) => para(t.trim(), { after: 10, lead: 1.35 })),
      );
    for (const it of (o.items ?? []).filter(Boolean))
      paras.push(para(it, { bullet: 'dot', after: 8, lead: 1.25 }));
    if (o.image) {
      const box = { x: b.x, y: b.y - 6, w: iw, h: b.h + 6 };
      if (this.style === 'geo')
        els.push(
          this.rect(box.x + 14, box.y + 14, box.w, box.h, { color: this.p.accent }),
          this.img(box, o.image),
        );
      else if (this.style === 'minimal') els.push(this.img(box, o.image));
      else els.push(this.img(box, o.image, 'cover', 'round', 18));
    } else {
      const box = { x: b.x, y: b.y - 6, w: iw, h: b.h + 6 };
      els.push(
        this.style === 'gradient'
          ? this.round(box.x, box.y, box.w, box.h, 18, this.grad)
          : this.rect(
              box.x,
              box.y,
              box.w,
              box.h,
              this.style === 'geo'
                ? { color: this.p.primary }
                : { color: mix(this.p.primary, 'ffffff', 0.85) },
            ),
      );
    }
    els.push(
      this.text({ x: b.x + iw + 40, y: b.y, w: b.w - iw - 40, h: b.h }, paras, 16, this.body, {
        valign: 'm',
      }),
    );
  }

  team(o: {
    title: string;
    eyebrow?: string;
    people: { name: string; role: string; photo?: Asset }[];
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const people = o.people.filter((x) => x.name).slice(0, 4);
    const n = people.length || 1;
    const w = b.w / n;
    const d = Math.min(130, w - 40);
    people.forEach((pp, i) => {
      const cx = b.x + i * w + w / 2;
      const y = b.y + 10;
      if (this.style === 'geo')
        els.push(this.rect(cx - d / 2 + 10, y + 10, d, d, { color: this.p.accent }));
      if (pp.photo)
        els.push(
          this.img(
            { x: cx - d / 2, y, w: d, h: d },
            pp.photo,
            'cover',
            this.style === 'geo' ? 'rect' : 'ellipse',
          ),
        );
      else {
        const fill =
          this.style === 'gradient'
            ? this.grad
            : { color: this.style === 'geo' ? this.p.primary : mix(this.p.primary, 'ffffff', 0.8) };
        els.push(
          this.style === 'geo'
            ? this.rect(cx - d / 2, y, d, d, fill)
            : this.circle(cx - d / 2, y, d, fill),
          this.text(
            { x: cx - d / 2, y, w: d, h: d },
            [para(initials(pp.name), { b: true, align: 'c' })],
            d * 0.3,
            this.style === 'minimal' ? this.p.primary : 'ffffff',
            { valign: 'm', fit: false },
          ),
        );
      }
      els.push(
        this.text(
          { x: cx - w / 2 + 8, y: y + d + 22, w: w - 16, h: 26 },
          [para(pp.name, { b: true, align: 'c' })],
          16,
          this.ink,
        ),
        this.text(
          { x: cx - w / 2 + 8, y: y + d + 50, w: w - 16, h: 60 },
          [para(pp.role, { align: 'c', lead: 1.3 })],
          12.5,
          this.body,
        ),
      );
    });
  }

  agenda(o: { title: string; eyebrow?: string; items: string[] }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.filter(Boolean).slice(0, 8);
    const perCol = items.length > 4 ? Math.ceil(items.length / 2) : items.length;
    const cols = items.length > 4 ? 2 : 1;
    const gap = 30;
    const w = (b.w - gap * (cols - 1)) / cols;
    const h = Math.min(92, b.h / perCol);
    items.forEach((it, i) => {
      const x = b.x + Math.floor(i / perCol) * (w + gap);
      const y = b.y + (i % perCol) * h;
      this.badge(els, x, y + (h - 44) / 2, i + 1, 44);
      els.push(
        this.text({ x: x + 66, y, w: w - 66, h }, [para(it, { b: true })], 21, this.ink, {
          valign: 'm',
        }),
      );
      if (this.style === 'minimal')
        els.push(this.rect(x + 56, y + h - 1, w - 56, 0.75, { color: 'd8d4cb' }));
    });
  }

  /** Galeri 1-3 foto dengan keterangan. */
  gallery(o: { title: string; eyebrow?: string; photos: { image: Asset; caption?: string }[] }) {
    const photos = o.photos.slice(0, 3);
    if (!photos.length) return;
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const gap = 20;
    const n = photos.length;
    const w = (b.w - gap * (n - 1)) / n;
    const hasCap = photos.some((x) => x.caption);
    const h = b.h - (hasCap ? 40 : 0);
    photos.forEach((ph, i) => {
      const x = b.x + i * (w + gap);
      if (this.style === 'geo')
        els.push(
          this.rect(x + 10, b.y + 10, w, h, { color: i % 2 ? this.p.accent : this.p.primary }),
        );
      els.push(
        this.img(
          { x, y: b.y, w, h },
          ph.image,
          'cover',
          this.style === 'gradient' ? 'round' : 'rect',
          16,
        ),
      );
      if (ph.caption)
        els.push(
          this.text(
            { x, y: b.y + h + 14, w, h: 26 },
            [para(ph.caption, { b: true })],
            13,
            this.ink,
          ),
        );
    });
  }

  // --- Visualisasi data dan slide foto ---------------------------------------------------------
  /** Warna seri untuk diagram (donat, legenda, SWOT). */
  get series(): string[] {
    const p = this.p;
    return [
      p.primary,
      p.accent,
      p.secondary,
      mix(p.primary, 'ffffff', 0.55),
      p.dark,
      mix(p.accent, 'ffffff', 0.45),
    ];
  }

  /** Potongan cincin dari sudut a0 ke a1 (derajat, 0 = atas, searah jarum jam) sebagai poligon. */
  private ring(
    cx: number,
    cy: number,
    R: number,
    r: number,
    a0: number,
    a1: number,
    fill: Fill,
  ): El {
    const steps = Math.max(2, Math.ceil(((a1 - a0) / 360) * 96));
    const pt = (rad: number, a: number): [number, number] => {
      const t = ((a - 90) * Math.PI) / 180;
      return [(rad * Math.cos(t) + R) / (2 * R), (rad * Math.sin(t) + R) / (2 * R)];
    };
    const outer = Array.from({ length: steps + 1 }, (_, i) => pt(R, a0 + ((a1 - a0) * i) / steps));
    const inner = Array.from({ length: steps + 1 }, (_, i) => pt(r, a1 - ((a1 - a0) * i) / steps));
    return this.poly(cx - R, cy - R, 2 * R, 2 * R, [...outer, ...inner], fill);
  }

  donut(o: {
    title: string;
    eyebrow?: string;
    items: { label: string; value: number }[];
    center?: { value: string; label: string };
    notes?: string[];
    format?: (n: number) => string;
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.filter((x) => x.value > 0).slice(0, 6);
    const total = items.reduce((t, x) => t + x.value, 0) || 1;
    const R = 155;
    const cx = b.x + R + 10;
    const cy = b.y + b.h / 2;
    let a = 0;
    items.forEach((it, i) => {
      const sweep = (it.value / total) * 360;
      els.push(this.ring(cx, cy, R, R * 0.6, a, a + sweep, { color: this.series[i] }));
      a += sweep;
    });
    if (o.center)
      els.push(
        this.text(
          { x: cx - 80, y: cy - 42, w: 160, h: 46 },
          [para(o.center.value, { b: true, align: 'c' })],
          30,
          this.ink,
          { valign: 'b', oneLine: true },
        ),
        this.text(
          { x: cx - 70, y: cy + 6, w: 140, h: 36 },
          [para(o.center.label, { align: 'c' })],
          11.5,
          this.body,
        ),
      );
    const lx = b.x + 2 * R + 70;
    const lw = b.x + b.w - lx;
    const avail = o.notes?.length ? b.h - 90 : b.h;
    const rowH = Math.min(54, avail / Math.max(1, items.length));
    const top = b.y + (avail - rowH * items.length) / 2;
    const fmt = o.format ?? ((n: number) => n.toLocaleString('id-ID'));
    items.forEach((it, i) => {
      const y = top + i * rowH;
      const pct = Math.round((it.value / total) * 100);
      els.push(
        this.round(lx, y + rowH / 2 - 8, 16, 16, this.style === 'geo' ? 0 : 8, {
          color: this.series[i],
        }),
        this.text(
          { x: lx + 28, y, w: lw - 150, h: rowH },
          [para(it.label, { b: true })],
          15,
          this.ink,
          { valign: 'm' },
        ),
        this.text(
          { x: lx + lw - 120, y, w: 120, h: rowH },
          [
            para(`${pct}%`, { b: true, align: 'r', size: 18, color: this.p.primary }),
            para(fmt(it.value), { align: 'r', size: 10, color: this.body }),
          ],
          18,
          this.ink,
          { valign: 'm', fit: false },
        ),
      );
      if (this.style !== 'gradient')
        els.push(this.rect(lx, y + rowH - 0.5, lw, 0.75, { color: 'e3e1dc' }));
    });
    if (o.notes?.length)
      els.push(
        this.text(
          { x: lx, y: b.y + b.h - 80, w: lw, h: 80 },
          o.notes.filter(Boolean).map((x) => para(x, { bullet: 'dot', after: 4 })),
          12.5,
          this.body,
          { valign: 'b' },
        ),
      );
  }

  lineChart(o: {
    title: string;
    eyebrow?: string;
    points: { label: string; value: number }[];
    unit?: string;
    notes?: string[];
    format?: (n: number) => string;
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const pts = o.points.slice(0, 12);
    if (!pts.length) return;
    const p = this.p;
    const cw = o.notes?.length ? 540 : b.w;
    const area = { x: b.x + 24, y: b.y + 34, w: cw - 48, h: b.h - 80 };
    const max = Math.max(...pts.map((x) => x.value), 1);
    const min = Math.min(0, ...pts.map((x) => x.value));
    const fmt = o.format ?? ((n: number) => n.toLocaleString('id-ID'));
    const X = (i: number) =>
      area.x + (pts.length === 1 ? area.w / 2 : (i * area.w) / (pts.length - 1));
    const Y = (v: number) => area.y + area.h - ((v - min) / (max - min || 1)) * area.h;
    if (o.unit)
      els.push(
        this.text({ x: b.x, y: b.y - 4, w: cw, h: 18 }, o.unit, 11, this.body, { fit: false }),
      );
    for (let g = 0; g <= 3; g++)
      els.push(
        this.rect(b.x, area.y + (area.h * g) / 3, cw, 0.6, {
          color: g === 3 ? mix(p.dark, 'ffffff', 0.7) : 'e4e4e9',
        }),
      );
    if (pts.length > 1) {
      const poly: [number, number][] = [
        ...pts.map(
          (x, i) => [(X(i) - area.x) / area.w, (Y(x.value) - area.y) / area.h] as [number, number],
        ),
        [1, 1],
        [0, 1],
      ];
      els.push(
        this.poly(
          area.x,
          area.y,
          area.w,
          area.h,
          poly,
          this.style === 'gradient'
            ? { ...this.grad, opacity: 0.25 }
            : { color: p.primary, opacity: 0.12 },
        ),
      );
    }
    for (let i = 1; i < pts.length; i++)
      els.push({
        t: 'shape',
        geom: 'line',
        x: X(i - 1),
        y: Y(pts[i - 1].value),
        w: X(i) - X(i - 1),
        h: Y(pts[i].value) - Y(pts[i - 1].value),
        line: { color: p.primary, w: 3 },
      });
    pts.forEach((pt, i) => {
      const last = i === pts.length - 1;
      els.push(
        this.circle(
          X(i) - 6,
          Y(pt.value) - 6,
          12,
          { color: last ? p.accent : 'ffffff' },
          { color: last ? p.accent : p.primary, w: 2.5 },
        ),
        this.text(
          { x: X(i) - 40, y: Y(pt.value) - 30, w: 80, h: 18 },
          [para(fmt(pt.value), { b: true, align: 'c' })],
          11,
          this.ink,
          { fit: false },
        ),
        this.text(
          { x: X(i) - 45, y: area.y + area.h + 8, w: 90, h: 30 },
          [para(pt.label, { align: 'c' })],
          pts.length > 8 ? 9 : 11,
          this.body,
        ),
      );
    });
    if (o.notes?.length) {
      const inner = this.card(els, { x: b.x + 572, y: b.y, w: b.w - 572, h: b.h });
      els.push(
        this.text(
          inner,
          o.notes.filter(Boolean).map((x) => para(x, { bullet: 'dot', after: 8, lead: 1.3 })),
          14,
          this.body,
          { valign: 'm' },
        ),
      );
    }
  }

  progress(o: {
    title: string;
    eyebrow?: string;
    items: { label: string; value: number; note?: string }[];
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.slice(0, 6);
    const p = this.p;
    const rowH = Math.min(64, b.h / Math.max(1, items.length));
    const top = b.y + (b.h - rowH * items.length) / 2;
    const lw = 250;
    const tx = b.x + lw + 20;
    const tw = b.w - lw - 110;
    items.forEach((it, i) => {
      const y = top + i * rowH;
      const pct = Math.max(0, it.value);
      const fillW = Math.max(6, (Math.min(100, pct) / 100) * tw);
      const done = pct >= 100;
      const trackFill = { color: mix(p.primary, 'ffffff', 0.88) };
      const fill: Fill =
        this.style === 'gradient'
          ? this.grad
          : { color: done && this.style === 'geo' ? p.accent : p.primary };
      els.push(
        this.text(
          { x: b.x, y, w: lw, h: rowH },
          [
            para(it.label, { b: true }),
            ...(it.note ? [para(it.note, { size: 10.5, color: this.body })] : []),
          ],
          14.5,
          this.ink,
          { valign: 'm' },
        ),
        this.style === 'gradient'
          ? this.round(tx, y + rowH / 2 - 7, tw, 14, 7, trackFill)
          : this.rect(tx, y + rowH / 2 - 6, tw, 12, trackFill),
        this.style === 'gradient'
          ? this.round(tx, y + rowH / 2 - 7, fillW, 14, 7, fill)
          : this.rect(tx, y + rowH / 2 - 6, fillW, 12, fill),
        this.text(
          { x: tx + tw + 14, y, w: 80, h: rowH },
          [para(`${Math.round(pct)}%`, { b: true, align: 'r' })],
          18,
          done ? p.primary : this.ink,
          { valign: 'm', fit: false },
        ),
      );
    });
  }

  timeline(o: {
    title: string;
    eyebrow?: string;
    items: { when: string; title: string; text?: string }[];
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.slice(0, 6);
    const n = items.length || 1;
    const p = this.p;
    const midY = b.y + b.h / 2;
    const slot = b.w / n;
    els.push(
      this.style === 'gradient'
        ? this.round(b.x, midY - 2, b.w, 4, 2, this.grad)
        : this.rect(b.x, midY - 1.5, b.w, 3, {
            color: this.style === 'minimal' ? mix(p.primary, 'ffffff', 0.5) : p.primary,
          }),
    );
    items.forEach((it, i) => {
      const cx = b.x + slot * i + slot / 2;
      const up = i % 2 === 0;
      const d = 20;
      const dot: Fill =
        this.style === 'gradient' ? this.grad : { color: i === n - 1 ? p.accent : p.primary };
      els.push(
        this.style === 'geo'
          ? this.rect(cx - d / 2, midY - d / 2, d, d, dot, { rot: 45 })
          : this.circle(cx - d / 2, midY - d / 2, d, dot, { color: 'ffffff', w: 3 }),
        this.rect(cx - 0.5, up ? midY - 34 : midY + 14, 1, 20, {
          color: mix(p.primary, 'ffffff', 0.5),
        }),
      );
      const bw = Math.min(200, slot - 12);
      const box = { x: cx - bw / 2, y: up ? b.y : midY + 38, w: bw, h: b.h / 2 - 40 };
      const paras: TextPara[] = [
        para(it.when, {
          b: true,
          color:
            this.style === 'minimal' ? p.primary : this.style === 'geo' ? p.accent : p.secondary,
          size: 18,
          after: 2,
          align: 'c',
        }),
        para(it.title, { b: true, after: 3, align: 'c' }),
      ];
      if (it.text)
        paras.push(para(it.text, { size: 11, color: this.body, align: 'c', lead: 1.25 }));
      els.push(this.text(box, paras, 13.5, this.ink, { valign: up ? 'b' : 't' }));
    });
  }

  swot(o: { title: string; eyebrow?: string; quads: { head: string; items: string[] }[] }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const gap = 16;
    const w = (b.w - gap) / 2;
    const h = (b.h - gap) / 2;
    const p = this.p;
    const colors = [p.primary, p.secondary, p.accent, p.dark];
    o.quads.slice(0, 4).forEach((q, i) => {
      const x = b.x + (i % 2) * (w + gap);
      const y = b.y + Math.floor(i / 2) * (h + gap);
      const letter = q.head.trim()[0]?.toUpperCase() ?? '';
      const bx = this.style === 'minimal' ? x : x + 14;
      if (this.style === 'minimal') els.push(this.rect(x, y, w, 2, { color: colors[i] }));
      else if (this.style === 'gradient')
        els.push(
          this.round(
            x,
            y,
            w,
            h,
            14,
            { color: 'ffffff' },
            { color: mix(p.primary, 'ffffff', 0.82), w: 0.75 },
          ),
        );
      else els.push(this.rect(x, y, w, h, { color: mix(colors[i], 'ffffff', 0.9) }));
      els.push(
        this.style === 'gradient'
          ? this.circle(bx, y + 14, 44, { color: colors[i] })
          : this.rect(bx, y + 14, 44, 44, { color: colors[i] }),
        this.text(
          { x: bx, y: y + 14, w: 44, h: 44 },
          [para(letter, { b: true, align: 'c' })],
          22,
          'ffffff',
          { valign: 'm', fit: false },
        ),
        this.text(
          { x: bx + 58, y: y + 14, w: w - 90, h: 44 },
          [para(q.head, { b: true })],
          17,
          this.ink,
          { valign: 'm' },
        ),
        this.text(
          { x: bx + 4, y: y + 68, w: w - 36, h: h - 80 },
          q.items.filter(Boolean).map((t) => para(t, { bullet: 'dot', after: 4, lead: 1.25 })),
          12.5,
          this.body,
        ),
      );
    });
  }

  /** Lingkaran bertingkat (misalnya TAM, SAM, SOM) dengan keterangan di kanan. */
  circles(o: {
    title: string;
    eyebrow?: string;
    items: { value: string; label: string; note?: string }[];
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const items = o.items.filter((x) => x.value || x.label).slice(0, 3);
    const p = this.p;
    const D = b.h + 6;
    const base = b.y + b.h + 2;
    const cx = b.x + D / 2;
    const fills: Fill[] = [
      { color: mix(p.primary, 'ffffff', 0.86) },
      { color: mix(p.primary, 'ffffff', 0.55) },
      this.style === 'gradient' ? this.grad : { color: p.primary },
    ];
    items.forEach((it, i) => {
      const d = D * [1, 0.66, 0.36][i];
      els.push(this.circle(cx - d / 2, base - d, d, fills[i]));
      const ly = i === 2 ? base - d / 2 - 14 : base - d + 16;
      els.push(
        this.text(
          { x: cx - 80, y: ly, w: 160, h: 28 },
          [para(it.value, { b: true, align: 'c' })],
          i === 2 ? 18 : 16,
          i === 2 ? 'ffffff' : this.ink,
          { oneLine: true },
        ),
      );
    });
    const lx = b.x + D + 60;
    const lw = b.x + b.w - lx;
    const rowH = b.h / Math.max(1, items.length);
    items.forEach((it, i) => {
      const y = b.y + i * rowH;
      els.push(
        this.circle(
          lx,
          y + 14,
          20,
          fills[i],
          i === 0 ? { color: mix(p.primary, 'ffffff', 0.6), w: 1 } : undefined,
        ),
        this.text(
          { x: lx + 34, y, w: lw - 34, h: rowH - 8 },
          [
            para(it.value, { b: true, size: 26, color: p.primary, after: 2, lead: 1.05 }),
            para(it.label, { b: true, after: 2 }),
            ...(it.note ? [para(it.note, { size: 12, color: this.body })] : []),
          ],
          15,
          this.ink,
        ),
      );
    });
  }

  pricing(o: {
    title: string;
    eyebrow?: string;
    plans: { name: string; price: string; period?: string; features: string[] }[];
    highlight?: number;
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const plans = o.plans.slice(0, 3);
    const n = plans.length || 1;
    const gap = 22;
    const w = (b.w - gap * (n - 1)) / n;
    const p = this.p;
    const hi = o.highlight ?? Math.min(1, n - 1);
    plans.forEach((pl, i) => {
      const x = b.x + i * (w + gap);
      const on = i === hi;
      const y = on ? b.y - 8 : b.y + 8;
      const h = on ? b.h + 16 : b.h - 16;
      const fg = on ? 'ffffff' : this.ink;
      const sub = on ? mix('ffffff', p.primary, 0.2) : this.body;
      if (on)
        els.push(
          this.style === 'gradient'
            ? this.round(x, y, w, h, 16, this.grad)
            : this.rect(x, y, w, h, { color: this.style === 'minimal' ? p.primary : p.dark }),
        );
      else if (this.style === 'gradient')
        els.push(
          this.round(
            x,
            y,
            w,
            h,
            16,
            { color: 'ffffff' },
            { color: mix(p.primary, 'ffffff', 0.82), w: 0.75 },
          ),
        );
      else
        els.push(
          this.rect(
            x,
            y,
            w,
            h,
            { color: this.style === 'geo' ? mix(p.primary, 'ffffff', 0.93) : 'ffffff' },
            { line: this.style === 'minimal' ? { color: 'd8d4cb', w: 0.75 } : undefined },
          ),
        );
      if (on && this.style === 'geo') els.push(this.rect(x, y, w, 6, { color: p.accent }));
      els.push(
        this.text(
          { x: x + 22, y: y + 22, w: w - 44, h: 22 },
          [para(pl.name.toUpperCase(), { b: true })],
          12,
          on ? (this.style === 'geo' ? p.accent : 'ffffff') : p.primary,
          { track: 1.2, fit: false },
        ),
        this.text(
          { x: x + 22, y: y + 48, w: w - 44, h: 46 },
          [para(pl.price, { b: true })],
          32,
          fg,
          { valign: 'b', oneLine: true },
        ),
        this.text({ x: x + 22, y: y + 96, w: w - 44, h: 20 }, pl.period ?? '', 11, sub, {
          fit: false,
        }),
        this.rect(x + 22, y + 124, w - 44, 0.75, {
          color: on ? mix('ffffff', p.primary, 0.5) : 'dddddd',
        }),
        this.text(
          { x: x + 22, y: y + 136, w: w - 44, h: h - 150 },
          pl.features.filter(Boolean).map((f) => para(f, { bullet: 'dot', after: 6, lead: 1.25 })),
          12.5,
          on ? 'ffffff' : this.body,
        ),
      );
    });
  }

  /** Slide foto penuh dengan pernyataan besar. */
  statement(o: { text: string; sub?: string; eyebrow?: string; image?: Asset }) {
    const p = this.p;
    const els: El[] = [];
    let bg: Fill = { color: p.dark };
    if (this.style === 'minimal') {
      bg = { color: mix(p.light, 'ffffff', 0.55) };
      if (o.image) els.push(this.img({ x: 480, y: 0, w: 480, h: SLIDE.h }, o.image));
      else els.push(this.rect(480, 0, 480, SLIDE.h, { color: mix(p.primary, 'ffffff', 0.85) }));
      els.push(this.circle(436, 400, 88, { color: p.accent }));
      if (o.eyebrow)
        els.push(
          this.rect(64, 150, 26, 1.5, { color: p.accent }),
          this.text(
            { x: 100, y: 142, w: 340, h: 16 },
            [para(o.eyebrow.toUpperCase(), { b: true })],
            9.5,
            p.primary,
            { track: 2, fit: false },
          ),
        );
      els.push(
        this.text({ x: 64, y: 170, w: 370, h: 200 }, [para(o.text, { lead: 1.2 })], 32, this.ink),
      );
      if (o.sub) els.push(this.text({ x: 64, y: 380, w: 340, h: 90 }, o.sub, 14, '5a5a5a'));
    } else {
      if (o.image) els.push(this.img({ x: 0, y: 0, w: SLIDE.w, h: SLIDE.h }, o.image));
      if (this.style === 'gradient')
        els.push(
          this.rect(0, 0, SLIDE.w, SLIDE.h, {
            grad: {
              angle: 35,
              stops: [
                [p.primary, 0],
                [p.secondary, 1],
              ],
            },
            opacity: o.image ? 0.8 : 1,
          }),
        );
      else
        els.push(
          this.rect(0, 0, SLIDE.w, SLIDE.h, { color: p.dark, opacity: o.image ? 0.64 : 1 }),
          this.rect(0, 0, 14, SLIDE.h, { color: p.accent }),
          this.poly(
            0,
            0,
            SLIDE.w,
            SLIDE.h,
            [
              [0.84, 0],
              [1, 0],
              [1, 0.3],
            ],
            { color: p.accent },
          ),
        );
      if (o.eyebrow)
        els.push(
          this.text(
            { x: 80, y: 150, w: 700, h: 20 },
            [para(o.eyebrow.toUpperCase(), { b: true })],
            11,
            this.style === 'geo' ? p.accent : 'ffffff',
            { track: 2, fit: false },
          ),
        );
      els.push(
        this.text(
          { x: 80, y: 176, w: 720, h: 200 },
          [para(o.text, { b: true, lead: 1.15 })],
          38,
          'ffffff',
        ),
      );
      if (o.sub)
        els.push(
          this.rect(80, 392, 60, 4, { color: p.accent }),
          this.text({ x: 80, y: 408, w: 640, h: 70 }, o.sub, 15, mix('ffffff', p.dark, 0.12)),
        );
    }
    this.slides.push({ bg, els });
  }

  /** Diagram model penelitian: beberapa variabel (X) menuju satu variabel (Y). */
  model(o: {
    title: string;
    eyebrow?: string;
    inputs: string[];
    output: string;
    labels?: string[];
    note?: string;
  }) {
    const { els, body: b } = this.frame(o.title, o.eyebrow);
    const inputs = o.inputs.filter(Boolean).slice(0, 5);
    const n = inputs.length || 1;
    const p = this.p;
    const bw = 250;
    const bh = Math.min(64, (b.h - 20 * (n - 1)) / n);
    const gap = n > 1 ? (b.h - bh * n) / (n - 1) : 0;
    const out = { x: b.x + b.w - 260, y: b.y + b.h / 2 - 50, w: 260, h: 100 };
    const inFill: Fill = { color: this.style === 'geo' ? mix(p.primary, 'ffffff', 0.9) : 'ffffff' };
    const outFill: Fill =
      this.style === 'gradient'
        ? this.grad
        : { color: this.style === 'minimal' ? p.primary : p.dark };
    inputs.forEach((label, i) => {
      const y = n === 1 ? b.y + b.h / 2 - bh / 2 : b.y + i * (bh + gap);
      const sx = b.x + bw;
      const sy = y + bh / 2;
      const ex = out.x;
      const ey = out.y + out.h / 2;
      els.push(
        {
          t: 'shape',
          geom: 'line',
          x: sx,
          y: sy,
          w: ex - sx,
          h: ey - sy,
          line: { color: mix(p.primary, 'ffffff', 0.35), w: 1.75 },
        },
        this.circle(ex - 5, ey - 5, 10, { color: p.accent }),
        this.style === 'gradient'
          ? this.round(b.x, y, bw, bh, 12, inFill, { color: mix(p.primary, 'ffffff', 0.75), w: 1 })
          : this.rect(b.x, y, bw, bh, inFill, {
              line: { color: mix(p.primary, 'ffffff', 0.6), w: 1 },
            }),
      );
      if (this.style === 'geo') els.push(this.rect(b.x, y, 6, bh, { color: p.primary }));
      els.push(
        this.text({ x: b.x + 16, y, w: bw - 26, h: bh }, [para(label, { b: true })], 14, this.ink, {
          valign: 'm',
        }),
      );
      const lab = o.labels?.[i];
      if (lab) {
        const mx = sx + (ex - sx) * 0.42;
        const my = sy + (ey - sy) * 0.42;
        els.push(
          this.round(mx - 22, my - 12, 44, 24, 12, {
            color: this.style === 'geo' ? p.accent : p.primary,
          }),
          this.text(
            { x: mx - 22, y: my - 12, w: 44, h: 24 },
            [para(lab, { b: true, align: 'c' })],
            10.5,
            'ffffff',
            { valign: 'm', fit: false },
          ),
        );
      }
    });
    els.push(
      this.style === 'gradient'
        ? this.round(out.x, out.y, out.w, out.h, 16, outFill)
        : this.rect(out.x, out.y, out.w, out.h, outFill),
    );
    els.push(
      this.text(
        { x: out.x + 16, y: out.y, w: out.w - 32, h: out.h },
        [para(o.output, { b: true, align: 'c' })],
        18,
        'ffffff',
        { valign: 'm' },
      ),
    );
    if (o.note)
      els.push(
        this.text(
          { x: out.x, y: out.y + out.h + 16, w: out.w, h: 80 },
          [para(o.note, { align: 'c', lead: 1.3 })],
          11.5,
          this.body,
        ),
      );
  }
}
