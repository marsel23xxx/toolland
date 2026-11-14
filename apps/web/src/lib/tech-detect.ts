/**
 * Deteksi teknologi situs dari header, nama cookie, dan HTML halaman depan.
 * Daftar ciri ditulis sendiri (bukan salinan dataset pihak lain). Satu teknologi terdeteksi bila
 * salah satu cirinya cocok; grup tangkapan pertama yang berbentuk angka versi dipakai sebagai versi.
 */

import { headerMap, metaContent, type SiteScan } from './site-check';

export type TechCategory =
  | 'cms'
  | 'ecommerce'
  | 'builder'
  | 'framework'
  | 'ui'
  | 'backend'
  | 'server'
  | 'cdn'
  | 'hosting'
  | 'analytics'
  | 'marketing'
  | 'widget'
  | 'security'
  | 'payment'
  | 'font';

/** Urutan tampil kategori. */
export const CATEGORY_ORDER: TechCategory[] = [
  'cms',
  'ecommerce',
  'builder',
  'framework',
  'ui',
  'backend',
  'server',
  'cdn',
  'hosting',
  'security',
  'analytics',
  'marketing',
  'payment',
  'widget',
  'font',
];

interface Rule {
  name: string;
  cat: TechCategory;
  /** Nama header (huruf kecil) -> pola nilai. */
  header?: Record<string, RegExp>;
  /** Pola nama cookie. */
  cookie?: RegExp;
  /** Pola isi HTML (termasuk alamat script/stylesheet). */
  html?: RegExp[];
  /** Pola isi <meta name="generator">. */
  generator?: RegExp;
  /** Teknologi lain yang pasti ikut (misalnya Next.js -> React). */
  implies?: string[];
  /** Host tempat ciri ini menyesatkan (misalnya github.com sendiri bukan GitHub Pages). */
  skipHost?: RegExp;
}

const RULES: Rule[] = [
  // CMS
  {
    name: 'WordPress',
    cat: 'cms',
    generator: /WordPress\s*([\d.]+)?/i,
    html: [/\/wp-(?:content|includes)\//i],
    header: { link: /rel="https:\/\/api\.w\.org\/"/i },
    implies: ['PHP'],
  },
  {
    name: 'Joomla',
    cat: 'cms',
    generator: /Joomla!?\s*([\d.]+)?/i,
    html: [/\/media\/(?:jui|system\/js)\//i],
    implies: ['PHP'],
  },
  {
    name: 'Drupal',
    cat: 'cms',
    generator: /Drupal\s*(\d+)?/i,
    header: { 'x-generator': /Drupal\s*(\d+)?/i, 'x-drupal-cache': /./ },
    html: [/\/sites\/default\/files\//i, /drupalSettings/],
    implies: ['PHP'],
  },
  {
    name: 'Ghost',
    cat: 'cms',
    generator: /Ghost\s*([\d.]+)?/i,
    header: { 'x-ghost-cache-status': /./ },
  },
  {
    name: 'Blogger',
    cat: 'cms',
    generator: /^Blogger$/i,
    html: [/\.blogger\.com\/static\/|blogger\.googleusercontent\.com/i],
  },
  { name: 'Moodle', cat: 'cms', cookie: /^MoodleSession/, html: [/M\.cfg\s*=/] },
  {
    name: 'Strapi',
    cat: 'cms',
    header: { 'x-powered-by': /Strapi/i },
  },
  { name: 'Hugo', cat: 'cms', generator: /Hugo\s*([\d.]+)?/i },
  { name: 'Jekyll', cat: 'cms', generator: /Jekyll\s*v?([\d.]+)?/i },
  { name: 'Docusaurus', cat: 'cms', generator: /Docusaurus\s*v?([\d.]+)?/i, implies: ['React'] },
  {
    name: 'Elementor',
    cat: 'builder',
    html: [/elementor-(?:kit|section|widget)|\/plugins\/elementor\//i],
  },
  { name: 'Divi', cat: 'builder', html: [/\/themes\/Divi\/|et_pb_section/] },
  // Toko online
  {
    name: 'WooCommerce',
    cat: 'ecommerce',
    html: [/\/plugins\/woocommerce\/|woocommerce-(?:page|cart|no-js)/i],
    implies: ['WordPress'],
  },
  {
    name: 'Shopify',
    cat: 'ecommerce',
    header: { 'x-shopid': /./, 'x-shopify-stage': /./, 'powered-by': /Shopify/i },
    html: [/cdn\.shopify\.com|Shopify\.theme/],
  },
  {
    name: 'Magento',
    cat: 'ecommerce',
    header: { 'x-magento-tags': /./, 'x-magento-cache-debug': /./ },
    html: [/Mage\.Cookies|\/static\/version\d+\/frontend\/|mage\/cookies/],
    implies: ['PHP'],
  },
  {
    name: 'PrestaShop',
    cat: 'ecommerce',
    generator: /PrestaShop/i,
    cookie: /^PrestaShop-/,
    html: [/var prestashop\s*=/],
    implies: ['PHP'],
  },
  {
    name: 'OpenCart',
    cat: 'ecommerce',
    cookie: /^OCSESSID$/,
    html: [/catalog\/view\/theme\/|index\.php\?route=common\/home/],
    implies: ['PHP'],
  },
  { name: 'BigCommerce', cat: 'ecommerce', html: [/cdn\d*\.bigcommerce\.com/] },
  // Pembuat situs
  {
    name: 'Wix',
    cat: 'builder',
    header: { 'x-wix-request-id': /./ },
    html: [/static\.wixstatic\.com|static\.parastorage\.com/],
  },
  {
    name: 'Squarespace',
    cat: 'builder',
    html: [/static1\.squarespace\.com|Static\.SQUARESPACE_CONTEXT/],
  },
  { name: 'Webflow', cat: 'builder', generator: /Webflow/i, html: [/\sdata-wf-(?:page|site)=/] },
  {
    name: 'Framer',
    cat: 'builder',
    generator: /Framer\s*([\d.a-f]+)?/i,
    html: [/framerusercontent\.com/],
  },
  {
    name: 'Google Sites',
    cat: 'builder',
    html: [/sites\.google\.com\/[^"']*\/_\/rsrc|ssl\.gstatic\.com\/atari\//],
  },
  // Framework frontend
  {
    name: 'Next.js',
    cat: 'framework',
    header: { 'x-powered-by': /Next\.js\s*([\d.]+)?/i, 'x-nextjs-cache': /./ },
    html: [/__NEXT_DATA__|\/_next\/static\//],
    implies: ['React'],
  },
  {
    name: 'Nuxt',
    cat: 'framework',
    html: [/window\.__NUXT__|\/_nuxt\/|id="__nuxt"/],
    implies: ['Vue.js'],
  },
  {
    name: 'Gatsby',
    cat: 'framework',
    generator: /Gatsby\s*([\d.]+)?/i,
    html: [/id="___gatsby"/],
    implies: ['React'],
  },
  {
    name: 'Remix',
    cat: 'framework',
    html: [/__remixContext|window\.__remixManifest/],
    implies: ['React'],
  },
  {
    name: 'SvelteKit',
    cat: 'framework',
    html: [/__sveltekit_|data-sveltekit-/],
    implies: ['Svelte'],
  },
  { name: 'Svelte', cat: 'framework', html: [/class="[^"]*\bsvelte-[a-z0-9]{5,}/] },
  {
    name: 'Astro',
    cat: 'framework',
    generator: /Astro\s*v?([\d.]+)?/i,
    html: [/<astro-island\b|data-astro-cid-/],
  },
  {
    name: 'Angular',
    cat: 'framework',
    html: [/\sng-version="([\d.]+)"/, /<[a-z-]+\s[^>]*_nghost-/],
  },
  { name: 'AngularJS', cat: 'framework', html: [/\sng-app(?:=|\s|>)|angular(?:\.min)?\.js/] },
  {
    name: 'React',
    cat: 'framework',
    html: [
      /\sdata-reactroot|react(?:-dom)?(?:\.production)?(?:\.min)?\.js|__react|_reactListening/,
    ],
  },
  {
    name: 'Vue.js',
    cat: 'framework',
    html: [
      /\sdata-v-[0-9a-f]{8}\b|\sdata-v-app\b|vue(?:\.global|\.runtime)?(?:\.prod)?(?:\.min)?\.js/,
    ],
  },
  { name: 'Alpine.js', cat: 'framework', html: [/alpine(?:js)?(?:\.min)?\.js|\sx-data=["']/] },
  {
    name: 'htmx',
    cat: 'framework',
    html: [/htmx(?:\.org)?(?:@([\d.]+))?(?:\/dist)?\/?(?:htmx)?(?:\.min)?\.js|\shx-(?:get|post)=/],
  },
  {
    name: 'Livewire',
    cat: 'framework',
    html: [/\swire:(?:id|snapshot)=|livewire(?:\.min)?\.js/],
    implies: ['Laravel'],
  },
  { name: 'Inertia.js', cat: 'framework', html: [/<div id="app" data-page="/] },
  // Library UI
  {
    name: 'jQuery',
    cat: 'ui',
    html: [/jquery[.-]?(\d+\.\d+(?:\.\d+)?)?(?:\.slim)?(?:\.min)?\.js/i],
  },
  {
    name: 'Bootstrap',
    cat: 'ui',
    html: [/bootstrap(?:@|\/)?(\d+\.\d+(?:\.\d+)?)?[^"']*?(?:\.min)?\.(?:css|js)/i],
  },
  { name: 'Tailwind CSS', cat: 'ui', html: [/tailwindcss(?:\s+v?(\d+\.\d+(?:\.\d+)?))?/i] },
  { name: 'Font Awesome', cat: 'font', html: [/font-?awesome|kit\.fontawesome\.com/i] },
  { name: 'Google Fonts', cat: 'font', html: [/fonts\.googleapis\.com|fonts\.gstatic\.com/] },
  { name: 'Adobe Fonts', cat: 'font', html: [/use\.typekit\.net/] },
  { name: 'Swiper', cat: 'ui', html: [/swiper(?:-bundle)?(?:\.min)?\.(?:js|css)/i] },
  { name: 'GSAP', cat: 'ui', html: [/gsap(?:\.min)?\.js/i] },
  // Backend dan bahasa
  {
    name: 'PHP',
    cat: 'backend',
    header: { 'x-powered-by': /PHP\/?([\d.]+)?/i },
    cookie: /^PHPSESSID$/,
  },
  {
    name: 'Statamic',
    cat: 'cms',
    header: { 'x-powered-by': /Statamic/i },
    implies: ['Laravel'],
  },
  {
    name: 'Laravel',
    cat: 'backend',
    // Cookie sesi bawaan Laravel bernama "<nama_aplikasi>_session" (CodeIgniter: ci_session).
    cookie: /^laravel_session$|^(?!ci_)[a-z0-9]+_session$/i,
    implies: ['PHP'],
  },
  { name: 'CodeIgniter', cat: 'backend', cookie: /^ci_session$/, implies: ['PHP'] },
  { name: 'Symfony', cat: 'backend', header: { 'x-debug-token': /./ }, implies: ['PHP'] },
  {
    name: 'Django',
    cat: 'backend',
    html: [/name=["']csrfmiddlewaretoken["']/],
    implies: ['Python'],
  },
  {
    name: 'Flask',
    cat: 'backend',
    header: { server: /Werkzeug\/?([\d.]+)?/i },
    implies: ['Python'],
  },
  { name: 'Python', cat: 'backend', header: { server: /Python\/?([\d.]+)?|gunicorn|uvicorn/i } },
  {
    name: 'Ruby on Rails',
    cat: 'backend',
    header: { 'x-runtime': /^[\d.]+$/, server: /Phusion_Passenger/i },
    html: [/<meta name="csrf-param" content="authenticity_token"/],
  },
  {
    name: 'ASP.NET',
    cat: 'backend',
    header: {
      'x-powered-by': /ASP\.NET/i,
      'x-aspnet-version': /([\d.]+)/,
      'x-aspnetmvc-version': /./,
    },
    cookie: /^(?:ASP\.NET_SessionId|\.AspNetCore\.)/,
    html: [/name="__VIEWSTATE"/],
  },
  {
    name: 'Express',
    cat: 'backend',
    header: { 'x-powered-by': /^Express$/i },
    implies: ['Node.js'],
  },
  { name: 'Node.js', cat: 'backend', cookie: /^connect\.sid$/ },
  {
    name: 'Java',
    cat: 'backend',
    cookie: /^JSESSIONID$/,
    header: { 'x-powered-by': /Servlet|JSP/i },
  },
  // Server web
  { name: 'Nginx', cat: 'server', header: { server: /nginx(?:\/([\d.]+))?/i } },
  { name: 'Apache', cat: 'server', header: { server: /Apache(?:\/([\d.]+))?/i } },
  { name: 'LiteSpeed', cat: 'server', header: { server: /LiteSpeed/i, 'x-litespeed-cache': /./ } },
  { name: 'Microsoft IIS', cat: 'server', header: { server: /Microsoft-IIS(?:\/([\d.]+))?/i } },
  { name: 'Caddy', cat: 'server', header: { server: /Caddy/i } },
  { name: 'OpenResty', cat: 'server', header: { server: /openresty(?:\/([\d.]+))?/i } },
  {
    name: 'Envoy',
    cat: 'server',
    header: { server: /envoy/i, 'x-envoy-upstream-service-time': /./ },
  },
  { name: 'Tengine', cat: 'server', header: { server: /Tengine/i } },
  { name: 'Varnish', cat: 'server', header: { via: /varnish/i, 'x-varnish': /./ } },
  // CDN dan keamanan
  { name: 'Cloudflare', cat: 'cdn', header: { server: /^cloudflare$/i, 'cf-ray': /./ } },
  {
    name: 'Fastly',
    cat: 'cdn',
    header: { 'x-served-by': /cache-/i, 'fastly-debug-digest': /./, 'x-fastly-request-id': /./ },
  },
  {
    name: 'Akamai',
    cat: 'cdn',
    header: { server: /AkamaiGHost|AkamaiNetStorage/i, 'x-akamai-transformed': /./ },
  },
  { name: 'Amazon CloudFront', cat: 'cdn', header: { 'x-amz-cf-id': /./, via: /CloudFront/i } },
  { name: 'BunnyCDN', cat: 'cdn', header: { server: /BunnyCDN/i } },
  { name: 'jsDelivr', cat: 'cdn', html: [/cdn\.jsdelivr\.net/] },
  { name: 'cdnjs', cat: 'cdn', html: [/cdnjs\.cloudflare\.com/] },
  { name: 'unpkg', cat: 'cdn', html: [/unpkg\.com\//] },
  { name: 'Sucuri', cat: 'security', header: { server: /Sucuri/i, 'x-sucuri-id': /./ } },
  { name: 'Imperva', cat: 'security', header: { 'x-iinfo': /./, 'x-cdn': /Incapsula|Imperva/i } },
  {
    name: 'reCAPTCHA',
    cat: 'security',
    html: [/google\.com\/recaptcha|recaptcha\.net\/recaptcha/],
  },
  { name: 'hCaptcha', cat: 'security', html: [/hcaptcha\.com\/1\/api\.js|js\.hcaptcha\.com/] },
  {
    name: 'Cloudflare Turnstile',
    cat: 'security',
    html: [/challenges\.cloudflare\.com\/turnstile/],
  },
  // Hosting
  { name: 'Vercel', cat: 'hosting', header: { server: /^Vercel$/i, 'x-vercel-id': /./ } },
  { name: 'Netlify', cat: 'hosting', header: { server: /^Netlify$/i, 'x-nf-request-id': /./ } },
  {
    name: 'GitHub Pages',
    cat: 'hosting',
    header: { server: /^GitHub\.com$/i },
    skipHost: /(?:^|\.)github\.com$/,
  },
  { name: 'Firebase Hosting', cat: 'hosting', html: [/\/__\/firebase\/init\.js/] },
  {
    name: 'Google Cloud',
    cat: 'hosting',
    header: { server: /Google Frontend/i, via: /1\.1 google/i },
  },
  { name: 'Amazon S3', cat: 'hosting', header: { server: /^AmazonS3$/i } },
  { name: 'Heroku', cat: 'hosting', header: { via: /vegur/i } },
  { name: 'Render', cat: 'hosting', header: { 'x-render-origin-server': /./ } },
  { name: 'Fly.io', cat: 'hosting', header: { 'fly-request-id': /./ } },
  {
    name: 'Hostinger',
    cat: 'hosting',
    header: { platform: /hostinger/i, 'x-hcdn-request-id': /./ },
  },
  // Analitik
  {
    name: 'Google Analytics',
    cat: 'analytics',
    html: [
      /googletagmanager\.com\/gtag\/js\?id=G-|google-analytics\.com\/(?:analytics|ga)\.js|gtag\(\s*['"]config['"]\s*,\s*['"]G-/,
    ],
  },
  {
    name: 'Google Tag Manager',
    cat: 'analytics',
    html: [/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/],
  },
  {
    name: 'Meta Pixel',
    cat: 'marketing',
    html: [/connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init/],
  },
  { name: 'TikTok Pixel', cat: 'marketing', html: [/analytics\.tiktok\.com/] },
  {
    name: 'Google Ads',
    cat: 'marketing',
    html: [/googleadservices\.com|gtag\(\s*['"]config['"]\s*,\s*['"]AW-/],
  },
  { name: 'Google AdSense', cat: 'marketing', html: [/pagead2\.googlesyndication\.com/] },
  { name: 'Hotjar', cat: 'analytics', html: [/static\.hotjar\.com/] },
  { name: 'Microsoft Clarity', cat: 'analytics', html: [/clarity\.ms\/tag/] },
  { name: 'Plausible', cat: 'analytics', html: [/plausible\.io\/js/] },
  { name: 'Matomo', cat: 'analytics', html: [/matomo\.js|piwik\.js/] },
  {
    name: 'Umami',
    cat: 'analytics',
    html: [/data-website-id=["'][0-9a-f-]{36}["'][^>]*umami|umami\.is\/script\.js/],
  },
  {
    name: 'Cloudflare Web Analytics',
    cat: 'analytics',
    html: [/static\.cloudflareinsights\.com\/beacon/],
  },
  { name: 'Yandex Metrica', cat: 'analytics', html: [/mc\.yandex\.ru\/metrika/] },
  { name: 'Mixpanel', cat: 'analytics', html: [/cdn\.mxpnl\.com|mixpanel\.init\(/] },
  { name: 'Segment', cat: 'analytics', html: [/cdn\.segment\.com\/analytics\.js/] },
  { name: 'HubSpot', cat: 'marketing', html: [/js\.hs-scripts\.com|js\.hsforms\.net/] },
  { name: 'Mailchimp', cat: 'marketing', html: [/chimpstatic\.com|list-manage\.com/] },
  // Pembayaran
  { name: 'Midtrans', cat: 'payment', html: [/app(?:\.sandbox)?\.midtrans\.com\/snap/] },
  { name: 'Xendit', cat: 'payment', html: [/js\.xendit\.co/] },
  { name: 'DOKU', cat: 'payment', html: [/jokul\.doku\.com|doku\.com\/jokul-checkout/] },
  { name: 'Stripe', cat: 'payment', html: [/js\.stripe\.com/] },
  { name: 'PayPal', cat: 'payment', html: [/paypal\.com\/sdk\/js|paypalobjects\.com/] },
  // Widget
  { name: 'Intercom', cat: 'widget', html: [/widget\.intercom\.io|js\.intercomcdn\.com/] },
  { name: 'Crisp', cat: 'widget', html: [/client\.crisp\.chat/] },
  { name: 'Tawk.to', cat: 'widget', html: [/embed\.tawk\.to/] },
  { name: 'Zendesk', cat: 'widget', html: [/static\.zdassets\.com/] },
  { name: 'Qiscus', cat: 'widget', html: [/qiscus\.com/] },
  { name: 'YouTube', cat: 'widget', html: [/youtube(?:-nocookie)?\.com\/embed\//] },
  {
    name: 'Google Maps',
    cat: 'widget',
    html: [/maps\.googleapis\.com\/maps\/api\/js|google\.com\/maps\/embed/],
  },
];

export interface Tech {
  name: string;
  cat: TechCategory;
  version: string | null;
}

const VERSION = /^\d+(?:\.\d+)*$/;

function versionOf(m: RegExpExecArray | null): string | null {
  const v = m?.slice(1).find((g) => g && VERSION.test(g));
  return v ?? null;
}

export function detectTech(
  scan: Pick<SiteScan, 'headers' | 'cookies' | 'html'> & { host?: string },
): Tech[] {
  const headers = headerMap(scan);
  const cookies = scan.cookies.map((c) => c.name);
  const html = scan.html;
  const generators = metaContent(html, 'name', 'generator');
  const found = new Map<string, Tech>();

  for (const r of RULES) {
    if (r.skipHost && scan.host && r.skipHost.test(scan.host)) continue;
    let hit = false;
    let version: string | null = null;
    const take = (m: RegExpExecArray | null) => {
      if (!m) return;
      hit = true;
      version ??= versionOf(m);
    };
    for (const [name, re] of Object.entries(r.header ?? {})) {
      const v = headers.get(name);
      if (v !== undefined) take(re.exec(v));
    }
    if (r.cookie) for (const c of cookies) take(r.cookie.exec(c));
    if (r.generator) for (const g of generators) take(r.generator.exec(g));
    for (const re of r.html ?? []) take(re.exec(html));
    if (hit) found.set(r.name, { name: r.name, cat: r.cat, version });
  }

  // Teknologi yang tersirat (Next.js -> React); berulang sampai tidak ada tambahan.
  const byName = new Map(RULES.map((r) => [r.name, r]));
  let added = true;
  while (added) {
    added = false;
    for (const t of [...found.values()])
      for (const name of byName.get(t.name)?.implies ?? []) {
        const r = byName.get(name);
        if (r && !found.has(name)) {
          found.set(name, { name, cat: r.cat, version: null });
          added = true;
        }
      }
  }

  return [...found.values()].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat) || a.name.localeCompare(b.name),
  );
}

/** Jumlah ciri teknologi yang dikenali (untuk teks halaman). */
export const TECH_COUNT = RULES.length;
