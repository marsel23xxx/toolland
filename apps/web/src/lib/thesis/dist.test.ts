import { describe, expect, it } from 'vitest';
import {
  chiCrit,
  chiUpper,
  fCrit,
  fUpper,
  lnGamma,
  rCrit,
  rTwoTail,
  tCrit,
  tTwoTail,
} from './dist';

/** Bulatkan seperti tabel cetak. */
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const r3 = (x: number) => Math.round(x * 1e3) / 1e3;
const r2 = (x: number) => Math.round(x * 1e2) / 1e2;

describe('fungsi dasar', () => {
  it('ln Γ', () => {
    expect(lnGamma(1)).toBeCloseTo(0, 12);
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
  });
});

describe('tabel t', () => {
  it('cocok dengan tabel baku', () => {
    expect(r4(tCrit(0.05, 1))).toBe(12.7062);
    expect(r4(tCrit(0.05, 10))).toBe(2.2281);
    expect(r4(tCrit(0.05, 30))).toBe(2.0423);
    expect(r4(tCrit(0.01, 20))).toBe(2.8453);
    expect(r4(tCrit(0.05, 20, 1))).toBe(1.7247);
    expect(r4(tCrit(0.001, 5))).toBe(6.8688);
    expect(r3(tCrit(0.001, 1))).toBe(636.619);
    expect(r4(tCrit(0.05, 1000))).toBe(1.9623);
  });

  it('nilai p kebalikan nilai kritis', () => {
    expect(tTwoTail(tCrit(0.05, 17), 17)).toBeCloseTo(0.05, 12);
    expect(tTwoTail(0, 5)).toBeCloseTo(1, 12);
  });
});

describe('tabel r', () => {
  it('cocok dengan tabel r product moment (df = N − 2)', () => {
    expect(r4(rCrit(0.05, 1))).toBe(0.9969);
    expect(r4(rCrit(0.05, 28))).toBe(0.361);
    expect(r4(rCrit(0.05, 18))).toBe(0.4438);
    expect(r4(rCrit(0.01, 28))).toBe(0.4629);
    expect(r4(rCrit(0.05, 28, 1))).toBe(0.3061);
    expect(r4(rCrit(0.05, 98))).toBe(0.1966);
  });

  it('nilai p', () => {
    expect(rTwoTail(rCrit(0.05, 28), 28)).toBeCloseTo(0.05, 10);
    expect(rTwoTail(1, 10)).toBeLessThan(1e-6);
  });
});

describe('tabel F', () => {
  it('cocok dengan tabel F baku', () => {
    expect(r2(fCrit(0.05, 1, 1))).toBe(161.45);
    expect(r4(fCrit(0.05, 3, 20))).toBe(3.0984);
    expect(r4(fCrit(0.05, 2, 30))).toBe(3.3158);
    expect(r4(fCrit(0.01, 2, 10))).toBe(7.5594);
    expect(r2(fCrit(0.01, 1, 1))).toBe(4052.18);
    expect(r2(fCrit(0.05, 15, 100))).toBe(1.77);
  });

  it('nilai p', () => {
    expect(fUpper(fCrit(0.05, 4, 40), 4, 40)).toBeCloseTo(0.05, 12);
    expect(fUpper(0, 3, 3)).toBe(1);
  });
});

describe('tabel chi-kuadrat', () => {
  it('cocok dengan tabel baku', () => {
    expect(r4(chiCrit(0.05, 1))).toBe(3.8415);
    expect(r3(chiCrit(0.05, 10))).toBe(18.307);
    expect(r3(chiCrit(0.01, 5))).toBe(15.086);
    expect(r3(chiCrit(0.1, 30))).toBe(40.256);
    expect(r3(chiCrit(0.95, 10))).toBe(3.94);
    expect(chiCrit(0.995, 1)).toBeCloseTo(0.0000393, 7);
    expect(r3(chiCrit(0.05, 100))).toBe(124.342);
  });

  it('nilai p', () => {
    expect(chiUpper(chiCrit(0.025, 7), 7)).toBeCloseTo(0.025, 12);
  });
});
