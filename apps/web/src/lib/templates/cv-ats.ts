/**
 * Template dokumen: CV ramah ATS. Satu kolom, tanpa tabel, foto, atau ikon; judul bagian standar
 * agar mudah dibaca sistem penyaring lamaran (Applicant Tracking System).
 */
import { choice, type DocValues } from '../docs/form';
import type { Block, DocSpec, Run } from '../docs/model';
import type { Locale } from '../format';
import { CV_HEADINGS, cvForm, readCv, type CvEntry } from './cv';

export const ATS_ACCENTS = [
  { value: '1a1a1a', id: 'Hitam', en: 'Black' },
  { value: '1f3a5f', id: 'Biru tua', en: 'Navy' },
  { value: '2f5d3a', id: 'Hijau', en: 'Green' },
];

export function buildDoc(v: DocValues): DocSpec {
  const cv = readCv(v);
  const h = CV_HEADINGS[cv.lang];
  const accent = choice(
    v,
    'atsAccent',
    ATS_ACCENTS.map((a) => a.value),
    '1a1a1a',
  );
  const muted = '4a4a4a';
  const heading = (text: string): Block => ({
    t: 'h',
    text,
    caps: true,
    size: 11,
    color: accent,
    rule: 'b5b5b5',
    track: 0.6,
    before: 14,
    after: 6,
  });
  const entries = (list: CvEntry[]): Block[] =>
    list.flatMap((e, i) => {
      const sub = [e.org, e.city, e.extra].filter(Boolean).join(' · ');
      const out: Block[] = [
        {
          t: 'row',
          left: [{ text: e.title || e.org, b: true }],
          right: [{ text: e.when, color: muted }],
          before: i ? 8 : 0,
        },
      ];
      if (e.title && sub) out.push({ t: 'p', runs: [{ text: sub, color: muted }] });
      else if (!e.title && e.extra) out.push({ t: 'p', runs: [{ text: e.extra, color: muted }] });
      if (e.bullets.length)
        out.push({ t: 'list', items: e.bullets.map((b) => [{ text: b }]), before: 3 });
      return out;
    });

  const contacts: Run[] = cv.contacts.flatMap((r, i) =>
    i ? [{ text: '  |  ', color: '9a9a9a' }, r] : [r],
  );
  const main: Block[] = [
    { t: 'p', runs: [{ text: cv.name, b: true, color: accent }], size: 22, lead: 1.15 },
  ];
  if (cv.headline)
    main.push({ t: 'p', runs: [{ text: cv.headline }], size: 12, color: muted, before: 2 });
  if (contacts.length) main.push({ t: 'p', runs: contacts, size: 9.5, before: 6 });

  if (cv.summary.length) {
    main.push(heading(h.summary));
    cv.summary.forEach((p, i) => main.push({ t: 'p', runs: [{ text: p }], before: i ? 6 : 0 }));
  }
  if (cv.experience.length) main.push(heading(h.experience), ...entries(cv.experience));
  if (cv.education.length) main.push(heading(h.education), ...entries(cv.education));
  if (cv.skills.length) {
    main.push(heading(h.skills));
    for (const s of cv.skills)
      main.push({
        t: 'p',
        runs: s.group ? [{ text: `${s.group}: `, b: true }, { text: s.list }] : [{ text: s.list }],
        after: 3,
      });
  }
  if (cv.certs.length) {
    main.push(heading(h.certs));
    cv.certs.forEach((c, i) =>
      main.push({
        t: 'row',
        left: [{ text: c.name, b: true }, ...(c.issuer ? [{ text: ` · ${c.issuer}` }] : [])],
        right: [{ text: c.year, color: muted }],
        before: i ? 3 : 0,
      }),
    );
  }
  if (cv.orgs.length) main.push(heading(h.orgs), ...entries(cv.orgs));
  if (cv.languages.length) {
    main.push(heading(h.languages));
    main.push({ t: 'p', runs: [{ text: cv.languages.join(' · ') }] });
  }

  return {
    title: ['CV', cv.name, cv.headline].filter(Boolean).join(' - '),
    author: cv.name,
    lang: cv.lang,
    font: cv.font,
    size: 10.5,
    color: '1a1a1a',
    margin: 50,
    main,
  };
}

export const CV_ATS_FORM = Object.fromEntries(
  (['id', 'en'] as Locale[]).map((l) => [
    l,
    cvForm(
      l,
      false,
      ATS_ACCENTS.map((a) => ({ value: a.value, label: a[l] })),
    ),
  ]),
) as Record<Locale, ReturnType<typeof cvForm>>;
