/** Cek WHOIS (RDAP) lewat API Toolland: /api/tools/v1/whois. */

export interface WhoisInfo {
  found: true;
  domain: string;
  unicode_name: string | null;
  registered: string | null;
  expires: string | null;
  updated: string | null;
  status: string[];
  nameservers: string[];
  dnssec: boolean | null;
  registrar: {
    name: string | null;
    url: string | null;
    iana_id: string | null;
    abuse_email: string | null;
    abuse_phone: string | null;
  } | null;
  registrant: { organization: string | null; country: string | null } | null;
  source: string;
}

/** Domain belum terdaftar di registry (kemungkinan masih bisa dibeli). */
export interface WhoisFree {
  found: false;
  domain: string;
}

export type WhoisErrorCode =
  'invalid' | 'no_rdap' | 'upstream' | 'busy' | 'timeout' | 'rate_limit' | 'offline';

export class WhoisError extends Error {
  constructor(public code: WhoisErrorCode) {
    super(code);
  }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Ambil nama domain dari input apa pun: "contoh.co.id", "https://www.contoh.co.id/halaman",
 * atau email "nama@contoh.co.id". Domain beraksara non-Latin diubah ke punycode oleh URL.
 */
export function toDomain(input: string): string | null {
  let s = input.trim();
  if (!s || /\s/.test(s)) return null;
  // Email: ambil bagian setelah @.
  if (!s.includes('/') && s.includes('@')) s = s.slice(s.lastIndexOf('@') + 1);
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `http://${s}`;
  let host: string;
  try {
    host = new URL(s).hostname.replace(/\.$/, '');
  } catch {
    return null;
  }
  if (!host.includes('.') || IPV4.test(host) || host.startsWith('[')) return null;
  return host;
}

const BY_STATUS: Record<number, WhoisErrorCode> = {
  400: 'invalid',
  422: 'no_rdap',
  429: 'rate_limit',
  502: 'upstream',
  503: 'busy',
  504: 'timeout',
};

export async function lookupWhois(
  domain: string,
  signal?: AbortSignal,
): Promise<WhoisInfo | WhoisFree> {
  let res: Response;
  try {
    res = await fetch('/api/tools/v1/whois', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new WhoisError('offline');
  }
  if (res.ok) return (await res.json()) as WhoisInfo | WhoisFree;
  throw new WhoisError(BY_STATUS[res.status] ?? 'upstream');
}

/** Selisih hari dari sekarang ke tanggal (negatif bila sudah lewat). */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.floor((Date.parse(iso) - now) / 86_400_000);
}

/** Umur dalam tahun penuh sejak tanggal. */
export function yearsSince(iso: string, now = new Date()): number {
  const d = new Date(iso);
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  if (
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())
  )
    years--;
  return Math.max(0, years);
}

/** Kode status EPP/RDAP yang umum, untuk diterjemahkan di halaman. */
export const STATUS_KEYS: Record<string, string> = {
  active: 'active',
  ok: 'active',
  'client transfer prohibited': 'transferLock',
  'server transfer prohibited': 'transferLock',
  'client delete prohibited': 'deleteLock',
  'server delete prohibited': 'deleteLock',
  'client update prohibited': 'updateLock',
  'server update prohibited': 'updateLock',
  'client renew prohibited': 'renewLock',
  'server renew prohibited': 'renewLock',
  'client hold': 'hold',
  'server hold': 'hold',
  inactive: 'inactive',
  'pending delete': 'pendingDelete',
  'redemption period': 'redemption',
  'auto renew period': 'autoRenew',
  'pending transfer': 'pendingTransfer',
};
