/**
 * Tata letak teks slide (dipakai renderer PDF dan untuk mengecilkan huruf agar muat). PowerPoint
 * memakai Arial/Times New Roman yang lebarnya sama dengan Helvetica/Times di PDF, jadi pemecahan
 * barisnya hampir selalu identik.
 */
import { toWords, wrapWords, type Fonts, type Line } from '../docs/pdf';
import type { TextEl } from './model';

export const DEFAULT_LEAD = 1.2;

export interface LaidPara {
  lines: Line[];
  size: number;
  lead: number;
  indent: number;
  after: number;
  align: 'l' | 'c' | 'r';
  bullet?: string;
  color: string;
}

export function bulletIndent(size: number, bullet?: 'dot' | 'num') {
  return bullet ? size * (bullet === 'num' ? 1.5 : 1.1) : 0;
}

/** Susun paragraf dalam kotak teks; `scale` mengecilkan semua ukuran huruf. */
export function layoutText(el: TextEl, fonts: Fonts, scale = 1) {
  const pad = el.pad ?? 0;
  const w = el.w - pad * 2;
  let n = 0;
  const paras: LaidPara[] = el.paras.map((p) => {
    const size = (p.size ?? el.size) * scale;
    const color = p.color ?? el.color;
    const indent = bulletIndent(size, p.bullet);
    if (p.bullet === 'num') n++;
    const words = toWords(
      p.runs.map((r) => ({ ...r })),
      fonts,
      size,
      color,
    );
    return {
      lines: words.length ? wrapWords(words, w - indent) : [],
      size,
      lead: p.lead ?? DEFAULT_LEAD,
      indent,
      after: (p.after ?? 0) * scale,
      align: p.align ?? 'l',
      bullet: p.bullet === 'dot' ? '•' : p.bullet === 'num' ? `${n}.` : undefined,
      color,
    };
  });
  const height = paras.reduce(
    (h, p, i) =>
      h + Math.max(1, p.lines.length) * p.size * p.lead + (i < paras.length - 1 ? p.after : 0),
    0,
  );
  return { paras, height, inner: el.h - pad * 2 };
}

/** Skala huruf terbesar (1 sampai 0.55) yang membuat teks muat di kotaknya. */
export function fitScale(el: TextEl, fonts: Fonts): number {
  if (!el.fit) return 1;
  const min = el.oneLine ? 0.35 : 0.55;
  for (let s = 1; s >= min; s -= 0.05) {
    const { height, inner, paras } = layoutText(el, fonts, s);
    if (height <= inner + 0.5 && (!el.oneLine || paras.every((p) => p.lines.length <= 1))) return s;
  }
  return min;
}
