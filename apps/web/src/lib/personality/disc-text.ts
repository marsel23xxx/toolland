/**
 * Teks Tes DISC per bahasa, ditulis sendiri oleh Toolland. Hanya diimpor halaman .astro saat
 * build. Tiap kelompok berisi satu kata untuk D, I, S, dan C; urutan tampilnya diatur disc.ts.
 */
import type { Locale } from '../format';
import { makeDisc, type DiscTest, type DiscText } from './disc';

const ID: DiscText = {
  meta: {
    title: 'Hasil Tes DISC',
    intro: [
      'Ada 24 kelompok kata, sekitar 6 menit.',
      'Di tiap kelompok, pilih satu kata yang PALING menggambarkan dirimu dan satu kata yang PALING TIDAK menggambarkan dirimu.',
      'Bayangkan dirimu dalam keseharian, misalnya di sekolah, kampus, atau tempat kerja. Jangan terlalu lama berpikir.',
      'Hasilnya grafik empat gaya perilaku: Dominan (D), Interaktif (I), Stabil (S), dan Cermat (C).',
    ],
    disclaimer:
      'Tes ini disusun Toolland berdasarkan model DISC dari William Moulton Marston (1928) dan tidak berafiliasi dengan produk DISC komersial mana pun. Hasilnya menggambarkan gaya perilaku, bukan kemampuan atau kecerdasan, dan sebaiknya tidak dipakai sebagai satu-satunya dasar seleksi kerja.',
    minutes: 6,
    file: 'hasil-tes-disc',
  },
  groups: [
    { D: 'Tegas', I: 'Ceria', S: 'Sabar', C: 'Teliti' },
    { D: 'Berani', I: 'Persuasif', S: 'Setia', C: 'Hati-hati' },
    { D: 'Kompetitif', I: 'Antusias', S: 'Tenang', C: 'Sistematis' },
    { D: 'Lugas', I: 'Supel', S: 'Akomodatif', C: 'Analitis' },
    { D: 'Ambisius', I: 'Optimis', S: 'Pengertian', C: 'Perfeksionis' },
    { D: 'Mandiri', I: 'Ekspresif', S: 'Konsisten', C: 'Logis' },
    { D: 'Gigih', I: 'Menyenangkan', S: 'Suportif', C: 'Tertib' },
    { D: 'Suka memimpin', I: 'Mudah bergaul', S: 'Pendengar yang baik', C: 'Detail' },
    { D: 'Pantang menyerah', I: 'Spontan', S: 'Lemah lembut', C: 'Disiplin' },
    { D: 'Berorientasi hasil', I: 'Karismatik', S: 'Rendah hati', C: 'Objektif' },
    { D: 'Percaya diri', I: 'Inspiratif', S: 'Cinta damai', C: 'Akurat' },
    { D: 'Blak-blakan', I: 'Humoris', S: 'Kooperatif', C: 'Waspada' },
    { D: 'Berani ambil risiko', I: 'Bersemangat', S: 'Bisa diandalkan', C: 'Taat aturan' },
    { D: 'Keras kepala', I: 'Banyak bicara', S: 'Ragu-ragu', C: 'Kritis' },
    { D: 'Tidak sabaran', I: 'Mudah teralihkan', S: 'Sulit menolak', C: 'Pemilih' },
    {
      D: 'Menuntut',
      I: 'Suka jadi pusat perhatian',
      S: 'Menghindari konflik',
      C: 'Terlalu berhati-hati',
    },
    { D: 'Cepat bertindak', I: 'Mudah percaya', S: 'Santai', C: 'Terencana' },
    { D: 'Tangguh', I: 'Hangat', S: 'Stabil', C: 'Cermat' },
    { D: 'Agresif', I: 'Lincah', S: 'Suka menolong', C: 'Rapi' },
    { D: 'Berkemauan keras', I: 'Populer', S: 'Sopan', C: 'Berpikir mendalam' },
    { D: 'Suka menantang', I: 'Pandai bercerita', S: 'Toleran', C: 'Skeptis' },
    { D: 'Pelopor', I: 'Riang', S: 'Mudah puas', C: 'Berstandar tinggi' },
    { D: 'Berwibawa', I: 'Bersahabat', S: 'Suka mengalah', C: 'Tepat waktu' },
    { D: 'Suka tantangan', I: 'Menghibur', S: 'Penyayang', C: 'Penuh pertimbangan' },
  ],
  styles: {
    D: {
      name: 'Dominan',
      short: 'tegas, cepat bertindak, dan fokus pada hasil',
      summary:
        'Kamu berorientasi pada hasil, suka tantangan, dan tidak ragu mengambil keputusan. Kamu bergerak cepat, berbicara lugas, dan paling bersemangat saat memegang kendali.',
      strengths: [
        'Tegas mengambil keputusan',
        'Berani menghadapi tantangan',
        'Fokus pada target dan hasil',
        'Tahan bekerja di bawah tekanan',
      ],
      challenges: [
        'Bisa terkesan keras atau tidak sabar',
        'Kurang mendengarkan pendapat orang lain',
        'Cenderung melewatkan detail dan perasaan orang',
      ],
      environment:
        'Lingkungan yang memberi wewenang, target yang jelas, dan kebebasan menentukan cara kerja. Kamu kurang betah dengan rutinitas dan atasan yang terlalu mengatur.',
      comms: [
        'Sampaikan inti masalah langsung',
        'Fokus pada hasil dan solusi',
        'Beri pilihan, bukan perintah',
      ],
      careers: [
        'Manajer',
        'Pengusaha',
        'Sales manager',
        'Pengacara',
        'Kepala proyek',
        'Konsultan bisnis',
      ],
    },
    I: {
      name: 'Interaktif',
      short: 'ceria, persuasif, dan senang bergaul',
      summary:
        'Kamu antusias, optimis, dan pandai membangun hubungan. Kamu suka bekerja dengan orang, mudah meyakinkan orang lain, dan membawa semangat ke dalam tim.',
      strengths: [
        'Komunikatif dan persuasif',
        'Optimis dan menyemangati',
        'Mudah membangun jaringan',
        'Kreatif dan spontan',
      ],
      challenges: [
        'Kurang memperhatikan detail',
        'Mudah teralihkan dan menunda',
        'Terlalu ingin disukai semua orang',
      ],
      environment:
        'Lingkungan yang ramah, banyak interaksi, serta menghargai ide dan pengakuan. Kamu kurang betah bekerja sendirian dengan aturan yang kaku.',
      comms: [
        'Mulai dengan obrolan santai',
        'Beri kesempatan menyampaikan ide',
        'Tuliskan detail dan tenggat agar tidak terlupa',
      ],
      careers: ['Marketing', 'Humas', 'Sales', 'MC atau presenter', 'Kreator konten', 'Trainer'],
    },
    S: {
      name: 'Stabil',
      short: 'sabar, setia, dan suka bekerja sama',
      summary:
        'Kamu tenang, sabar, dan bisa diandalkan. Kamu suka suasana yang stabil, bekerja sama dengan baik, dan setia mendukung tim serta orang-orang di sekitarmu.',
      strengths: [
        'Sabar dan pendengar yang baik',
        'Setia dan bisa diandalkan',
        'Kerja sama tim yang kuat',
        'Konsisten dan tekun',
      ],
      challenges: [
        'Sulit menghadapi perubahan mendadak',
        'Enggan berkata tidak',
        'Menghindari konflik meski perlu dibahas',
      ],
      environment:
        'Lingkungan yang harmonis dan stabil, dengan peran dan prosedur yang jelas. Kamu kurang nyaman dengan perubahan mendadak dan suasana penuh konflik.',
      comms: [
        'Bicara dengan tenang dan ramah',
        'Beri waktu sebelum meminta keputusan',
        'Jelaskan alasan dan langkah-langkah perubahan',
      ],
      careers: [
        'Perawat',
        'Guru',
        'Staf administrasi',
        'Layanan pelanggan',
        'Staf HRD',
        'Konselor',
      ],
    },
    C: {
      name: 'Cermat',
      short: 'teliti, analitis, dan menjunjung kualitas',
      summary:
        'Kamu teliti, logis, dan menjunjung standar tinggi. Kamu suka bekerja dengan data dan aturan yang jelas, dan memastikan semuanya benar sebelum melangkah.',
      strengths: [
        'Teliti dan akurat',
        'Analitis dan logis',
        'Menjaga kualitas dan standar',
        'Terorganisasi dan sistematis',
      ],
      challenges: [
        'Perfeksionis dan lambat memutuskan',
        'Terlalu kritis pada diri sendiri dan orang lain',
        'Kurang luwes dengan hal di luar prosedur',
      ],
      environment:
        'Lingkungan dengan standar yang jelas, waktu cukup untuk menganalisis, dan penghargaan pada ketepatan. Kamu kurang betah dengan keputusan terburu-buru dan instruksi yang tidak jelas.',
      comms: [
        'Siapkan data dan fakta',
        'Jelaskan secara rinci dan terstruktur',
        'Beri waktu untuk mempertimbangkan',
      ],
      careers: ['Akuntan', 'Analis data', 'Programmer', 'Insinyur', 'Auditor', 'Peneliti'],
    },
  },
  eyebrow: 'Gaya perilakumu',
  barsTitle: 'Skor DISC (paling sesuai dikurangi paling tidak sesuai)',
  blend: 'Selain {a}, sisi {b} kamu juga kuat: {bdesc}.',
  strengths: 'Kekuatan',
  challenges: 'Tantangan',
  environment: 'Lingkungan kerja yang cocok',
  comms: 'Cara terbaik berkomunikasi denganmu',
  careers: 'Pekerjaan yang cocok',
};

const EN: DiscText = {
  meta: {
    title: 'DISC Test Result',
    intro: [
      'There are 24 groups of words. It takes about 6 minutes.',
      'In each group, pick the one word that is MOST like you and the one word that is LEAST like you.',
      'Picture yourself in everyday life, such as at school or at work. Do not overthink.',
      'You get a chart of four behavior styles: Dominance (D), Influence (I), Steadiness (S), and Conscientiousness (C).',
    ],
    disclaimer:
      "Toolland wrote this test based on William Moulton Marston's DISC model (1928). It is not affiliated with any commercial DISC product. The result describes behavior style, not ability or intelligence, and should not be the only basis for a hiring decision.",
    minutes: 6,
    file: 'disc-result',
  },
  groups: [
    { D: 'Decisive', I: 'Cheerful', S: 'Patient', C: 'Precise' },
    { D: 'Bold', I: 'Persuasive', S: 'Loyal', C: 'Careful' },
    { D: 'Competitive', I: 'Enthusiastic', S: 'Calm', C: 'Systematic' },
    { D: 'Direct', I: 'Outgoing', S: 'Accommodating', C: 'Analytical' },
    { D: 'Ambitious', I: 'Optimistic', S: 'Understanding', C: 'Perfectionist' },
    { D: 'Independent', I: 'Expressive', S: 'Consistent', C: 'Logical' },
    { D: 'Determined', I: 'Fun-loving', S: 'Supportive', C: 'Orderly' },
    { D: 'Takes charge', I: 'Sociable', S: 'Good listener', C: 'Detail-oriented' },
    { D: 'Relentless', I: 'Spontaneous', S: 'Gentle', C: 'Disciplined' },
    { D: 'Results-driven', I: 'Charismatic', S: 'Humble', C: 'Objective' },
    { D: 'Self-assured', I: 'Inspiring', S: 'Peaceful', C: 'Accurate' },
    { D: 'Outspoken', I: 'Humorous', S: 'Cooperative', C: 'Wary' },
    { D: 'Risk-taker', I: 'Lively', S: 'Dependable', C: 'Rule-follower' },
    { D: 'Stubborn', I: 'Talkative', S: 'Hesitant', C: 'Critical' },
    { D: 'Impatient', I: 'Easily distracted', S: "Can't say no", C: 'Picky' },
    { D: 'Demanding', I: 'Loves the spotlight', S: 'Avoids conflict', C: 'Overly cautious' },
    { D: 'Quick to act', I: 'Trusting', S: 'Easygoing', C: 'Well-planned' },
    { D: 'Tough', I: 'Warm', S: 'Steady', C: 'Meticulous' },
    { D: 'Forceful', I: 'Animated', S: 'Helpful', C: 'Neat' },
    { D: 'Strong-willed', I: 'Popular', S: 'Polite', C: 'Deep thinker' },
    { D: 'Challenging', I: 'Storyteller', S: 'Tolerant', C: 'Skeptical' },
    { D: 'Pioneering', I: 'Playful', S: 'Content', C: 'High standards' },
    { D: 'Commanding', I: 'Friendly', S: 'Yielding', C: 'Punctual' },
    { D: 'Adventurous', I: 'Entertaining', S: 'Caring', C: 'Deliberate' },
  ],
  styles: {
    D: {
      name: 'Dominance',
      short: 'firm, quick to act, and focused on results',
      summary:
        'You are results-driven, enjoy challenges, and make decisions without hesitation. You move fast, speak directly, and are at your best when you are in control.',
      strengths: [
        'Makes decisions firmly',
        'Faces challenges head-on',
        'Focused on targets and results',
        'Works well under pressure',
      ],
      challenges: [
        'Can come across as harsh or impatient',
        "Doesn't always listen to others",
        "Tends to skip details and people's feelings",
      ],
      environment:
        'A place that gives you authority, clear targets, and freedom to choose how to work. You get restless with routine and micromanaging bosses.',
      comms: [
        'Get straight to the point',
        'Focus on results and solutions',
        'Offer options, not orders',
      ],
      careers: [
        'Manager',
        'Entrepreneur',
        'Sales manager',
        'Lawyer',
        'Project lead',
        'Business consultant',
      ],
    },
    I: {
      name: 'Influence',
      short: 'cheerful, persuasive, and sociable',
      summary:
        'You are enthusiastic, optimistic, and great at building relationships. You like working with people, persuade others easily, and bring energy to a team.',
      strengths: [
        'Communicative and persuasive',
        'Optimistic and encouraging',
        'Builds networks easily',
        'Creative and spontaneous',
      ],
      challenges: [
        'Overlooks details',
        'Easily distracted and prone to procrastinate',
        'Wants to be liked by everyone',
      ],
      environment:
        'A friendly place with lots of interaction that values ideas and recognition. You get restless working alone under rigid rules.',
      comms: [
        'Start with some small talk',
        'Give room to share ideas',
        'Write down details and deadlines so nothing slips',
      ],
      careers: [
        'Marketing',
        'Public relations',
        'Sales',
        'Host or presenter',
        'Content creator',
        'Trainer',
      ],
    },
    S: {
      name: 'Steadiness',
      short: 'patient, loyal, and cooperative',
      summary:
        'You are calm, patient, and dependable. You like a stable atmosphere, cooperate well, and loyally support your team and the people around you.',
      strengths: [
        'Patient and a good listener',
        'Loyal and dependable',
        'A strong team player',
        'Consistent and persistent',
      ],
      challenges: [
        'Struggles with sudden change',
        'Reluctant to say no',
        'Avoids conflict even when it needs addressing',
      ],
      environment:
        'A harmonious, stable place with clear roles and procedures. You feel uneasy with sudden changes and a lot of conflict.',
      comms: [
        'Speak calmly and kindly',
        'Give time before asking for a decision',
        'Explain the reasons and steps of any change',
      ],
      careers: [
        'Nurse',
        'Teacher',
        'Office administrator',
        'Customer service',
        'HR specialist',
        'Counselor',
      ],
    },
    C: {
      name: 'Conscientiousness',
      short: 'thorough, analytical, and quality-minded',
      summary:
        'You are thorough, logical, and hold high standards. You like working with data and clear rules, and make sure everything is right before moving on.',
      strengths: [
        'Thorough and accurate',
        'Analytical and logical',
        'Guards quality and standards',
        'Organized and systematic',
      ],
      challenges: [
        'Perfectionistic and slow to decide',
        'Overly critical of self and others',
        'Inflexible about anything outside procedure',
      ],
      environment:
        'A place with clear standards, enough time to analyze, and respect for accuracy. You get restless with rushed decisions and vague instructions.',
      comms: [
        'Come prepared with data and facts',
        'Explain in a detailed, structured way',
        'Give time to think it over',
      ],
      careers: ['Accountant', 'Data analyst', 'Programmer', 'Engineer', 'Auditor', 'Researcher'],
    },
  },
  eyebrow: 'Your behavior style',
  barsTitle: 'DISC score (most minus least)',
  blend: 'Besides {a}, your {b} side is also strong: {bdesc}.',
  strengths: 'Strengths',
  challenges: 'Challenges',
  environment: 'Work environment that fits',
  comms: 'How to communicate with you',
  careers: 'Careers that fit',
};

export function discTest(locale: Locale): DiscTest {
  return makeDisc(locale === 'en' ? EN : ID);
}
