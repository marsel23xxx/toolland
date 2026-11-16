/**
 * Pustaka shape untuk panel kiri Editor Diagram. Setiap item berisi gaya maxGraph (CellStyle),
 * ukuran awal, dan kata kunci pencarian dua bahasa. Shape tambahan (stencil) ada di stencils.ts.
 */
import type { CellStyle } from '@maxgraph/core';

export interface LibItem {
  id: string;
  name: { id: string; en: string };
  /** Kata kunci tambahan untuk pencarian. */
  keys?: string;
  kind: 'vertex' | 'edge';
  w: number;
  h: number;
  style: CellStyle;
  /** Teks awal di dalam shape. */
  value?: string;
}

export interface LibGroup {
  id: string;
  name: { id: string; en: string };
  items: LibItem[];
}

const v = (
  id: string,
  nameId: string,
  nameEn: string,
  w: number,
  h: number,
  style: CellStyle,
  keys = '',
  value = '',
): LibItem => ({ id, name: { id: nameId, en: nameEn }, kind: 'vertex', w, h, style, keys, value });

const e = (id: string, nameId: string, nameEn: string, style: CellStyle, keys = ''): LibItem => ({
  id,
  name: { id: nameId, en: nameEn },
  kind: 'edge',
  w: 120,
  h: 0,
  style,
  keys,
});

/** Gaya teks bebas: tanpa isi dan garis. */
export const TEXT_STYLE: CellStyle = {
  baseStyleNames: ['text'],
  fillColor: 'none',
  strokeColor: 'none',
  align: 'center',
  verticalAlign: 'middle',
  whiteSpace: 'wrap',
};

export const GENERAL: LibGroup = {
  id: 'general',
  name: { id: 'Umum', en: 'General' },
  items: [
    v('rect', 'Persegi', 'Rectangle', 120, 60, { whiteSpace: 'wrap' }, 'kotak box'),
    v(
      'rounded',
      'Persegi membulat',
      'Rounded rectangle',
      120,
      60,
      { rounded: true, whiteSpace: 'wrap' },
      'kotak box rounded',
    ),
    v('ellipse', 'Elips', 'Ellipse', 120, 80, { shape: 'ellipse', whiteSpace: 'wrap' }, 'oval'),
    v(
      'circle',
      'Lingkaran',
      'Circle',
      80,
      80,
      { shape: 'ellipse', aspect: 'fixed', whiteSpace: 'wrap' },
      'bulat',
    ),
    v(
      'rhombus',
      'Belah ketupat',
      'Diamond',
      80,
      80,
      { shape: 'rhombus', whiteSpace: 'wrap' },
      'rhombus',
    ),
    v('triangle', 'Segitiga', 'Triangle', 60, 80, {
      shape: 'triangle',
      direction: 'north',
      whiteSpace: 'wrap',
    }),
    v('hexagon', 'Segi enam', 'Hexagon', 120, 80, { shape: 'hexagon', whiteSpace: 'wrap' }),
    v('parallelogram', 'Jajar genjang', 'Parallelogram', 120, 60, {
      shape: 'parallelogram',
      whiteSpace: 'wrap',
    }),
    v('trapezoid', 'Trapesium', 'Trapezoid', 120, 60, { shape: 'trapezoid', whiteSpace: 'wrap' }),
    v(
      'cylinder',
      'Tabung',
      'Cylinder',
      60,
      80,
      { shape: 'cylinder', whiteSpace: 'wrap' },
      'database',
    ),
    v('cloud', 'Awan', 'Cloud', 120, 80, { shape: 'cloud', whiteSpace: 'wrap' }, 'internet'),
    v(
      'actor',
      'Orang',
      'Person',
      30,
      60,
      { shape: 'actor', verticalLabelPosition: 'bottom', verticalAlign: 'top' },
      'aktor user pengguna',
    ),
    v(
      'note',
      'Catatan',
      'Note',
      80,
      100,
      { shape: 'note', whiteSpace: 'wrap', fillColor: '#fff9c4' },
      'memo',
    ),
    v(
      'callout',
      'Balon teks',
      'Callout',
      120,
      80,
      { shape: 'callout', whiteSpace: 'wrap', verticalAlign: 'top' },
      'komentar',
    ),
    v('step', 'Langkah', 'Step', 120, 60, { shape: 'step', whiteSpace: 'wrap' }, 'chevron'),
    v('singleArrow', 'Panah tebal', 'Block arrow', 100, 60, {
      shape: 'singleArrow',
      whiteSpace: 'wrap',
    }),
    v('doubleArrow', 'Panah dua arah', 'Double arrow', 100, 60, {
      shape: 'doubleArrow',
      whiteSpace: 'wrap',
    }),
    v('cross', 'Tanda tambah', 'Cross', 60, 60, { shape: 'cross' }, 'plus'),
    v('text', 'Teks', 'Text', 80, 30, TEXT_STYLE, 'label tulisan', 'Teks'),
    e('line', 'Garis', 'Line', { endArrow: 'none' }, 'konektor'),
    e('arrow', 'Panah', 'Arrow', {}, 'konektor'),
    e('biArrow', 'Panah dua arah', 'Two-way arrow', { startArrow: 'classic' }, 'konektor'),
    e('dashed', 'Panah putus-putus', 'Dashed arrow', { dashed: true }, 'konektor'),
    e('curved', 'Garis lengkung', 'Curved arrow', { curved: true, edgeStyle: 'none' }, 'konektor'),
  ],
};

export const FLOWCHART: LibGroup = {
  id: 'flowchart',
  name: { id: 'Flowchart', en: 'Flowchart' },
  items: [
    v(
      'fcTerminator',
      'Terminator (mulai/selesai)',
      'Terminator (start/end)',
      120,
      50,
      { rounded: true, arcSize: 50, whiteSpace: 'wrap' },
      'start end mulai selesai',
    ),
    v('fcProcess', 'Proses', 'Process', 120, 60, { whiteSpace: 'wrap' }),
    v(
      'fcDecision',
      'Keputusan',
      'Decision',
      100,
      80,
      { shape: 'rhombus', whiteSpace: 'wrap' },
      'kondisi if',
    ),
    v(
      'fcData',
      'Data (input/output)',
      'Data (input/output)',
      120,
      60,
      { shape: 'parallelogram', whiteSpace: 'wrap' },
      'io',
    ),
    v(
      'fcPredefined',
      'Proses terdefinisi',
      'Predefined process',
      120,
      60,
      { shape: 'process', whiteSpace: 'wrap' },
      'subrutin fungsi',
    ),
    v('fcDocument', 'Dokumen', 'Document', 120, 70, { shape: 'document', whiteSpace: 'wrap' }),
    v(
      'fcManualInput',
      'Input manual',
      'Manual input',
      120,
      60,
      { shape: 'manualInput', whiteSpace: 'wrap' },
      'keyboard',
    ),
    v('fcManualOp', 'Operasi manual', 'Manual operation', 120, 60, {
      shape: 'manualOperation',
      whiteSpace: 'wrap',
    }),
    v(
      'fcPreparation',
      'Persiapan',
      'Preparation',
      120,
      60,
      { shape: 'hexagon', whiteSpace: 'wrap' },
      'inisialisasi',
    ),
    v('fcDelay', 'Tunda', 'Delay', 100, 60, { shape: 'delay', whiteSpace: 'wrap' }),
    v(
      'fcConnector',
      'Penghubung',
      'Connector',
      40,
      40,
      { shape: 'ellipse', aspect: 'fixed', whiteSpace: 'wrap' },
      'on-page',
    ),
    v('fcOffPage', 'Penghubung halaman lain', 'Off-page connector', 50, 50, {
      shape: 'offPageConnector',
      whiteSpace: 'wrap',
    }),
    v(
      'fcDatabase',
      'Basis data',
      'Database',
      60,
      80,
      { shape: 'cylinder', whiteSpace: 'wrap' },
      'db',
    ),
    v('fcStored', 'Data tersimpan', 'Stored data', 120, 60, {
      shape: 'dataStorage',
      whiteSpace: 'wrap',
    }),
    v(
      'fcInternal',
      'Penyimpanan internal',
      'Internal storage',
      80,
      80,
      { shape: 'internalStorage', whiteSpace: 'wrap' },
      'memori',
    ),
    v(
      'fcDisplay',
      'Tampilan',
      'Display',
      120,
      60,
      { shape: 'display', whiteSpace: 'wrap' },
      'monitor layar',
    ),
    v(
      'fcLoop',
      'Batas perulangan',
      'Loop limit',
      120,
      60,
      { shape: 'loopLimit', whiteSpace: 'wrap' },
      'loop',
    ),
    v('fcCard', 'Kartu', 'Punched card', 100, 60, { shape: 'card', whiteSpace: 'wrap' }),
    v('fcTape', 'Pita', 'Punched tape', 120, 60, { shape: 'tape', whiteSpace: 'wrap' }),
    v('fcSum', 'Penjumlahan', 'Summing junction', 50, 50, { shape: 'sumEllipse' }),
    v('fcOr', 'Atau', 'Or', 50, 50, { shape: 'or' }),
    v('fcMerge', 'Gabung', 'Merge', 60, 50, { shape: 'merge' }),
    v('fcExtract', 'Ekstrak', 'Extract', 60, 50, { shape: 'extract' }),
    v('fcSort', 'Urutkan', 'Sort', 60, 60, { shape: 'sortShape' }),
    v('fcCollate', 'Susun', 'Collate', 60, 60, { shape: 'collate' }),
  ],
};

export const LIBRARY: LibGroup[] = [GENERAL, FLOWCHART];

/** Cari item di semua grup (nama dua bahasa + kata kunci). */
export function searchLibrary(groups: LibGroup[], q: string): LibItem[] {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>();
  const out: LibItem[] = [];
  for (const g of groups)
    for (const it of g.items) {
      const hay =
        `${it.name.id} ${it.name.en} ${it.keys ?? ''} ${g.name.id} ${g.name.en}`.toLowerCase();
      if (words.every((w) => hay.includes(w)) && !seen.has(it.id)) {
        seen.add(it.id);
        out.push(it);
      }
    }
  return out;
}
