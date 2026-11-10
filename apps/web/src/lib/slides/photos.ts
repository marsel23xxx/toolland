/**
 * Foto contoh untuk template PPT. Semua dari StockSnap.io berlisensi CC0 1.0 (bebas dipakai,
 * termasuk komersial, tanpa wajib atribusi), diambil lewat Openverse dan di-host sendiri di
 * public/templates/photos/ agar tidak ada permintaan ke pihak luar. Di isian form, foto contoh
 * ditulis sebagai "sample:<nama>"; pengguna bisa menggantinya dengan foto sendiri.
 */

export const SAMPLE_PHOTOS = {
  architect: {
    w: 960,
    h: 639,
    title: 'Construction Builder',
    creator: 'Michal Jarmoluk',
    source: 'https://stocksnap.io/photo/construction-builder-A5Q1BUP3OF',
  },
  barista: {
    w: 960,
    h: 640,
    title: 'Barista Pouring',
    creator: 'Burst',
    source: 'https://stocksnap.io/photo/barista-pouring-MD4L58LL1E',
  },
  cafe: {
    w: 960,
    h: 640,
    title: 'Places Restaurant',
    creator: 'Roman Bozhko',
    source: 'https://stocksnap.io/photo/places-restaurant-2LWU1SQCKK',
  },
  'coffee-beans': {
    w: 960,
    h: 732,
    title: 'Coffee Beans',
    creator: 'fireskystudios.com',
    source: 'https://stocksnap.io/photo/coffee-beans-OTQJFKY0L7',
  },
  'coffee-cherries': {
    w: 960,
    h: 1501,
    title: 'Red Coffee',
    creator: 'Burst',
    source: 'https://stocksnap.io/photo/red-coffee-O97MUX3RBS',
  },
  'coffee-tree': {
    w: 960,
    h: 640,
    title: 'Green Plant',
    creator: 'Mali Maeder',
    source: 'https://stocksnap.io/photo/green-plant-CCMIOPCSJP',
  },
  kitchen: {
    w: 960,
    h: 640,
    title: 'House Interior',
    creator: 'NeONBRAND',
    source: 'https://stocksnap.io/photo/house-interior-APBDJIC32G',
  },
  'laptop-charts': {
    w: 960,
    h: 640,
    title: 'Business Working',
    creator: 'Marc Chouinard',
    source: 'https://stocksnap.io/photo/business-working-PHE63L27S6',
  },
  'laptop-coffee': {
    w: 960,
    h: 640,
    title: 'Business Working',
    creator: 'Negative Space',
    source: 'https://stocksnap.io/photo/business-working-S3JE5YAMND',
  },
  library: {
    w: 960,
    h: 887,
    title: 'Books Library',
    creator: 'Janko Ferlic',
    source: 'https://stocksnap.io/photo/books-library-6XANS2384I',
  },
  'living-room': {
    w: 960,
    h: 540,
    title: 'Living Room',
    creator: 'Dan Gold',
    source: 'https://stocksnap.io/photo/living-room-BI0P6D3WL9',
  },
  'living-room-2': {
    w: 960,
    h: 640,
    title: 'Interior Design',
    creator: 'Kristin Hardwick',
    source: 'https://stocksnap.io/photo/interior-design-HIH67XC5G0',
  },
  meeting: {
    w: 960,
    h: 640,
    title: 'Business Meeting',
    creator: 'Christina Morillo',
    source: 'https://stocksnap.io/photo/business-meeting-SKBXLJOILI',
  },
  'portrait-man': {
    w: 960,
    h: 640,
    title: 'Business Man',
    creator: 'Direct Media',
    source: 'https://stocksnap.io/photo/business-man-IVZBYWKEFM',
  },
  'portrait-woman': {
    w: 960,
    h: 540,
    title: 'Beautiful Bright',
    creator: 'Jonas Svidras',
    source: 'https://stocksnap.io/photo/beautiful-bright-0QND9YJPHK',
  },
  'room-window': {
    w: 960,
    h: 641,
    title: 'Home House',
    creator: 'Breather',
    source: 'https://stocksnap.io/photo/home-house-87ONRC5PWV',
  },
  'study-desk': {
    w: 960,
    h: 640,
    title: 'Laptop Apple',
    creator: 'Stanley Dai',
    source: 'https://stocksnap.io/photo/laptop-apple-BUFBDV2NQW',
  },
  'team-desk': {
    w: 960,
    h: 641,
    title: 'Writing Papers',
    creator: 'Helloquence',
    source: 'https://stocksnap.io/photo/writing-papers-Y01VDYAX63',
  },
  'team-presentation': {
    w: 960,
    h: 640,
    title: 'Business Presenting',
    creator: 'Direct Media',
    source: 'https://stocksnap.io/photo/business-presenting-XDAR6MIG75',
  },
  workspace: {
    w: 960,
    h: 641,
    title: 'Top Workspace',
    creator: 'Top Down Tech',
    source: 'https://stocksnap.io/photo/top-workspace-MY9TVNEESX',
  },
} as const;

export type SamplePhoto = keyof typeof SAMPLE_PHOTOS;

export const SAMPLE_PREFIX = 'sample:';

export function samplePhotoUrl(name: string): string {
  return `/templates/photos/${name}.jpg`;
}

/** Nama foto contoh dari nilai isian, atau undefined bila bukan foto contoh. */
export function sampleName(value: string): SamplePhoto | undefined {
  if (!value.startsWith(SAMPLE_PREFIX)) return undefined;
  const name = value.slice(SAMPLE_PREFIX.length);
  return name in SAMPLE_PHOTOS ? (name as SamplePhoto) : undefined;
}

export const sample = (name: SamplePhoto) => `${SAMPLE_PREFIX}${name}`;
