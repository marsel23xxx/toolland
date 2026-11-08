/**
 * Cari subdomain secara pasif dari log Certificate Transparency (sertifikat SSL publik).
 * Browser pengguna menghubungi crt.sh langsung (cadangan: Certspotter), bukan lewat server
 * Toolland, jadi sumber data melihat IP masing-masing pengguna. Tetap dibatasi per orang
 * supaya pemakaian wajar dan tidak membebani layanan gratis tersebut.
 */

export type Source = 'crtsh' | 'certspotter';

export interface Subdomain {
  name: string;
  /** Tanggal berakhir sertifikat terbaru yang memuat nama ini (ISO), bila ada. */
  lastSeen: string | null;
}

export interface SubdomainResult {
  domain: string;
  source: Source;
  subdomains: Subdomain[];
}

export type SubdomainErrorCode = 'upstream' | 'busy' | 'timeout' | 'offline';

export class SubdomainError extends Error {
  constructor(public code: SubdomainErrorCode) {
    super(code);
  }
}

/** Batas pencarian per orang (per browser). */
export const SEARCH_LIMIT = 10;
export const SEARCH_WINDOW = 60 * 60 * 1000;
const TIMEOUT = 45_000;
/** Certspotter tanpa akun hanya memberi sedikit kuota; ambil beberapa halaman saja. */
const CERTSPOTTER_PAGES = 3;

/** Rapikan satu nama dari sertifikat; null bila bukan bagian dari domain yang dicari. */
export function cleanName(raw: string, domain: string): string | null {
  const n = raw.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9_.-]+$/.test(n) || n.includes('..')) return null;
  return n === domain || n.endsWith(`.${domain}`) ? n : null;
}

/** Gabungkan nama-nama dari banyak sertifikat: tanpa duplikat, simpan tanggal terbaru. */
export function collect(
  certs: { names: string[]; notAfter?: string | null }[],
  domain: string,
): Subdomain[] {
  const map = new Map<string, string | null>();
  for (const c of certs) {
    const date = c.notAfter && !Number.isNaN(Date.parse(c.notAfter)) ? c.notAfter : null;
    for (const raw of c.names) {
      const name = cleanName(raw, domain);
      if (!name) continue;
      const prev = map.get(name);
      if (prev === undefined || (date && (!prev || Date.parse(date) > Date.parse(prev))))
        map.set(name, date ?? prev ?? null);
    }
  }
  return [...map]
    .map(([name, lastSeen]) => ({ name, lastSeen }))
    .sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
}

// Urut per label dari belakang supaya a.api.x.com berdekatan dengan api.x.com.
const sortKey = (n: string) => n.split('.').reverse().join('\u0000');

/** Format JSON crt.sh: [{ name_value: "a.x.com\nb.x.com", not_after: "2025-01-01T00:00:00" }]. */
export function parseCrtsh(json: unknown, domain: string): Subdomain[] {
  if (!Array.isArray(json)) throw new SubdomainError('upstream');
  return collect(
    json.map((r: { name_value?: unknown; common_name?: unknown; not_after?: unknown }) => ({
      names: [r.name_value, r.common_name]
        .filter((v): v is string => typeof v === 'string')
        .flatMap((v) => v.split('\n')),
      // crt.sh memberi waktu UTC tanpa zona.
      notAfter: typeof r.not_after === 'string' ? `${r.not_after.replace(/Z?$/, '')}Z` : null,
    })),
    domain,
  );
}

/** Format JSON Certspotter: [{ id, dns_names: [...], not_after: "..." }]. */
export function parseCertspotter(
  json: unknown,
): { names: string[]; notAfter: string | null; id: string }[] {
  if (!Array.isArray(json)) throw new SubdomainError('upstream');
  return json.map((r: { id?: unknown; dns_names?: unknown; not_after?: unknown }) => ({
    id: String(r.id ?? ''),
    names: Array.isArray(r.dns_names) ? r.dns_names.filter((n) => typeof n === 'string') : [],
    notAfter: typeof r.not_after === 'string' ? r.not_after : null,
  }));
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  // Gabungan "dibatalkan pengguna" dan batas waktu (AbortSignal.any belum ada di browser lama).
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT);
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch (e) {
      if (signal.aborted) throw e;
      throw new SubdomainError(timedOut ? 'timeout' : 'offline');
    }
    if (res.status === 429) throw new SubdomainError('busy');
    if (!res.ok) throw new SubdomainError('upstream');
    try {
      return await res.json();
    } catch (e) {
      if (signal.aborted) throw e;
      throw new SubdomainError(timedOut ? 'timeout' : 'upstream');
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

async function fromCrtsh(domain: string, signal: AbortSignal) {
  const json = await getJson(
    `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`,
    signal,
  );
  return parseCrtsh(json, domain);
}

async function fromCertspotter(domain: string, signal: AbortSignal) {
  const all: { names: string[]; notAfter: string | null }[] = [];
  let after = '';
  for (let page = 0; page < CERTSPOTTER_PAGES; page++) {
    const url =
      `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}` +
      `&include_subdomains=true&expand=dns_names${after ? `&after=${after}` : ''}`;
    const items = parseCertspotter(await getJson(url, signal));
    all.push(...items);
    if (!items.length) break;
    after = encodeURIComponent(items[items.length - 1].id);
  }
  return collect(all, domain);
}

/**
 * Cari subdomain. crt.sh lebih lengkap (termasuk sertifikat lama) tapi sering gagal untuk
 * domain besar; bila gagal, pakai Certspotter (hanya sertifikat yang masih berlaku).
 */
export async function findSubdomains(
  domain: string,
  signal: AbortSignal,
): Promise<SubdomainResult> {
  try {
    return { domain, source: 'crtsh', subdomains: await fromCrtsh(domain, signal) };
  } catch (e) {
    if (signal.aborted) throw e;
    try {
      return { domain, source: 'certspotter', subdomains: await fromCertspotter(domain, signal) };
    } catch (e2) {
      if (signal.aborted) throw e2;
      // Error crt.sh biasanya lebih bermakna kecuali Certspotter membatasi kuota.
      if (e2 instanceof SubdomainError && e2.code === 'busy') throw e2;
      throw e instanceof SubdomainError ? e : new SubdomainError('upstream');
    }
  }
}

/** Domain yang dicari: "www." di depan dibuang karena yang dicari subdomain milik domainnya. */
export function searchDomain(host: string): string {
  const d = host.toLowerCase();
  return d.startsWith('www.') && d.split('.').length > 2 ? d.slice(4) : d;
}

// --- Batas pemakaian per orang ---

const KEY = 'toolland.subdomain.searches';

/**
 * Hitung pencarian per jam di localStorage (bertahan walau tab ditutup). Bila penyimpanan
 * tidak bisa dipakai (mode privat dsb.), hitungan disimpan di memori halaman saja.
 */
export class SearchLimiter {
  private memory: number[] = [];

  constructor(
    private storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
    private limit = SEARCH_LIMIT,
    private window = SEARCH_WINDOW,
  ) {}

  private load(now: number): number[] {
    let list = this.memory;
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed.filter((t): t is number => typeof t === 'number');
      }
    } catch {
      // Pakai hitungan di memori.
    }
    // Waktu di masa depan (jam perangkat dimundurkan) juga dibuang.
    return list.filter((t) => t <= now && now - t < this.window);
  }

  private save(list: number[]) {
    this.memory = list;
    try {
      this.storage?.setItem(KEY, JSON.stringify(list));
    } catch {
      // Tetap ada di memori.
    }
  }

  remaining(now = Date.now()): number {
    return Math.max(0, this.limit - this.load(now).length);
  }

  /** Milidetik sampai satu jatah pencarian kembali (0 bila masih ada jatah). */
  waitMs(now = Date.now()): number {
    const list = this.load(now);
    if (list.length < this.limit) return 0;
    return Math.min(...list) + this.window - now;
  }

  /** Pakai satu jatah; false bila jatah habis. */
  take(now = Date.now()): boolean {
    const list = this.load(now);
    if (list.length >= this.limit) return false;
    this.save([...list, now]);
    return true;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
