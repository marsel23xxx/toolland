import { describe, expect, it } from 'vitest';
import { planVideo, scrollAt, wrapLines, type PrompterVideoOptions } from './prompter-video';

// Ukuran palsu: setiap karakter 10 px.
const measure = (s: string) => s.length * 10;

const base: PrompterVideoOptions = {
  text: '',
  width: 1920,
  height: 1080,
  fps: 30,
  fontPx: 40,
  textWidthPct: 80,
  align: 'center',
  theme: 'dark',
  mirror: false,
  flip: false,
  guide: true,
  pxPerSec: 60,
  holdStart: 2,
  holdEnd: 2,
};

describe('wrapLines', () => {
  it('memecah per kata sesuai lebar dan mempertahankan enter', () => {
    expect(wrapLines('satu dua tiga empat\n\nlima', measure, 100)).toEqual([
      'satu dua',
      'tiga empat',
      '',
      'lima',
    ]);
  });

  it('memotong kata yang lebih panjang dari satu baris', () => {
    expect(wrapLines('abcdefghijkl', measure, 50)).toEqual(['abcde', 'fghij', 'kl']);
  });

  it('membuang baris kosong di awal dan akhir', () => {
    expect(wrapLines('\n\n halo \n\n', measure, 100)).toEqual(['halo']);
  });
});

describe('planVideo dan scrollAt', () => {
  it('durasi = jeda awal + jarak gulir / kecepatan + jeda akhir', () => {
    const plan = planVideo(base, 11);
    expect(plan.lineH).toBe(60);
    expect(plan.distance).toBe(600);
    expect(plan.duration).toBe(2 + 10 + 2);
    expect(plan.frames).toBe(420);
  });

  it('diam di awal, bergulir rata, berhenti di akhir', () => {
    const plan = planVideo(base, 11);
    expect(scrollAt(1, base, plan)).toBe(0);
    expect(scrollAt(7, base, plan)).toBe(300);
    expect(scrollAt(13, base, plan)).toBe(600);
  });

  it('satu baris tetap menghasilkan video sepanjang jeda', () => {
    const plan = planVideo(base, 1);
    expect(plan.distance).toBe(0);
    expect(plan.duration).toBe(4);
  });
});
