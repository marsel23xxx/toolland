/**
 * Render DeckSpec ke PDF (satu halaman per slide, 960 x 540 pt). Gradien memakai shading PDF asli
 * (axial), transparansi memakai ExtGState, gambar dipotong dengan clipping path.
 */
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFOperator,
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  endPath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  setFillingRgbColor,
  setGraphicsState,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  type PDFImage,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib';
import { embedFonts, type Fonts } from '../docs/pdf';
import {
  SLIDE,
  containBox,
  coverCrop,
  type DeckSpec,
  type El,
  type Fill,
  type ImgEl,
  type ShapeEl,
  type TextEl,
} from './model';
import { fitScale, layoutText } from './text';

const K = 0.5523;
type Op = ReturnType<typeof moveTo>;

const rgb01 = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Lintasan bentuk dalam koordinat PDF (y ke atas). */
function pathOps(g: {
  geom: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pts?: [number, number][];
  r?: number;
}): Op[] {
  const H = SLIDE.h;
  const { x, y, w, h } = g;
  const X = (v: number) => x + v * w;
  const Y = (v: number) => H - (y + v * h);
  switch (g.geom) {
    case 'ellipse': {
      const cx = x + w / 2;
      const cy = H - (y + h / 2);
      const rx = w / 2;
      const ry = h / 2;
      return [
        moveTo(cx + rx, cy),
        appendBezierCurve(cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry),
        appendBezierCurve(cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy),
        appendBezierCurve(cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry),
        appendBezierCurve(cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy),
        closePath(),
      ];
    }
    case 'round': {
      const r = Math.max(0, Math.min(g.r ?? 8, w / 2, h / 2));
      const t = H - y;
      const b = H - y - h;
      const l = x;
      const rt = x + w;
      const k = r * (1 - K);
      return [
        moveTo(l + r, t),
        lineTo(rt - r, t),
        appendBezierCurve(rt - k, t, rt, t - k, rt, t - r),
        lineTo(rt, b + r),
        appendBezierCurve(rt, b + k, rt - k, b, rt - r, b),
        lineTo(l + r, b),
        appendBezierCurve(l + k, b, l, b + k, l, b + r),
        lineTo(l, t - r),
        appendBezierCurve(l, t - k, l + k, t, l + r, t),
        closePath(),
      ];
    }
    case 'poly': {
      const pts = g.pts ?? [];
      if (!pts.length) return [];
      return [
        moveTo(X(pts[0][0]), Y(pts[0][1])),
        ...pts.slice(1).map(([px, py]) => lineTo(X(px), Y(py))),
        closePath(),
      ];
    }
    case 'line':
      return [moveTo(x, H - y), lineTo(x + w, H - (y + h))];
    default:
      return [
        moveTo(x, H - y),
        lineTo(x + w, H - y),
        lineTo(x + w, H - y - h),
        lineTo(x, H - y - h),
        closePath(),
      ];
  }
}

class Painter {
  private gs = 0;
  private sh = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly page: PDFPage,
  ) {}

  /** Nama ExtGState untuk transparansi. */
  alpha(a: number) {
    return this.page.node.newExtGState(
      'GSa',
      this.doc.context.obj({ Type: 'ExtGState', ca: a, CA: a }),
    );
  }

  shading(
    grad: NonNullable<Fill['grad']>,
    box: { x: number; y: number; w: number; h: number },
  ): string {
    const H = SLIDE.h;
    const a = (grad.angle * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const L = Math.abs(box.w * dx) + Math.abs(box.h * dy);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const p0 = [cx - (dx * L) / 2, H - (cy - (dy * L) / 2)];
    const p1 = [cx + (dx * L) / 2, H - (cy + (dy * L) / 2)];
    const stops = grad.stops;
    const fn = (c0: string, c1: string) => ({
      FunctionType: 2,
      Domain: [0, 1],
      C0: rgb01(c0),
      C1: rgb01(c1),
      N: 1,
    });
    const func =
      stops.length <= 2
        ? fn(stops[0][0], stops[stops.length - 1][0])
        : {
            FunctionType: 3,
            Domain: [0, 1],
            Functions: stops.slice(1).map((s, i) => fn(stops[i][0], s[0])),
            Bounds: stops.slice(1, -1).map((s) => s[1]),
            Encode: stops.slice(1).flatMap(() => [0, 1]),
          };
    const ref: PDFRef = this.doc.context.register(
      this.doc.context.obj({
        ShadingType: 2,
        ColorSpace: 'DeviceRGB',
        Coords: [...p0, ...p1],
        Function: func,
        Extend: [true, true],
      }),
    );
    const res = this.page.node.Resources()!;
    let dict = res.lookupMaybe(PDFName.of('Shading'), PDFDict);
    if (!dict) {
      dict = this.doc.context.obj({});
      res.set(PDFName.of('Shading'), dict);
    }
    const name = `Sh${++this.sh}`;
    dict.set(PDFName.of(name), ref);
    return name;
  }

  /** Isi lintasan dengan warna atau gradien. */
  fillPath(path: Op[], f: Fill, box: { x: number; y: number; w: number; h: number }) {
    if (!path.length || (!f.color && !f.grad)) return;
    const ops: Op[] = [pushGraphicsState()];
    if (f.opacity !== undefined && f.opacity < 1) ops.push(setGraphicsState(this.alpha(f.opacity)));
    if (f.grad) {
      const name = this.shading(f.grad, box);
      ops.push(
        ...path,
        clip(),
        endPath(),
        PDFOperator.of('sh' as never, [PDFName.of(name)]) as unknown as Op,
      );
    } else {
      ops.push(setFillingRgbColor(...rgb01(f.color!)), ...path, fill());
    }
    ops.push(popGraphicsState());
    this.page.pushOperators(...ops);
  }

  strokePath(path: Op[], line: NonNullable<ShapeEl['line']>) {
    const ops: Op[] = [pushGraphicsState()];
    if (line.opacity !== undefined && line.opacity < 1)
      ops.push(setGraphicsState(this.alpha(line.opacity)));
    ops.push(
      setStrokingRgbColor(...rgb01(line.color)),
      setLineWidth(line.w),
      ...path,
      stroke(),
      popGraphicsState(),
    );
    this.page.pushOperators(...ops);
  }

  shape(el: ShapeEl) {
    const rotate = el.rot ? this.rotation(el) : [];
    if (rotate.length) this.page.pushOperators(pushGraphicsState(), ...rotate);
    const path = pathOps(el);
    if (el.geom !== 'line' && el.fill) this.fillPath(path, el.fill, el);
    if (el.line) this.strokePath(pathOps(el), el.line);
    if (rotate.length) this.page.pushOperators(popGraphicsState());
  }

  rotation(el: { x: number; y: number; w: number; h: number; rot?: number }): Op[] {
    const t = (-(el.rot ?? 0) * Math.PI) / 180;
    const cx = el.x + el.w / 2;
    const cy = SLIDE.h - (el.y + el.h / 2);
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [concatTransformationMatrix(c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy)];
  }

  text(el: TextEl, fonts: Fonts) {
    const scale = fitScale(el, fonts);
    const { paras, height, inner } = layoutText(el, fonts, scale);
    const pad = el.pad ?? 0;
    let top = el.y + pad;
    if (el.valign === 'm') top += (inner - height) / 2;
    else if (el.valign === 'b') top += inner - height;
    const x0 = el.x + pad;
    const w = el.w - pad * 2;
    const H = SLIDE.h;
    if (el.track) this.page.pushOperators(setCharacterSpacing(el.track));
    for (const p of paras) {
      const lh = p.size * p.lead;
      p.lines.forEach((line, li) => {
        const base = H - (top + (lh - p.size) / 2 + p.size * 0.8);
        const tw = line.w + (el.track ? el.track * lineChars(line) : 0);
        const avail = w - p.indent;
        let cx =
          x0 + p.indent + (p.align === 'c' ? (avail - tw) / 2 : p.align === 'r' ? avail - tw : 0);
        if (li === 0 && p.bullet)
          this.page.drawText(p.bullet, {
            x: x0,
            y: base,
            size: p.size,
            font: fonts.pick(),
            color: hexRgb(p.color),
          });
        for (const word of line.words) {
          for (const seg of word.segs) {
            this.page.drawText(seg.text, {
              x: cx,
              y: base,
              size: seg.size,
              font: seg.font,
              color: hexRgb(seg.color),
            });
            cx += seg.w + (el.track ? el.track * [...seg.text].length : 0);
          }
          cx += word.space + (el.track ?? 0);
        }
        top += lh;
      });
      if (!p.lines.length) top += lh;
      top += p.after;
    }
    if (el.track) this.page.pushOperators(setCharacterSpacing(0));
  }

  image(el: ImgEl, img: PDFImage) {
    const H = SLIDE.h;
    const clipPath = pathOps({
      geom: el.shape === 'ellipse' ? 'ellipse' : el.shape === 'round' ? 'round' : 'rect',
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      r: el.r,
    });
    let box: { x: number; y: number; w: number; h: number };
    if (el.mode === 'contain') box = containBox(el);
    else {
      const c = coverCrop(el);
      const fw = el.w / (1 - c.l - c.r);
      const fh = el.h / (1 - c.t - c.b);
      box = { x: el.x - c.l * fw, y: el.y - c.t * fh, w: fw, h: fh };
    }
    this.page.pushOperators(pushGraphicsState(), ...clipPath, clip(), endPath());
    this.page.drawImage(img, { x: box.x, y: H - box.y - box.h, width: box.w, height: box.h });
    this.page.pushOperators(popGraphicsState());
  }
}

const lineChars = (line: { words: { segs: { text: string }[] }[] }) =>
  line.words.reduce((n, w) => n + w.segs.reduce((m, s) => m + [...s.text].length, 0) + 1, -1);

const hexRgb = (hex: string) => rgb(...rgb01(hex));

/** Buat PDF presentasi dari DeckSpec. */
export async function renderDeckPdf(spec: DeckSpec): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc, spec.font);
  const images = new Map<Uint8Array, PDFImage>();
  for (const s of spec.slides)
    for (const el of s.els)
      if (el.t === 'img' && !images.has(el.data))
        images.set(
          el.data,
          el.type === 'png' ? await doc.embedPng(el.data) : await doc.embedJpg(el.data),
        );

  for (const s of spec.slides) {
    const page = doc.addPage([SLIDE.w, SLIDE.h]);
    const p = new Painter(doc, page);
    const full = { x: 0, y: 0, w: SLIDE.w, h: SLIDE.h };
    p.fillPath(
      pathOps({ geom: 'rect', ...full }),
      s.bg.color || s.bg.grad ? s.bg : { color: 'ffffff' },
      full,
    );
    for (const el of s.els as El[]) {
      if (el.t === 'shape') p.shape(el);
      else if (el.t === 'text') p.text(el, fonts);
      else p.image(el, images.get(el.data)!);
    }
  }
  doc.setTitle(spec.title);
  doc.setAuthor(spec.author);
  doc.setLanguage(spec.lang === 'id' ? 'id-ID' : 'en-US');
  doc.setCreator('Toolland');
  doc.setProducer('Toolland (pdf-lib)');
  return { bytes: await doc.save(), pages: spec.slides.length };
}

/** Skala huruf hasil "fit" per kotak teks, agar PPTX memakai ukuran yang sama dengan PDF. */
export async function fitScales(spec: DeckSpec): Promise<Map<TextEl, number>> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc, spec.font);
  const out = new Map<TextEl, number>();
  for (const s of spec.slides)
    for (const el of s.els) if (el.t === 'text' && el.fit) out.set(el, fitScale(el, fonts));
  return out;
}
