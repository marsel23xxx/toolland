import { describe, expect, it } from 'vitest';
import { type Check, metaContent, score, securityChecks, type SiteScan } from './site-check';
import { detectTech } from './tech-detect';

const NOW = Date.parse('2026-11-14T00:00:00Z') / 1000;
const DAY = 86_400;

/** Situs yang dikonfigurasi dengan baik; tiap tes mengubah sebagian. */
function site(over: Partial<SiteScan> = {}): SiteScan {
  return {
    host: 'contoh.co.id',
    final_url: 'https://contoh.co.id/',
    status: 200,
    ip: '203.0.113.10',
    redirects: [],
    http_to_https: true,
    tls: {
      version: 'TLS 1.3',
      valid: true,
      error: null,
      cert: {
        subject: 'contoh.co.id',
        issuer: "Let's Encrypt (R11)",
        sans: ['contoh.co.id'],
        not_before: NOW - 30 * DAY,
        not_after: NOW + 60 * DAY,
      },
    },
    headers: [
      ['strict-transport-security', 'max-age=31536000; includeSubDomains'],
      ['content-security-policy', "default-src 'self'; frame-ancestors 'none'"],
      ['x-content-type-options', 'nosniff'],
      ['referrer-policy', 'strict-origin-when-cross-origin'],
      ['server', 'nginx'],
    ],
    cookies: [],
    html: '<!doctype html><html><head><title>Contoh</title></head><body></body></html>',
    html_truncated: false,
    security_txt: false,
    dns: {
      ok: true,
      spf: 'v=spf1 include:_spf.google.com ~all',
      dmarc: 'v=DMARC1; p=reject',
      caa: [],
    },
    ...over,
  };
}

const byId = (checks: Check[]) => Object.fromEntries(checks.map((c) => [c.id, c]));

describe('securityChecks', () => {
  it('situs yang rapi mendapat A dan semua pemeriksaan berbobot aman', () => {
    const checks = securityChecks(site(), NOW);
    const bad = checks.filter((c) => c.status === 'fail' || c.status === 'warn');
    expect(bad).toEqual([]);
    expect(score(checks)).toEqual({ score: 100, grade: 'A' });
    expect(byId(checks).cert.data).toEqual({ days: 60 });
  });

  it('tanpa https langsung F walau header lain bagus', () => {
    const checks = securityChecks(
      site({ final_url: 'http://contoh.co.id/', tls: null, http_to_https: false }),
      NOW,
    );
    const c = byId(checks);
    expect(c.https.status).toBe('fail');
    expect(c.redirect.status).toBe('info');
    expect(c.hsts).toBeUndefined();
    expect(score(checks).grade).toBe('F');
  });

  it('sertifikat tidak valid langsung F, hampir habis hanya peringatan', () => {
    const bad = site();
    bad.tls = { ...bad.tls!, valid: false, error: 'expired' };
    const c1 = byId(securityChecks(bad, NOW));
    expect(c1.cert).toMatchObject({ status: 'fail', variant: 'expired' });
    expect(score(Object.values(c1)).grade).toBe('F');

    const soon = site();
    soon.tls!.cert!.not_after = NOW + 5 * DAY;
    expect(byId(securityChecks(soon, NOW)).cert).toMatchObject({
      status: 'warn',
      data: { days: 5 },
    });
  });

  it('CSP dari tag meta ikut dihitung, frame-ancestors hanya dari header', () => {
    const s = site({
      headers: [['strict-transport-security', 'max-age=31536000']],
      html: `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; frame-ancestors 'none'">`,
    });
    const c = byId(securityChecks(s, NOW));
    expect(c.csp.status).toBe('pass');
    expect(c.frame.status).toBe('warn');
  });

  it('CSP lemah: unsafe-inline tanpa nonce, atau tanpa script-src', () => {
    const unsafe = site({
      headers: [['content-security-policy', "script-src 'self' 'unsafe-inline'"]],
    });
    expect(byId(securityChecks(unsafe, NOW)).csp).toMatchObject({
      status: 'warn',
      variant: 'unsafe',
    });
    const nonce = site({
      headers: [['content-security-policy', "script-src 'nonce-abc' 'unsafe-inline'"]],
    });
    expect(byId(securityChecks(nonce, NOW)).csp.status).toBe('pass');
    const partial = site({ headers: [['content-security-policy', 'upgrade-insecure-requests']] });
    expect(byId(securityChecks(partial, NOW)).csp.variant).toBe('partial');
    expect(byId(securityChecks(site({ headers: [] }), NOW)).csp.status).toBe('fail');
  });

  it('HSTS pendek, kebocoran versi, cookie tanpa Secure, dan konten campuran', () => {
    const s = site({
      headers: [
        ['strict-transport-security', 'max-age=86400'],
        ['server', 'Apache/2.4.41 (Ubuntu)'],
        ['x-powered-by', 'PHP/7.4.3'],
      ],
      cookies: [
        { name: 'PHPSESSID', secure: false, http_only: true, same_site: null },
        { name: 'aman', secure: true, http_only: true, same_site: 'lax' },
      ],
      html: '<img src="http://cdn.contoh.co.id/a.png"><a href="http://lain.com">x</a>',
    });
    const c = byId(securityChecks(s, NOW));
    expect(c.hsts).toMatchObject({ status: 'warn', data: { days: 1 } });
    const tiny = site({ headers: [['strict-transport-security', 'max-age=300']] });
    expect(byId(securityChecks(tiny, NOW)).hsts.data).toEqual({ days: '< 1' });
    expect(c.disclosure.status).toBe('warn');
    expect(String(c.disclosure.data?.values)).toContain('Apache/2.4.41');
    expect(c.cookies).toMatchObject({ status: 'warn', data: { names: 'PHPSESSID' } });
    expect(c.mixed.status).toBe('warn');
    // Tautan biasa ke http bukan konten campuran.
    const link = byId(securityChecks(site({ html: '<a href="http://lain.com">x</a>' }), NOW));
    expect(link.mixed.status).toBe('pass');
  });

  it('SPF terbuka, DMARC hanya memantau, dan DNS gagal tidak dinilai', () => {
    const s = site({
      dns: { ok: true, spf: 'v=spf1 +all', dmarc: 'v=DMARC1; p=none', caa: ['issue pki.goog'] },
    });
    const c = byId(securityChecks(s, NOW));
    expect(c.spf).toMatchObject({ status: 'fail', variant: 'open' });
    expect(c.dmarc).toMatchObject({ status: 'warn', variant: 'none' });
    expect(c.caa.status).toBe('pass');
    const off = byId(
      securityChecks(site({ dns: { ok: false, spf: null, dmarc: null, caa: [] } }), NOW),
    );
    expect(off.spf).toBeUndefined();
    expect(off.dmarc).toBeUndefined();
  });

  it('http tertutup bukan masalah', () => {
    const c = byId(securityChecks(site({ http_to_https: null }), NOW));
    expect(c.redirect).toMatchObject({ status: 'info', variant: 'closed' });
  });
});

describe('score', () => {
  it('peringatan bernilai setengah, info tidak dihitung', () => {
    const checks: Check[] = [
      { id: 'https', status: 'pass' },
      { id: 'hsts', status: 'warn' },
      { id: 'securitytxt', status: 'info' },
    ];
    // (25 + 5) / 35
    expect(score(checks)).toEqual({ score: 86, grade: 'B' });
  });
});

describe('metaContent', () => {
  it('membaca atribut dalam urutan apa pun', () => {
    const html = `<meta content="WordPress 6.5" name="generator"><META NAME='generator' CONTENT='Elementor 3.2'>`;
    expect(metaContent(html, 'name', 'generator')).toEqual(['WordPress 6.5', 'Elementor 3.2']);
  });
});

describe('detectTech', () => {
  const tech = (over: Partial<SiteScan>) =>
    detectTech(site({ headers: [], ...over })).map((t) =>
      t.version ? `${t.name} ${t.version}` : t.name,
    );

  it('WordPress dengan versi dari generator, plus PHP tersirat', () => {
    expect(
      tech({
        html: '<meta name="generator" content="WordPress 6.5.2"><link href="/wp-content/themes/a/style.css">',
        headers: [['server', 'nginx/1.24.0']],
      }),
    ).toEqual(['WordPress 6.5.2', 'PHP', 'Nginx 1.24.0']);
  });

  it('Next.js menyiratkan React, Vercel dan Cloudflare dari header', () => {
    expect(
      tech({
        html: '<script id="__NEXT_DATA__" type="application/json">{}</script>',
        headers: [
          ['server', 'Vercel'],
          ['x-vercel-id', 'sin1::abc'],
        ],
      }),
    ).toEqual(['Next.js', 'React', 'Vercel']);
    expect(
      tech({
        headers: [
          ['server', 'cloudflare'],
          ['cf-ray', 'x-SIN'],
        ],
      }),
    ).toEqual(['Cloudflare']);
  });

  it('Laravel dari nama cookie sesi, tapi ci_session adalah CodeIgniter', () => {
    const cookie = (name: string) => ({ name, secure: true, http_only: true, same_site: null });
    expect(tech({ cookies: [cookie('tokoku_session')] })).toEqual(['Laravel', 'PHP']);
    expect(tech({ cookies: [cookie('ci_session')] })).toEqual(['CodeIgniter', 'PHP']);
  });

  it('pembayaran dan analitik lokal', () => {
    expect(
      tech({
        html: '<script src="https://app.midtrans.com/snap/snap.js"></script><script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>',
      }),
    ).toEqual(['Google Analytics', 'Midtrans']);
  });

  it('ciri yang menyesatkan di host tertentu dilewati', () => {
    const gh = { headers: [['server', 'GitHub.com']] as [string, string][] };
    expect(detectTech(site({ ...gh, host: 'github.com' })).map((t) => t.name)).toEqual([]);
    expect(detectTech(site({ ...gh, host: 'nama.github.io' })).map((t) => t.name)).toEqual([
      'GitHub Pages',
    ]);
  });

  it('halaman polos tidak menghasilkan tebakan', () => {
    expect(tech({ html: '<p>Halo</p>' })).toEqual([]);
  });
});
