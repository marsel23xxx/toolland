import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanName,
  collect,
  findSubdomains,
  parseCrtsh,
  SearchLimiter,
  searchDomain,
  SubdomainError,
} from './subdomains';

describe('subdomains', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('membersihkan nama dari sertifikat', () => {
    expect(cleanName('*.Api.Contoh.com.', 'contoh.com')).toBe('api.contoh.com');
    expect(cleanName('contoh.com', 'contoh.com')).toBe('contoh.com');
    expect(cleanName('bukancontoh.com', 'contoh.com')).toBeNull();
    expect(cleanName('admin@contoh.com', 'contoh.com')).toBeNull();
    expect(cleanName('a..contoh.com', 'contoh.com')).toBeNull();
  });

  it('crt.sh: tanpa duplikat, tanggal terbaru, urut per bagian domain', () => {
    const list = parseCrtsh(
      [
        { name_value: 'www.contoh.com\ncontoh.com', not_after: '2024-01-01T00:00:00' },
        { name_value: '*.api.contoh.com\nwww.contoh.com', not_after: '2026-05-01T12:00:00' },
        { common_name: 'mail.contoh.com', name_value: 'lain.org', not_after: 'bukan tanggal' },
      ],
      'contoh.com',
    );
    expect(list.map((s) => s.name)).toEqual([
      'contoh.com',
      'api.contoh.com',
      'mail.contoh.com',
      'www.contoh.com',
    ]);
    expect(list.find((s) => s.name === 'www.contoh.com')?.lastSeen).toBe('2026-05-01T12:00:00Z');
    expect(list.find((s) => s.name === 'mail.contoh.com')?.lastSeen).toBeNull();
    expect(() => parseCrtsh({ error: 'x' }, 'contoh.com')).toThrow(SubdomainError);
  });

  it('tanggal lama tidak menimpa tanggal yang lebih baru', () => {
    const list = collect(
      [
        { names: ['a.x.id'], notAfter: '2026-01-01T00:00:00Z' },
        { names: ['a.x.id'], notAfter: '2020-01-01T00:00:00Z' },
        { names: ['a.x.id'], notAfter: null },
      ],
      'x.id',
    );
    expect(list).toEqual([{ name: 'a.x.id', lastSeen: '2026-01-01T00:00:00Z' }]);
  });

  it('www. di depan dibuang', () => {
    expect(searchDomain('www.contoh.co.id')).toBe('contoh.co.id');
    expect(searchDomain('WWW.Contoh.com')).toBe('contoh.com');
    expect(searchDomain('www.id')).toBe('www.id');
    expect(searchDomain('api.contoh.com')).toBe('api.contoh.com');
  });

  it('crt.sh gagal: pindah ke Certspotter (beberapa halaman)', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      if (url.startsWith('https://crt.sh/')) return new Response('', { status: 502 });
      const page = url.includes('after=2')
        ? []
        : url.includes('after=1')
          ? [{ id: '2', dns_names: ['b.x.id'], not_after: '2027-01-01T00:00:00Z' }]
          : [{ id: '1', dns_names: ['*.a.x.id', 'x.id'], not_after: '2027-01-01T00:00:00Z' }];
      return Response.json(page);
    });
    const res = await findSubdomains('x.id', new AbortController().signal);
    expect(res.source).toBe('certspotter');
    expect(res.subdomains.map((s) => s.name)).toEqual(['x.id', 'a.x.id', 'b.x.id']);
    expect(calls[0]).toBe('https://crt.sh/?q=%25.x.id&output=json');
    expect(calls).toHaveLength(4);
  });

  it('kedua sumber gagal: error dari crt.sh, kecuali Certspotter membatasi kuota', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 502 }));
    await expect(findSubdomains('x.id', new AbortController().signal)).rejects.toEqual(
      new SubdomainError('upstream'),
    );
    vi.stubGlobal(
      'fetch',
      async (url: string) =>
        new Response('', { status: url.startsWith('https://crt.sh/') ? 502 : 429 }),
    );
    await expect(findSubdomains('x.id', new AbortController().signal)).rejects.toEqual(
      new SubdomainError('busy'),
    );
  });

  it('batas per orang: 10 per jam, jatah kembali setelah satu jam', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const lim = new SearchLimiter(storage, 10, 3_600_000);
    const t0 = 1_000_000_000;
    for (let i = 0; i < 10; i++) expect(lim.take(t0 + i * 1000)).toBe(true);
    expect(lim.take(t0 + 20_000)).toBe(false);
    expect(lim.remaining(t0 + 20_000)).toBe(0);
    expect(lim.waitMs(t0 + 20_000)).toBe(3_600_000 - 20_000);
    // Tab baru (objek baru) membaca hitungan yang sama.
    expect(new SearchLimiter(storage, 10, 3_600_000).remaining(t0 + 20_000)).toBe(0);
    expect(lim.remaining(t0 + 3_600_000)).toBe(1);
    expect(lim.take(t0 + 3_600_000)).toBe(true);
  });

  it('batas tetap jalan tanpa localStorage atau bila datanya rusak', () => {
    const noStore = new SearchLimiter(null, 2, 1000);
    expect(noStore.take(5)).toBe(true);
    expect(noStore.take(6)).toBe(true);
    expect(noStore.take(7)).toBe(false);
    const broken = {
      getItem: () => '{rusak',
      setItem: () => {
        throw new Error('penuh');
      },
    };
    const lim = new SearchLimiter(broken, 2, 1000);
    expect(lim.take(5)).toBe(true);
    expect(lim.take(6)).toBe(true);
    expect(lim.take(7)).toBe(false);
  });
});
