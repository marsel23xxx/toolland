/**
 * Template dokumen: CV profesional dua kolom. Kolom samping berwarna berisi foto, kontak,
 * keahlian, bahasa, dan sertifikat; kolom utama berisi profil, pengalaman, dan pendidikan.
 */
import { choice, type DocAssets, type DocValues } from '../docs/form';
import type { Block, DocSpec } from '../docs/model';
import type { Locale } from '../format';
import { CV_HEADINGS, cvForm, readCv, type CvEntry } from './cv';

export const PRO_ACCENTS = [
  { value: '1f3a5f', id: 'Biru tua', en: 'Navy' },
  { value: '2f5d3a', id: 'Hijau', en: 'Green' },
  { value: '8c3b22', id: 'Terakota', en: 'Terracotta' },
  { value: '2b2b2b', id: 'Arang', en: 'Charcoal' },
  { value: '5b3a6e', id: 'Ungu', en: 'Plum' },
];

/** Campur warna hex a ke b sebanyak t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a, 16);
  const pb = parseInt(b, 16);
  return [16, 8, 0]
    .map((s) => {
      const x = (pa >> s) & 255;
      const y = (pb >> s) & 255;
      return Math.round(x + (y - x) * t)
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
}

const SIDE_W = 190;

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const cv = readCv(v);
  const h = CV_HEADINGS[cv.lang];
  const accent = choice(
    v,
    'accent',
    PRO_ACCENTS.map((a) => a.value),
    '1f3a5f',
  );
  const shape = choice(v, 'photoShape', ['circle', 'square', 'none'] as const, 'circle');
  const soft = mix(accent, 'ffffff', 0.82);
  const sideRule = mix(accent, 'ffffff', 0.4);
  const muted = '555555';

  const sideHead = (text: string): Block => ({
    t: 'h',
    text,
    caps: true,
    size: 10,
    color: 'ffffff',
    rule: sideRule,
    track: 1,
    before: 16,
    after: 6,
  });
  const mainHead = (text: string): Block => ({
    t: 'h',
    text,
    caps: true,
    size: 11.5,
    color: accent,
    rule: soft,
    track: 0.8,
    before: 16,
    after: 7,
  });

  const side: Block[] = [];
  const photo =
    shape === 'circle' ? assets['photo:circle'] : shape === 'square' ? assets.photo : undefined;
  if (photo)
    side.push({
      t: 'img',
      data: photo.data,
      type: photo.type,
      w: 112,
      h: 112,
      align: 'center',
      after: 4,
    });
  if (cv.contactLines.length) {
    side.push(sideHead(h.contact));
    for (const r of cv.contactLines)
      side.push({ t: 'p', runs: [{ ...r, color: 'ffffff' }], size: 9, after: 4 });
  }
  if (cv.skills.length) {
    side.push(sideHead(h.skills));
    cv.skills.forEach((s, i) => {
      if (s.group)
        side.push({
          t: 'p',
          runs: [{ text: s.group, b: true }],
          size: 9.5,
          before: i ? 6 : 0,
          after: 2,
        });
      side.push({
        t: 'list',
        size: 9,
        items: s.list
          .split(/\s*,\s*(?![^()]*\))/)
          .filter(Boolean)
          .slice(0, 12)
          .map((x) => [{ text: x }]),
      });
    });
  }
  if (cv.languages.length) {
    side.push(sideHead(h.languages));
    side.push({ t: 'list', size: 9, items: cv.languages.map((x) => [{ text: x }]) });
  }
  if (cv.certs.length) {
    side.push(sideHead(h.certs));
    cv.certs.forEach((c, i) => {
      side.push({ t: 'p', runs: [{ text: c.name, b: true }], size: 9, before: i ? 6 : 0 });
      const sub = [c.issuer, c.year].filter(Boolean).join(' · ');
      if (sub)
        side.push({ t: 'p', runs: [{ text: sub }], size: 8.5, color: mix(accent, 'ffffff', 0.75) });
    });
  }

  const entries = (list: CvEntry[]): Block[] =>
    list.flatMap((e, i) => {
      const sub = [e.org, e.city].filter(Boolean).join(', ');
      const out: Block[] = [
        {
          t: 'row',
          left: [{ text: e.title || e.org, b: true }],
          right: [{ text: e.when, color: muted }],
          size: 10.5,
          before: i ? 10 : 0,
        },
      ];
      const second = [e.title ? sub : '', e.extra].filter(Boolean).join(' · ');
      if (second) out.push({ t: 'p', runs: [{ text: second, color: accent }], size: 9.5 });
      if (e.bullets.length)
        out.push({ t: 'list', size: 9.5, items: e.bullets.map((b) => [{ text: b }]), before: 3 });
      return out;
    });

  const main: Block[] = [
    { t: 'p', runs: [{ text: cv.name, b: true, color: '1a1a1a' }], size: 26, lead: 1.1 },
  ];
  if (cv.headline)
    main.push({
      t: 'p',
      runs: [{ text: cv.headline.toUpperCase(), color: accent }],
      size: 11,
      before: 4,
    });
  if (cv.summary.length) {
    main.push(mainHead(h.profile));
    cv.summary.forEach((p, i) =>
      main.push({ t: 'p', runs: [{ text: p }], size: 9.5, align: 'justify', before: i ? 5 : 0 }),
    );
  }
  if (cv.experience.length) main.push(mainHead(h.experience), ...entries(cv.experience));
  if (cv.education.length) main.push(mainHead(h.education), ...entries(cv.education));
  if (cv.orgs.length) main.push(mainHead(h.orgs), ...entries(cv.orgs));

  return {
    title: ['CV', cv.name, cv.headline].filter(Boolean).join(' - '),
    author: cv.name,
    lang: cv.lang,
    font: cv.font,
    size: 10,
    color: '1a1a1a',
    margin: 40,
    main,
    side: { width: SIDE_W, bg: accent, color: 'ffffff', blocks: side },
  };
}

export const CV_PRO_FORM = Object.fromEntries(
  (['id', 'en'] as Locale[]).map((l) => [
    l,
    cvForm(
      l,
      true,
      PRO_ACCENTS.map((a) => ({ value: a.value, label: a[l] })),
    ),
  ]),
) as Record<Locale, ReturnType<typeof cvForm>>;
