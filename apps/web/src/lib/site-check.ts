/**
 * Cek Website lewat API Toolland (/api/tools/v1/site-check). Server hanya mengambil fakta mentah
 * dari halaman depan situs; penilaian keamanan di file ini, deteksi teknologi di tech-detect.ts.
 */

export interface SiteCert {
  subject: string | null;
  issuer: string | null;
  sans: string[];
  /** Detik Unix. */
  not_before: number | null;
  not_after: number | null;
}

export interface SiteScan {
  host: string;
  final_url: string;
  status: number;
  ip: string | null;
  redirects: { url: string; status: number }[];
  http_to_https: boolean | null;
  tls: {
    version: string | null;
    valid: boolean;
    error: 'expired' | 'name' | 'issuer' | 'other' | null;
    cert: SiteCert | null;
  } | null;
  headers: [string, string][];
  cookies: { name: string; secure: boolean; http_only: boolean; same_site: string | null }[];
  html: string;
  html_truncated: boolean;
  security_txt: boolean;
  dns: { ok: boolean; spf: string | null; dmarc: string | null; caa: string[] };
}

export type SiteErrorCode =
  | 'invalid'
  | 'blocked'
  | 'unreachable'
  | 'timeout'
  | 'busy'
  | 'rate_limit'
  | 'offline'
  | 'upstream';

export class SiteError extends Error {
  constructor(public code: SiteErrorCode) {
    super(code);
  }
}

const BY_STATUS: Record<number, SiteErrorCode> = {
  400: 'invalid',
  403: 'blocked',
  429: 'rate_limit',
  502: 'unreachable',
  503: 'busy',
  504: 'timeout',
};

export async function scanSite(host: string, signal?: AbortSignal): Promise<SiteScan> {
  let res: Response;
  try {
    res = await fetch('/api/tools/v1/site-check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new SiteError('offline');
  }
  if (res.ok) return (await res.json()) as SiteScan;
  throw new SiteError(BY_STATUS[res.status] ?? 'upstream');
}

/** Header digabung per nama (huruf kecil), seperti cara browser membacanya. */
export function headerMap(scan: Pick<SiteScan, 'headers'>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of scan.headers) {
    const key = k.toLowerCase();
    map.set(key, map.has(key) ? `${map.get(key)}, ${v}` : v);
  }
  return map;
}

/** Nilai atribut `content` dari tag <meta> dengan name/http-equiv tertentu. */
export function metaContent(html: string, attr: 'name' | 'http-equiv', value: string): string[] {
  const out: string[] = [];
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = /<meta\b[^>]*>/gi;
  const key = new RegExp(`\\b${attr}\\s*=\\s*["']?${esc}["'\\s/>]`, 'i');
  const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
  for (const m of html.matchAll(tag)) {
    if (!key.test(m[0])) continue;
    const c = content.exec(m[0]);
    if (c) out.push(c[1] ?? c[2] ?? c[3] ?? '');
  }
  return out;
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type CheckId =
  | 'https'
  | 'redirect'
  | 'cert'
  | 'tls'
  | 'hsts'
  | 'csp'
  | 'frame'
  | 'nosniff'
  | 'referrer'
  | 'permissions'
  | 'cookies'
  | 'disclosure'
  | 'mixed'
  | 'securitytxt'
  | 'spf'
  | 'dmarc'
  | 'caa';

export interface Check {
  id: CheckId;
  status: CheckStatus;
  /** Varian pesan (misalnya alasan sertifikat tidak valid). */
  variant?: string;
  /** Isian untuk pesan, misalnya {days} atau {names}. */
  data?: Record<string, string | number>;
}

/** Bobot tiap pemeriksaan dalam skor. Pemeriksaan berstatus info tidak dihitung. */
export const WEIGHTS: Record<CheckId, number> = {
  https: 25,
  redirect: 10,
  cert: 20,
  tls: 5,
  hsts: 10,
  csp: 10,
  frame: 5,
  nosniff: 4,
  referrer: 3,
  permissions: 0,
  cookies: 4,
  disclosure: 3,
  mixed: 5,
  securitytxt: 0,
  spf: 3,
  dmarc: 4,
  caa: 0,
};

const HALF_YEAR = 180 * 24 * 3600;
const DAY = 86_400;

/** Arahan CSP dari header dan tag meta, digabung: nama arahan -> nilai. */
function cspDirectives(policies: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of policies)
    for (const part of p.split(';')) {
      const [name, ...rest] = part.trim().split(/\s+/);
      if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), rest.join(' '));
    }
  return map;
}

const MIXED = [
  /<(?:script|img|iframe|source|video|audio|embed)\b[^>]*\ssrc\s*=\s*["']?http:\/\//i,
  /<link\b(?=[^>]*\brel\s*=\s*["']?stylesheet)[^>]*\shref\s*=\s*["']?http:\/\//i,
];

export function securityChecks(scan: SiteScan, now = Date.now() / 1000): Check[] {
  const h = headerMap(scan);
  const html = scan.html;
  const https = scan.final_url.startsWith('https://');
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  add({ id: 'https', status: https ? 'pass' : 'fail' });

  if (scan.http_to_https === null) add({ id: 'redirect', status: 'info', variant: 'closed' });
  else add({ id: 'redirect', status: scan.http_to_https ? 'pass' : https ? 'fail' : 'info' });

  if (https && scan.tls) {
    const end = scan.tls.cert?.not_after ?? null;
    const days = end === null ? null : Math.floor((end - now) / DAY);
    if (!scan.tls.valid) add({ id: 'cert', status: 'fail', variant: scan.tls.error ?? 'other' });
    else if (days !== null && days <= 14) add({ id: 'cert', status: 'warn', data: { days } });
    else add({ id: 'cert', status: 'pass', data: { days: days ?? '?' } });

    const v = scan.tls.version;
    if (v) add({ id: 'tls', status: /1\.[23]$/.test(v) ? 'pass' : 'fail', data: { version: v } });

    const hsts = h.get('strict-transport-security');
    const age = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts ?? '')?.[1] ?? 0);
    add({
      id: 'hsts',
      status: !hsts || age === 0 ? 'fail' : age >= HALF_YEAR ? 'pass' : 'warn',
      data: { days: age > 0 && age < DAY ? '< 1' : Math.round(age / DAY) },
    });
  }

  const cspHeader = h.get('content-security-policy');
  const cspMeta = metaContent(html, 'http-equiv', 'content-security-policy');
  const csp = cspDirectives([...(cspHeader ? [cspHeader] : []), ...cspMeta]);
  const scriptSrc = csp.get('script-src') ?? csp.get('default-src');
  if (scriptSrc !== undefined) {
    const unsafe =
      /'unsafe-inline'/.test(scriptSrc) &&
      !/'nonce-|'sha(256|384|512)-|'strict-dynamic'/.test(scriptSrc);
    add({ id: 'csp', status: unsafe ? 'warn' : 'pass', variant: unsafe ? 'unsafe' : undefined });
  } else if (csp.size || h.has('content-security-policy-report-only')) {
    add({ id: 'csp', status: 'warn', variant: 'partial' });
  } else add({ id: 'csp', status: 'fail' });

  // frame-ancestors hanya berlaku dari header, bukan tag meta.
  const xfo = (h.get('x-frame-options') ?? '').toLowerCase();
  const ancestors = cspHeader ? cspDirectives([cspHeader]).has('frame-ancestors') : false;
  add({
    id: 'frame',
    status: ancestors || /deny|sameorigin/.test(xfo) ? 'pass' : 'warn',
  });

  add({
    id: 'nosniff',
    status: /nosniff/i.test(h.get('x-content-type-options') ?? '') ? 'pass' : 'warn',
  });

  const referrer = h.get('referrer-policy') ?? metaContent(html, 'name', 'referrer')[0];
  add({
    id: 'referrer',
    status: referrer && !/unsafe-url/i.test(referrer) ? 'pass' : 'warn',
  });

  add({ id: 'permissions', status: h.has('permissions-policy') ? 'pass' : 'info' });

  if (scan.cookies.length) {
    const insecure = https ? scan.cookies.filter((c) => !c.secure).map((c) => c.name) : [];
    add({
      id: 'cookies',
      status: insecure.length ? 'warn' : 'pass',
      data: { names: insecure.join(', '), n: scan.cookies.length },
    });
  }

  const leaks = [
    ['server', h.get('server')],
    ['x-powered-by', h.get('x-powered-by')],
    ['x-aspnet-version', h.get('x-aspnet-version')],
    ['x-aspnetmvc-version', h.get('x-aspnetmvc-version')],
  ]
    .filter(([k, v]) => v && (k !== 'server' || /\d/.test(v)))
    .map(([k, v]) => `${k}: ${v}`);
  add({
    id: 'disclosure',
    status: leaks.length ? 'warn' : 'pass',
    data: { values: leaks.join(' · ') },
  });

  if (https) add({ id: 'mixed', status: MIXED.some((r) => r.test(html)) ? 'warn' : 'pass' });

  add({ id: 'securitytxt', status: scan.security_txt ? 'pass' : 'info' });

  if (scan.dns.ok) {
    const spf = scan.dns.spf;
    add({
      id: 'spf',
      status: !spf ? 'warn' : /[+?]all\s*$/i.test(spf) ? 'fail' : 'pass',
      variant: spf && /[+?]all\s*$/i.test(spf) ? 'open' : undefined,
    });
    const policy = /\bp\s*=\s*(\w+)/i.exec(scan.dns.dmarc ?? '')?.[1]?.toLowerCase();
    add({
      id: 'dmarc',
      status: !scan.dns.dmarc
        ? 'warn'
        : policy === 'reject' || policy === 'quarantine'
          ? 'pass'
          : 'warn',
      variant:
        scan.dns.dmarc && policy !== 'reject' && policy !== 'quarantine' ? 'none' : undefined,
      data: { policy: policy ?? '' },
    });
    add({ id: 'caa', status: scan.dns.caa.length ? 'pass' : 'info' });
  }
  return checks;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Skor 0-100 dari pemeriksaan berbobot; tanpa https atau sertifikat valid langsung F. */
export function score(checks: Check[]): { score: number; grade: Grade } {
  let got = 0;
  let max = 0;
  for (const c of checks) {
    const w = WEIGHTS[c.id];
    if (!w || c.status === 'info') continue;
    max += w;
    got += c.status === 'pass' ? w : c.status === 'warn' ? w / 2 : 0;
  }
  const s = max ? Math.round((100 * got) / max) : 0;
  const fatal = checks.some((c) => (c.id === 'https' || c.id === 'cert') && c.status === 'fail');
  const grade: Grade = fatal
    ? 'F'
    : s >= 90
      ? 'A'
      : s >= 80
        ? 'B'
        : s >= 70
          ? 'C'
          : s >= 60
            ? 'D'
            : 'F';
  return { score: fatal ? Math.min(s, 49) : s, grade };
}
