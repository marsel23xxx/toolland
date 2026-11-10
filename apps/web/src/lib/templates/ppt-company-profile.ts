/**
 * Template PPT: company profile. Tentang kami, visi dan misi, angka penting, layanan, keunggulan,
 * alur kerja, klien, galeri foto, testimoni, dan kontak.
 */
import { choice, text, type DocAssets, type DocForm, type DocValues } from '../docs/form';
import type { DeckSpec } from '../slides/model';
import type { Locale } from '../format';
import { T, type Tr } from './letter-kit';
import {
  area,
  deckFromValues,
  deckSpec,
  imageField,
  list,
  lookFields,
  pairs,
  pipeHint,
  textField,
} from './ppt-common';

const W = {
  id: {
    eyebrow: 'Company Profile',
    about: 'Tentang Kami',
    vision: 'Visi',
    mission: 'Misi',
    visionMission: 'Visi & Misi',
    numbers: 'Dalam Angka',
    services: 'Layanan Kami',
    why: 'Mengapa Memilih Kami',
    process: 'Cara Kami Bekerja',
    clients: 'Klien & Proyek',
    gallery: 'Galeri',
    thanks: 'Mari Bekerja Sama',
    contact: 'Hubungi kami untuk konsultasi gratis.',
  },
  en: {
    eyebrow: 'Company Profile',
    about: 'About Us',
    vision: 'Vision',
    mission: 'Mission',
    visionMission: 'Vision & Mission',
    numbers: 'By the Numbers',
    services: 'Our Services',
    why: 'Why Choose Us',
    process: 'How We Work',
    clients: 'Clients & Projects',
    gallery: 'Gallery',
    thanks: 'Let’s Work Together',
    contact: 'Contact us for a free consultation.',
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const w = W[lang];
  const company = text(v, 'company', 80);
  const deck = deckFromValues(v, [company, text(v, 'tagline', 100)].filter(Boolean).join(' · '));

  deck.cover({
    eyebrow: w.eyebrow,
    title: company,
    subtitle: text(v, 'tagline', 160),
    meta: [text(v, 'since', 80), text(v, 'city', 80)],
    logo: assets.logo,
    photo: assets.coverPhoto,
  });
  deck.imageText({
    title: w.about,
    eyebrow: company,
    text: text(v, 'about', 900),
    image: assets.aboutPhoto,
  });
  const vision = text(v, 'vision', 300);
  if (vision) deck.quote({ text: vision, by: `${w.vision} ${company}` });
  deck.bullets({ title: w.mission, eyebrow: w.visionMission, items: list(v, 'mission', 6) });
  const numbers = pairs(v, 'numbers', 4).map((x) => ({ value: x.title, label: x.text }));
  if (numbers.length) deck.stats({ title: w.numbers, eyebrow: company, items: numbers });
  deck.cards({ title: w.services, eyebrow: w.services, items: pairs(v, 'services', 6) });
  deck.bullets({ title: w.why, eyebrow: w.why, items: list(v, 'why', 6) });
  deck.process({ title: w.process, eyebrow: w.process, steps: pairs(v, 'process', 5) });
  deck.cards({ title: w.clients, eyebrow: w.clients, items: pairs(v, 'clients', 6) });
  deck.gallery({
    title: w.gallery,
    eyebrow: company,
    photos: [1, 2, 3]
      .map((i) => ({ image: assets[`gallery${i}`], caption: text(v, `caption${i}`, 60) }))
      .filter((x) => x.image),
  });
  const testimonial = text(v, 'testimonial', 400);
  if (testimonial) deck.quote({ text: testimonial, by: text(v, 'testimonialBy', 120) });
  deck.closing({
    title: w.thanks,
    subtitle: w.contact,
    lines: [
      text(v, 'address', 200),
      text(v, 'phone', 40),
      text(v, 'email', 80),
      text(v, 'website', 80),
    ],
    logo: assets.logo,
  });
  return deckSpec(deck, v, [w.eyebrow, company].filter(Boolean).join(' - '), company);
}

const SAMPLE: Record<Locale, Record<string, string>> = {
  id: {
    company: 'Studio Ruang Nusa',
    tagline: 'Desain interior dan renovasi rumah yang rapi, tepat waktu, dan sesuai anggaran.',
    since: 'Berdiri sejak 2018',
    city: 'Bandung, Jawa Barat',
    about:
      'Studio Ruang Nusa adalah biro desain interior dan kontraktor renovasi yang melayani rumah tinggal, kafe, dan kantor kecil.\n\nKami menangani proyek dari konsep, gambar kerja, hingga pengerjaan di lapangan, dengan satu tim yang sama dari awal sampai serah terima.',
    vision:
      'Menjadi studio desain dan renovasi yang paling dipercaya keluarga Indonesia untuk mewujudkan ruang yang nyaman dan bermakna.',
    mission:
      'Merancang ruang yang fungsional, indah, dan mudah dirawat.\nMemberi rincian biaya yang transparan sebelum pekerjaan dimulai.\nMenyelesaikan proyek tepat waktu dengan pengawasan harian.\nMemakai material lokal berkualitas dan tenaga kerja terlatih.',
    numbers:
      '8 tahun | Pengalaman\n240+ | Proyek selesai\n96% | Klien merekomendasikan kami\n12 | Kota terlayani',
    services:
      'Desain interior | Konsep, gambar 3D, dan gambar kerja lengkap.\nRenovasi rumah | Pekerjaan sipil, listrik, dan finishing.\nFurnitur custom | Kitchen set, lemari, dan meja kerja.\nDesain kafe | Tata ruang yang menarik dan efisien.\nKonsultasi online | Saran desain lewat video call.\nPengawasan proyek | Laporan progres mingguan.',
    why: 'Satu tim dari desain sampai serah terima.\nRAB rinci dan harga tetap sebelum mulai.\nGaransi pekerjaan 6 bulan setelah serah terima.\nLaporan progres mingguan dengan foto.',
    process:
      'Konsultasi | Diskusi kebutuhan dan survei lokasi.\nDesain | Konsep, gambar 3D, dan revisi.\nRAB | Rincian biaya dan jadwal pekerjaan.\nPengerjaan | Tim lapangan dengan pengawas harian.\nSerah terima | Pengecekan akhir dan garansi.',
    clients:
      'Rumah Keluarga Wijaya | Renovasi total rumah 2 lantai, 4 bulan.\nKafe Senja Dago | Desain dan pembangunan interior kafe 80 kursi.\nKantor Rintisan Kode Kita | Ruang kerja terbuka untuk 30 orang.',
    caption1: 'Ruang keluarga',
    caption2: 'Dapur minimalis',
    caption3: 'Interior kafe',
    testimonial:
      'Hasilnya melebihi harapan kami. Timnya rapi, komunikatif, dan rumah kami selesai tepat waktu.',
    testimonialBy: 'Ayudiyah Pratiwi, pemilik rumah di Bandung',
    address: 'Jl. Melati No. 21, Coblong, Bandung 40132',
    phone: '0812-3456-7890',
    email: 'halo@ruangnusa.id',
    website: 'ruangnusa.id',
  },
  en: {
    company: 'Studio Ruang Nusa',
    tagline: 'Interior design and home renovation that is neat, on time, and on budget.',
    since: 'Established 2018',
    city: 'Bandung, West Java',
    about:
      'Studio Ruang Nusa is an interior design studio and renovation contractor for homes, cafés, and small offices.\n\nWe handle projects from concept and working drawings to construction, with the same team from start to handover.',
    vision:
      'To be the design and renovation studio Indonesian families trust most to create comfortable, meaningful spaces.',
    mission:
      'Design spaces that are functional, beautiful, and easy to maintain.\nGive transparent cost breakdowns before work begins.\nFinish projects on time with daily supervision.\nUse quality local materials and trained craftspeople.',
    numbers:
      '8 years | Experience\n240+ | Projects completed\n96% | Clients who recommend us\n12 | Cities served',
    services:
      'Interior design | Concepts, 3D renders, and full working drawings.\nHome renovation | Civil, electrical, and finishing work.\nCustom furniture | Kitchens, wardrobes, and desks.\nCafé design | Attractive, efficient layouts.\nOnline consultation | Design advice over video call.\nProject supervision | Weekly progress reports.',
    why: 'One team from design to handover.\nDetailed budget and fixed price before we start.\n6-month workmanship warranty after handover.\nWeekly progress reports with photos.',
    process:
      'Consultation | Discuss needs and survey the site.\nDesign | Concept, 3D renders, and revisions.\nBudget | Cost breakdown and work schedule.\nBuild | Site team with a daily supervisor.\nHandover | Final check and warranty.',
    clients:
      'Wijaya Family Home | Full renovation of a two-storey house, 4 months.\nSenja Dago Café | Interior design and fit-out for 80 seats.\nKode Kita Startup Office | Open workspace for 30 people.',
    caption1: 'Living room',
    caption2: 'Minimalist kitchen',
    caption3: 'Café interior',
    testimonial:
      'The result exceeded our expectations. The team was tidy, communicative, and finished our home on time.',
    testimonialBy: 'Ayudiyah Pratiwi, homeowner in Bandung',
    address: 'Jl. Melati No. 21, Coblong, Bandung 40132',
    phone: '+62 812-3456-7890',
    email: 'hello@ruangnusa.id',
    website: 'ruangnusa.id',
  },
};

export function companyForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const A = (key: string, label: Tr, r = 4, hint?: string) => area(locale, key, label, r, hint);
  const F = (key: string, label: Tr, extra = {}) => textField(key, label, locale, extra);
  return {
    template: 'ppt-company',
    output: 'deck',
    storage: 'ppt-company',
    fileBase: 'Company-Profile',
    fileKey: 'company',
    sections: [
      { id: 'look', title: L(T('Tampilan', 'Look')), items: lookFields(locale) },
      {
        id: 'about',
        title: L(T('Tentang usaha', 'About the business')),
        items: [
          F('company', T('Nama usaha', 'Company name'), { max: 80 }),
          F('since', T('Tahun berdiri', 'Founded'), { max: 80 }),
          {
            key: 'tagline',
            kind: 'textarea',
            label: L(T('Tagline', 'Tagline')),
            rows: 2,
            span: 2,
            max: 160,
          },
          F('city', T('Kota', 'City'), { span: 2 }),
          {
            key: 'about',
            kind: 'textarea',
            label: L(T('Tentang kami', 'About us')),
            rows: 5,
            span: 2,
            max: 900,
            hint: L(
              T('Pisahkan paragraf dengan baris kosong.', 'Separate paragraphs with a blank line.'),
            ),
          },
          {
            key: 'vision',
            kind: 'textarea',
            label: L(T('Visi', 'Vision')),
            rows: 2,
            span: 2,
            max: 300,
          },
          A('mission', T('Misi', 'Mission'), 4),
          imageField('logo', T('Logo (opsional)', 'Logo (optional)'), locale, 'logo'),
          imageField('coverPhoto', T('Foto cover (opsional)', 'Cover photo (optional)'), locale),
          imageField(
            'aboutPhoto',
            T('Foto tentang kami (opsional)', 'About photo (optional)'),
            locale,
          ),
        ],
      },
      {
        id: 'offer',
        title: L(T('Layanan dan keunggulan', 'Services and strengths')),
        items: [
          A(
            'numbers',
            T('Angka penting (maksimal 4)', 'Key numbers (up to 4)'),
            3,
            pipeHint(locale, L(T('240+ | Proyek selesai', '240+ | Projects completed'))),
          ),
          A(
            'services',
            T('Layanan / produk (maksimal 6)', 'Services / products (up to 6)'),
            5,
            pipeHint(
              locale,
              L(
                T(
                  'Desain interior | Konsep dan gambar 3D',
                  'Interior design | Concepts and 3D renders',
                ),
              ),
            ),
          ),
          A('why', T('Keunggulan', 'Strengths'), 4),
          A(
            'process',
            T('Alur kerja (maksimal 5 tahap)', 'Workflow (up to 5 stages)'),
            4,
            pipeHint(locale, L(T('Konsultasi | Survei lokasi', 'Consultation | Site survey'))),
          ),
          A(
            'clients',
            T('Klien / proyek (maksimal 6)', 'Clients / projects (up to 6)'),
            4,
            pipeHint(
              locale,
              L(T('Kafe Senja | Interior 80 kursi', 'Senja Café | 80-seat interior')),
            ),
          ),
        ],
      },
      {
        id: 'gallery',
        title: L(T('Galeri dan testimoni', 'Gallery and testimonial')),
        items: [
          imageField('gallery1', T('Foto galeri 1', 'Gallery photo 1'), locale),
          F('caption1', T('Keterangan foto 1', 'Caption 1'), { span: 2 }),
          imageField('gallery2', T('Foto galeri 2', 'Gallery photo 2'), locale),
          F('caption2', T('Keterangan foto 2', 'Caption 2'), { span: 2 }),
          imageField('gallery3', T('Foto galeri 3', 'Gallery photo 3'), locale),
          F('caption3', T('Keterangan foto 3', 'Caption 3'), { span: 2 }),
          {
            key: 'testimonial',
            kind: 'textarea',
            label: L(T('Testimoni pelanggan', 'Customer testimonial')),
            rows: 3,
            span: 2,
            max: 400,
          },
          F('testimonialBy', T('Nama pemberi testimoni', 'Testimonial by'), { span: 2 }),
        ],
      },
      {
        id: 'contact',
        title: L(T('Kontak', 'Contact')),
        items: [
          F('address', T('Alamat', 'Address'), { span: 2 }),
          F('phone', T('Telepon / WhatsApp', 'Phone / WhatsApp'), { max: 40 }),
          F('email', T('Email', 'Email')),
          F('website', T('Situs / Instagram', 'Website / Instagram'), { span: 2 }),
        ],
      },
    ],
    sample: {
      lang: locale,
      style: 'minimal',
      font: 'sans',
      palette: '2f5d3a',
      logo: '',
      coverPhoto: '',
      aboutPhoto: '',
      gallery1: '',
      gallery2: '',
      gallery3: '',
      ...SAMPLE[locale],
    },
  };
}

export const COMPANY_FORM = { id: companyForm('id'), en: companyForm('en') };
