/**
 * Distribusi t, F, chi-kuadrat, dan r (korelasi Pearson) untuk Tabel Statistik: peluang ekor
 * (nilai p) dan nilai kritis (kebalikannya). Dihitung dengan fungsi beta dan gamma tak lengkap,
 * akurat sampai belasan digit, sehingga cocok dengan tabel cetak di buku statistik.
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** ln Γ(x) untuk x > 0 (Lanczos, g = 7). */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

const FPMIN = 1e-300;
const EPS = 1e-15;

function betaCf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Fungsi beta tak lengkap teregularisasi I_x(a, b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaCf(a, b, x)) / a
    : 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

/** Fungsi gamma tak lengkap atas teregularisasi Q(a, x). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const gln = lnGamma(a);
  if (x < a + 1) {
    // Deret untuk P(a, x), lalu Q = 1 − P.
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 1000; n++) {
      ap++;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  // Pecahan berlanjut untuk Q(a, x).
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

// --- Peluang ekor (nilai p) ---------------------------------------------------------------------

/** P(|T| ≥ |t|) dua sisi untuk distribusi t dengan derajat bebas df. */
export function tTwoTail(t: number, df: number): number {
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

/** P(F ≥ f) untuk distribusi F(df1, df2). */
export function fUpper(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1;
  return betaInc(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);
}

/** P(χ² ≥ x) untuk distribusi chi-kuadrat dengan derajat bebas df. */
export function chiUpper(x: number, df: number): number {
  return gammaQ(df / 2, x / 2);
}

/** Ubah r Pearson ke t (df = N − 2). */
export function rToT(r: number, df: number): number {
  const rr = Math.min(Math.abs(r), 1 - 1e-15);
  return rr * Math.sqrt(df / (1 - rr * rr));
}

/** P(|R| ≥ |r|) dua sisi untuk korelasi Pearson dengan df = N − 2. */
export function rTwoTail(r: number, df: number): number {
  return tTwoTail(rToT(r, df), df);
}

// --- Nilai kritis ---------------------------------------------------------------------------------

/** Cari u ∈ (0, 1) dengan f(u) = target, f naik monoton. */
function bisect01(f: (u: number) => number, target: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Nilai kritis t: P(|T| ≥ t) = alpha (dua sisi), atau P(T ≥ t) = alpha (satu sisi). */
export function tCrit(alpha: number, df: number, tails: 1 | 2 = 2): number {
  const a2 = tails === 1 ? alpha * 2 : alpha;
  const u = bisect01((v) => betaInc(v, df / 2, 0.5), a2);
  return Math.sqrt((df * (1 - u)) / u);
}

/** Nilai kritis F: P(F ≥ f) = alpha. */
export function fCrit(alpha: number, df1: number, df2: number): number {
  const u = bisect01((v) => betaInc(v, df2 / 2, df1 / 2), alpha);
  return (df2 * (1 - u)) / (df1 * u);
}

/** Nilai kritis chi-kuadrat: P(χ² ≥ x) = alpha. */
export function chiCrit(alpha: number, df: number): number {
  // Bagi dua pada skala logaritma supaya nilai sangat kecil (α = 0,995) tetap teliti.
  let lo = Math.log(1e-12);
  let hi = Math.log(Math.max(10, df * 10 + 100));
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (chiUpper(Math.exp(mid), df) > alpha) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

/** Nilai kritis r Pearson (df = N − 2). */
export function rCrit(alpha: number, df: number, tails: 1 | 2 = 2): number {
  const t = tCrit(alpha, df, tails);
  return t / Math.sqrt(df + t * t);
}
