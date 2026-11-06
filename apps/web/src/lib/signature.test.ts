import { describe, expect, it } from 'vitest';
import {
  inkAngle,
  inkMask,
  principalAngle,
  resample,
  smooth,
  tidyStrokes,
  type Stroke,
} from './signature';

const deg = (r: number) => (r * 180) / Math.PI;

/** Garis lurus dengan kemiringan tertentu, plus getaran seperti mouse. */
function shakyLine(angleDeg: number, jitter = 3): Stroke {
  const a = (angleDeg * Math.PI) / 180;
  return Array.from({ length: 120 }, (_, i) => {
    const t = i * 3;
    const wobble = i % 2 ? jitter : -jitter;
    return {
      x: 50 + t * Math.cos(a) - wobble * Math.sin(a),
      y: 200 + t * Math.sin(a) + wobble * Math.cos(a),
    };
  });
}

function strokeAngle(s: Stroke) {
  return deg(
    principalAngle(
      s.map((p) => p.x),
      s.map((p) => p.y),
    ),
  );
}

describe('signature', () => {
  it('resample menghasilkan jarak titik yang rata dan ujung tetap', () => {
    const out = resample(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      2,
    );
    expect(out.map((p) => p.x)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('smooth meredam getaran tanpa menggeser ujung goresan', () => {
    const line = shakyLine(0);
    const out = smooth(smooth(line, 4), 3);
    expect(out[0]).toEqual(line[0]);
    expect(out.at(-1)).toEqual(line.at(-1));
    const mid = out.slice(10, -10);
    expect(Math.max(...mid.map((p) => Math.abs(p.y - 200)))).toBeLessThan(1);
  });

  it('meluruskan ttd yang miring 15 derajat', () => {
    const [out] = tidyStrokes([shakyLine(-15)]);
    expect(Math.abs(strokeAngle(out))).toBeLessThan(1);
  });

  it('tidak memutar ttd yang sudah lurus atau yang miringnya tidak wajar', () => {
    expect(Math.abs(strokeAngle(tidyStrokes([shakyLine(1)])[0]) - 1)).toBeLessThan(0.5);
    expect(Math.abs(strokeAngle(tidyStrokes([shakyLine(50)])[0]) - 50)).toBeLessThan(0.5);
  });

  it('titik tunggal (misalnya titik di atas huruf i) tetap ada', () => {
    const out = tidyStrokes([shakyLine(0), [{ x: 10, y: 10 }]]);
    expect(out).toHaveLength(2);
    expect(out[1]).toHaveLength(1);
  });

  it('inkMask memisahkan tinta dari kertas yang terkena bayangan', () => {
    const w = 200,
      h = 100;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        // kertas makin gelap ke kanan (bayangan), garis tinta di y=50
        const paper = 240 - x * 0.6;
        const v = Math.abs(y - 50) < 2 ? 60 : paper;
        px.set([v, v, v, 255], (y * w + x) * 4);
      }
    const mask = inkMask(px, w, h);
    expect(mask[50 * w + 20]).toBe(255);
    expect(mask[50 * w + 180]).toBe(255);
    expect(mask[10 * w + 180]).toBe(0);
    expect(mask[90 * w + 20]).toBe(0);
    expect(Math.abs(deg(inkAngle(mask, w, h)))).toBeLessThan(1);
  });
});
