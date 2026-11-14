/**
 * Teks Tes 16 Tipe Kepribadian per bahasa, ditulis sendiri oleh Toolland. Hanya diimpor halaman
 * .astro saat build.
 */
import type { Locale } from '../format';
import { makeTypes16, type Types16Test, type Types16Text } from './types16';

const ID: Types16Text = {
  meta: {
    title: 'Hasil Tes 16 Tipe Kepribadian',
    intro: [
      'Ada 48 pernyataan, sekitar 7 menit.',
      'Pilih seberapa sesuai tiap pernyataan dengan kebiasaanmu sehari-hari, bukan dengan dirimu yang ideal.',
      'Kalau ragu, pilih jawaban yang paling sering terjadi. Pilih Netral hanya kalau benar-benar seimbang.',
      'Hasilnya kode 4 huruf (misalnya INFP atau ESTJ) beserta seberapa kuat kecenderunganmu di tiap dimensi.',
    ],
    disclaimer:
      'Tes ini disusun Toolland berdasarkan teori tipe psikologis Carl Jung dan tidak berafiliasi dengan MBTI®, merek dagang milik The Myers-Briggs Company. Hasilnya untuk mengenal diri dan hiburan, bukan alat seleksi kerja atau diagnosis. Kecenderungan di bawah 60% berarti kamu cukup seimbang di dimensi itu.',
    minutes: 7,
    file: 'hasil-tes-16-tipe',
  },
  scale: ['Sangat tidak sesuai', 'Tidak sesuai', 'Netral', 'Sesuai', 'Sangat sesuai'],
  items: {
    E: [
      'Saya mendapat energi setelah menghabiskan waktu bersama banyak orang.',
      'Saya mudah memulai obrolan dengan orang yang baru saya kenal.',
      'Saya lebih mudah berpikir sambil membicarakannya dengan orang lain.',
      'Akhir pekan yang ideal bagi saya adalah pergi dan bertemu teman-teman.',
      'Saya senang bekerja dalam tim yang ramai dan banyak diskusi.',
      'Saya cepat akrab dengan orang baru.',
    ],
    I: [
      'Setelah acara yang ramai, saya butuh waktu sendiri untuk memulihkan tenaga.',
      'Saya lebih suka mengobrol berdua daripada dalam kelompok besar.',
      'Saya biasanya memikirkan jawaban dulu sebelum berbicara.',
      'Saya merasa lelah kalau terlalu lama berada di keramaian.',
      'Saya lebih nyaman berkomunikasi lewat tulisan daripada lewat telepon.',
      'Saya punya sedikit teman dekat dan itu sudah cukup bagi saya.',
    ],
    S: [
      'Saya lebih percaya pada fakta dan pengalaman nyata daripada firasat.',
      'Saya suka petunjuk yang jelas dan langkah demi langkah.',
      'Saya memperhatikan detail yang sering terlewat oleh orang lain.',
      'Saya lebih tertarik pada hal yang bisa langsung dipraktikkan daripada teori.',
      'Saya lebih fokus pada apa yang terjadi sekarang daripada kemungkinan di masa depan.',
      'Saya menyukai cara yang sudah terbukti berhasil.',
    ],
    N: [
      'Saya sering membayangkan berbagai kemungkinan di masa depan.',
      'Saya suka mencari makna atau pola di balik suatu kejadian.',
      'Saya lebih tertarik pada ide besar daripada detail pelaksanaannya.',
      'Saya sering tiba-tiba mendapat ide yang tidak berhubungan dengan yang sedang saya kerjakan.',
      'Saya senang membahas teori dan konsep yang abstrak.',
      'Saya suka mencoba cara baru meskipun cara lama masih berhasil.',
    ],
    T: [
      'Saat mengambil keputusan, saya lebih mengutamakan logika daripada perasaan.',
      'Saya bisa memberi kritik yang jujur meskipun mungkin menyakitkan.',
      'Aturan yang adil harus berlaku sama untuk semua orang, tanpa pengecualian.',
      'Saya lebih ingin dianggap kompeten daripada dianggap baik hati.',
      'Dalam perdebatan, saya lebih fokus pada siapa yang benar daripada menjaga suasana.',
      'Saya menimbang untung dan rugi secara objektif sebelum memutuskan sesuatu.',
    ],
    F: [
      'Saya mempertimbangkan perasaan orang lain sebelum mengambil keputusan.',
      'Saya mudah tersentuh oleh cerita orang lain.',
      'Menjaga keharmonisan dalam kelompok penting bagi saya.',
      'Saya sulit menolak permintaan tolong dari orang lain.',
      'Saya memutuskan berdasarkan nilai-nilai pribadi yang saya yakini.',
      'Saya lebih suka memberi semangat daripada mengkritik.',
    ],
    J: [
      'Saya suka merencanakan kegiatan jauh-jauh hari.',
      'Saya merasa lega setelah keputusan dibuat dan urusan selesai.',
      'Saya membuat daftar tugas dan mengikutinya.',
      'Saya biasanya menyelesaikan tugas jauh sebelum tenggat waktu.',
      'Saya merasa tidak nyaman kalau rencana berubah mendadak.',
      'Meja dan barang-barang saya biasanya tertata rapi.',
    ],
    P: [
      'Saya lebih suka membiarkan pilihan tetap terbuka daripada memutuskan terlalu cepat.',
      'Saya sering mengerjakan tugas mendekati tenggat waktu.',
      'Saya senang dengan rencana dadakan.',
      'Saya lebih suka mengikuti alur daripada mengikuti jadwal yang ketat.',
      'Saya mudah beralih dari satu kegiatan ke kegiatan lain.',
      'Aturan dan jadwal yang terlalu ketat membuat saya merasa terkekang.',
    ],
  },
  letters: {
    E: {
      name: 'Ekstrovert',
      desc: 'Mendapat energi dari interaksi dan berpikir sambil berbicara.',
    },
    I: {
      name: 'Introvert',
      desc: 'Mendapat energi dari waktu sendiri dan berpikir dulu sebelum bicara.',
    },
    S: { name: 'Sensing', desc: 'Fokus pada fakta, detail, dan pengalaman nyata.' },
    N: { name: 'Intuition', desc: 'Fokus pada pola, makna, dan kemungkinan di masa depan.' },
    T: { name: 'Thinking', desc: 'Memutuskan dengan logika dan prinsip yang objektif.' },
    F: { name: 'Feeling', desc: 'Memutuskan dengan mempertimbangkan nilai dan perasaan orang.' },
    J: { name: 'Judging', desc: 'Suka rencana, keteraturan, dan keputusan yang tuntas.' },
    P: { name: 'Perceiving', desc: 'Suka fleksibilitas, spontanitas, dan pilihan yang terbuka.' },
  },
  types: {
    INTJ: {
      name: 'Perencana Strategis',
      summary:
        'Pemikir mandiri yang melihat gambaran besar dan menyusun rencana jangka panjang untuk mewujudkannya. Kamu menghargai kompetensi, logika, dan perbaikan terus-menerus.',
      strengths: [
        'Berpikir strategis dan jauh ke depan',
        'Mandiri dan yakin pada analisisnya',
        'Cepat melihat celah dalam sebuah sistem',
        'Tekun mengejar tujuan',
      ],
      challenges: [
        'Bisa terkesan dingin atau terlalu kritis',
        'Kurang sabar pada hal yang dianggap tidak efisien',
        'Sulit mendelegasikan pekerjaan',
      ],
      careers: [
        'Analis data',
        'Arsitek perangkat lunak',
        'Konsultan strategi',
        'Peneliti',
        'Insinyur',
        'Perencana keuangan',
      ],
    },
    INTP: {
      name: 'Pemikir Analitis',
      summary:
        'Pemecah teka-teki yang senang memahami cara kerja segala sesuatu. Kamu logis, penuh rasa ingin tahu, dan suka menguji ide dari berbagai sudut.',
      strengths: [
        'Analisis logis yang tajam',
        'Rasa ingin tahu yang besar',
        'Kreatif mencari solusi baru',
        'Objektif dan terbuka pada ide',
      ],
      challenges: [
        'Mudah larut dalam pikiran dan menunda eksekusi',
        'Kurang tertarik pada urusan rutin',
        'Kadang sulit mengungkapkan perasaan',
      ],
      careers: [
        'Programmer',
        'Ilmuwan',
        'Matematikawan',
        'Analis sistem',
        'Dosen atau peneliti',
        'Desainer game',
      ],
    },
    ENTJ: {
      name: 'Pemimpin Tegas',
      summary:
        'Pemimpin alami yang tegas, terorganisasi, dan berorientasi hasil. Kamu cepat menetapkan tujuan, menyusun strategi, dan menggerakkan orang untuk mencapainya.',
      strengths: [
        'Kepemimpinan dan ketegasan',
        'Perencanaan dan pengorganisasian yang kuat',
        'Percaya diri mengambil keputusan',
        'Efisien dan berorientasi target',
      ],
      challenges: [
        'Bisa terkesan dominan',
        'Kurang sabar pada orang yang bekerja lambat',
        'Cenderung mengesampingkan perasaan demi target',
      ],
      careers: [
        'Manajer',
        'Pengusaha',
        'Konsultan manajemen',
        'Pengacara',
        'Direktur proyek',
        'Eksekutif penjualan',
      ],
    },
    ENTP: {
      name: 'Penggagas Ide',
      summary:
        'Pemikir cepat yang senang berdebat dan menantang cara lama. Kamu penuh ide, pandai berimprovisasi, dan menikmati tantangan intelektual.',
      strengths: [
        'Kreatif dan inovatif',
        'Cepat berpikir dan pandai berargumen',
        'Mudah beradaptasi',
        'Antusias pada tantangan baru',
      ],
      challenges: [
        'Mudah bosan pada pekerjaan rutin',
        'Banyak memulai tapi sulit menuntaskan',
        'Suka berdebat sampai membuat orang lain lelah',
      ],
      careers: [
        'Pendiri startup',
        'Pemasar kreatif',
        'Konsultan',
        'Jurnalis',
        'Pengembang produk',
        'Pengacara',
      ],
    },
    INFJ: {
      name: 'Penasihat Bijak',
      summary:
        'Idealis yang tenang dengan pemahaman mendalam tentang orang lain. Kamu punya nilai yang kuat dan ingin hidupmu berdampak bagi sesama.',
      strengths: [
        'Memahami orang secara mendalam',
        'Berprinsip dan berkomitmen',
        'Kreatif dengan visi jangka panjang',
        'Pendengar yang baik',
      ],
      challenges: [
        'Mudah lelah secara emosional',
        'Perfeksionis dan sulit menerima kritik',
        'Terlalu memendam perasaan sendiri',
      ],
      careers: ['Psikolog', 'Konselor', 'Penulis', 'Guru', 'Pekerja sosial', 'Desainer UX'],
    },
    INFP: {
      name: 'Idealis Penyayang',
      summary:
        'Pribadi lembut yang dipandu nilai-nilai dan imajinasi. Kamu ingin hidup sesuai hati nurani dan senang mengekspresikan diri lewat karya.',
      strengths: [
        'Empati yang dalam',
        'Kreatif dan imajinatif',
        'Setia pada nilai pribadi',
        'Terbuka dan menerima perbedaan',
      ],
      challenges: [
        'Terlalu idealis sehingga mudah kecewa',
        'Sulit menghadapi konflik',
        'Kurang teratur dalam urusan praktis',
      ],
      careers: ['Penulis', 'Ilustrator', 'Psikolog', 'Guru', 'Konselor', 'Penerjemah'],
    },
    ENFJ: {
      name: 'Pembina Inspiratif',
      summary:
        'Pemimpin hangat yang pandai memahami dan menyemangati orang. Kamu senang membantu orang lain berkembang dan menyatukan kelompok.',
      strengths: [
        'Karismatik dan persuasif',
        'Peduli pada perkembangan orang lain',
        'Komunikator yang hebat',
        'Pandai menyatukan tim',
      ],
      challenges: [
        'Terlalu memikirkan pendapat orang',
        'Sulit menolak permintaan',
        'Bisa mengabaikan kebutuhan diri sendiri',
      ],
      careers: ['Guru', 'Coach atau pelatih', 'Staf HRD', 'Humas', 'Manajer tim', 'Konselor'],
    },
    ENFP: {
      name: 'Penyemangat Kreatif',
      summary:
        'Pribadi antusias dan penuh ide yang melihat peluang di mana-mana. Kamu mudah akrab, kreatif, dan menularkan semangat ke sekitarmu.',
      strengths: [
        'Antusias dan menginspirasi',
        'Kreatif dan banyak ide',
        'Hangat dan mudah bergaul',
        'Luwes menghadapi perubahan',
      ],
      challenges: [
        'Mudah teralihkan',
        'Sulit menuntaskan detail',
        'Gampang tertekan saat dikekang aturan',
      ],
      careers: ['Pemasar', 'Kreator konten', 'Jurnalis', 'Desainer', 'Event organizer', 'Konselor'],
    },
    ISTJ: {
      name: 'Penjaga Ketertiban',
      summary:
        'Pribadi bertanggung jawab yang menjunjung aturan, fakta, dan kebiasaan yang terbukti. Kamu teliti, bisa diandalkan, dan menuntaskan apa yang sudah kamu mulai.',
      strengths: [
        'Sangat bisa diandalkan',
        'Teliti dan sistematis',
        'Jujur dan lugas',
        'Tekun dan sabar',
      ],
      challenges: [
        'Kaku terhadap perubahan',
        'Sulit menerima cara yang tidak biasa',
        'Jarang mengungkapkan perasaan',
      ],
      careers: [
        'Akuntan',
        'Auditor',
        'Administrator',
        'Analis keuangan',
        'Insinyur sipil',
        'Aparatur sipil negara',
      ],
    },
    ISFJ: {
      name: 'Perawat Setia',
      summary:
        'Pelindung yang hangat dan setia. Kamu memperhatikan kebutuhan orang lain dan bekerja keras dengan tenang agar semuanya berjalan baik.',
      strengths: [
        'Penuh perhatian dan suportif',
        'Teliti dan bertanggung jawab',
        'Setia dan sabar',
        'Ingat detail kecil tentang orang lain',
      ],
      challenges: [
        'Sulit berkata tidak',
        'Memendam perasaan sendiri',
        'Ragu menghadapi perubahan besar',
      ],
      careers: [
        'Perawat',
        'Guru SD',
        'Staf administrasi',
        'Apoteker',
        'Pustakawan',
        'Layanan pelanggan',
      ],
    },
    ESTJ: {
      name: 'Pengelola Andal',
      summary:
        'Organisator praktis yang suka keteraturan dan kejelasan. Kamu memimpin dengan aturan yang jelas dan memastikan pekerjaan selesai tepat waktu.',
      strengths: [
        'Terorganisasi dan efisien',
        'Tegas dan lugas',
        'Bertanggung jawab',
        'Pandai mengelola orang dan proses',
      ],
      challenges: [
        'Kurang fleksibel',
        'Bisa terlalu menuntut',
        'Kurang sabar pada perasaan dan ide yang belum teruji',
      ],
      careers: [
        'Manajer operasional',
        'Kepala proyek',
        'Supervisor produksi',
        'Manajer bank',
        'Kepala sekolah',
        'Kontraktor',
      ],
    },
    ESFJ: {
      name: 'Perekat Komunitas',
      summary:
        'Pribadi ramah dan peduli yang menjaga orang-orang di sekitarnya tetap kompak. Kamu senang membantu, rapi, dan menghargai tradisi.',
      strengths: [
        'Hangat dan mudah bergaul',
        'Bertanggung jawab dan rapi',
        'Peka terhadap kebutuhan orang',
        'Kerja sama tim yang baik',
      ],
      challenges: [
        'Terlalu butuh pengakuan',
        'Sensitif terhadap kritik',
        'Sulit menerima perubahan mendadak',
      ],
      careers: [
        'Perawat',
        'Guru',
        'Staf HRD',
        'Event organizer',
        'Perhotelan',
        'Layanan pelanggan',
      ],
    },
    ISTP: {
      name: 'Pemecah Masalah',
      summary:
        'Pribadi tenang dan praktis yang senang memahami cara kerja alat dan sistem. Kamu sigap menghadapi keadaan darurat dan paling cepat belajar dengan mencoba langsung.',
      strengths: [
        'Tenang dalam situasi darurat',
        'Terampil secara teknis',
        'Logis dan praktis',
        'Mandiri dan fleksibel',
      ],
      challenges: [
        'Mudah bosan pada rencana jangka panjang',
        'Tertutup soal perasaan',
        'Bisa terkesan cuek',
      ],
      careers: ['Teknisi', 'Mekanik', 'Insinyur', 'Pilot', 'Ahli forensik', 'Programmer'],
    },
    ISFP: {
      name: 'Seniman Tenang',
      summary:
        'Pribadi lembut dan peka yang menikmati keindahan dan momen saat ini. Kamu lebih suka mengekspresikan diri lewat karya daripada kata-kata.',
      strengths: [
        'Peka terhadap keindahan',
        'Rendah hati dan baik hati',
        'Fleksibel dan santai',
        'Setia pada nilai sendiri',
      ],
      challenges: [
        'Menghindari konflik',
        'Sulit merencanakan jangka panjang',
        'Mudah tersinggung oleh kritik',
      ],
      careers: ['Desainer grafis', 'Fotografer', 'Musisi', 'Penata rias', 'Terapis', 'Koki'],
    },
    ESTP: {
      name: 'Pelaku Aksi',
      summary:
        'Pribadi energik yang suka bertindak dan berani mengambil risiko. Kamu cepat membaca situasi, pandai bernegosiasi, dan hidup di saat ini.',
      strengths: [
        'Berani dan tanggap',
        'Pandai bernegosiasi',
        'Praktis dan realistis',
        'Mudah bergaul',
      ],
      challenges: [
        'Kurang sabar',
        'Cenderung mengambil risiko berlebihan',
        'Kurang suka aturan dan perencanaan',
      ],
      careers: ['Sales', 'Pengusaha', 'Agen properti', 'Atlet', 'Paramedis', 'Polisi'],
    },
    ESFP: {
      name: 'Penghidup Suasana',
      summary:
        'Pribadi ceria dan spontan yang senang berada di tengah keramaian. Kamu menikmati hidup, mudah akrab, dan membuat orang di sekitarmu ikut senang.',
      strengths: [
        'Ceria dan menyenangkan',
        'Peka terhadap orang lain',
        'Praktis dan spontan',
        'Percaya diri tampil di depan umum',
      ],
      challenges: [
        'Mudah bosan',
        'Kurang perencanaan',
        'Cenderung menghindari masalah yang tidak menyenangkan',
      ],
      careers: [
        'Presenter',
        'Event organizer',
        'Sales',
        'Pemandu wisata',
        'Pramugari atau pramugara',
        'Guru TK',
      ],
    },
  },
  eyebrow: 'Tipe kepribadianmu',
  barsTitle: 'Kecenderungan di tiap dimensi',
  lean: '{n}% {name}.',
  strengths: 'Kekuatan',
  challenges: 'Tantangan',
  careers: 'Pekerjaan yang cocok',
};

const EN: Types16Text = {
  meta: {
    title: '16 Personality Types Test Result',
    intro: [
      'There are 48 statements. It takes about 7 minutes.',
      'Rate how well each statement fits your everyday habits, not your ideal self.',
      'If unsure, pick what happens most often. Choose Neutral only when you are truly balanced.',
      'You get a 4-letter code (such as INFP or ESTJ) plus how strong your preference is on each dimension.',
    ],
    disclaimer:
      "Toolland wrote this test based on Carl Jung's theory of psychological types. It is not affiliated with the MBTI®, a trademark of The Myers-Briggs Company. Use the result for self-discovery and fun, not for hiring or diagnosis. A preference under 60% means you are fairly balanced on that dimension.",
    minutes: 7,
    file: '16-types-result',
  },
  scale: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
  items: {
    E: [
      'I feel energized after spending time with many people.',
      'I easily start conversations with people I have just met.',
      'I think best when I talk things through with others.',
      'My ideal weekend is going out and meeting friends.',
      'I enjoy working in a lively team with lots of discussion.',
      'I warm up to new people quickly.',
    ],
    I: [
      'After a busy event, I need time alone to recharge.',
      'I prefer one-on-one conversations to large groups.',
      'I usually think through my answer before I speak.',
      'Spending too long in a crowd wears me out.',
      'I am more comfortable communicating in writing than on the phone.',
      'I have a few close friends, and that is enough for me.',
    ],
    S: [
      'I trust facts and real experience more than hunches.',
      'I like clear, step-by-step instructions.',
      'I notice details that others often miss.',
      'I am more interested in what I can apply right away than in theory.',
      'I focus more on what is happening now than on future possibilities.',
      'I like methods that are proven to work.',
    ],
    N: [
      'I often imagine all kinds of future possibilities.',
      'I like to look for meaning or patterns behind events.',
      'I am more interested in the big idea than in the details of carrying it out.',
      'Ideas often pop into my head that have nothing to do with what I am doing.',
      'I enjoy discussing abstract theories and concepts.',
      'I like trying new approaches even when the old one still works.',
    ],
    T: [
      'When making decisions, I put logic ahead of feelings.',
      'I can give honest criticism even if it might hurt.',
      'Fair rules should apply equally to everyone, with no exceptions.',
      'I would rather be seen as competent than as kind.',
      'In a debate, I care more about who is right than about keeping the peace.',
      'I weigh the pros and cons objectively before deciding.',
    ],
    F: [
      "I consider other people's feelings before making a decision.",
      "I am easily moved by other people's stories.",
      'Keeping harmony in a group matters to me.',
      'I find it hard to turn down someone who asks for help.',
      'I decide based on the personal values I believe in.',
      'I would rather encourage than criticize.',
    ],
    J: [
      'I like to plan activities well in advance.',
      'I feel relieved once a decision is made and things are settled.',
      'I make to-do lists and follow them.',
      'I usually finish tasks well before the deadline.',
      'I feel uneasy when plans change suddenly.',
      'My desk and belongings are usually neat.',
    ],
    P: [
      'I prefer to keep my options open rather than decide too soon.',
      'I often work on tasks close to the deadline.',
      'I enjoy last-minute plans.',
      'I would rather go with the flow than follow a strict schedule.',
      'I switch easily from one activity to another.',
      'Rules and schedules that are too strict make me feel boxed in.',
    ],
  },
  letters: {
    E: { name: 'Extraversion', desc: 'Gains energy from interaction and thinks out loud.' },
    I: { name: 'Introversion', desc: 'Gains energy from time alone and thinks before speaking.' },
    S: { name: 'Sensing', desc: 'Focuses on facts, details, and real experience.' },
    N: { name: 'Intuition', desc: 'Focuses on patterns, meaning, and future possibilities.' },
    T: { name: 'Thinking', desc: 'Decides with logic and objective principles.' },
    F: { name: 'Feeling', desc: "Decides with values and people's feelings in mind." },
    J: { name: 'Judging', desc: 'Likes plans, order, and settled decisions.' },
    P: { name: 'Perceiving', desc: 'Likes flexibility, spontaneity, and open options.' },
  },
  types: {
    INTJ: {
      name: 'The Strategist',
      summary:
        'An independent thinker who sees the big picture and builds long-term plans to make it happen. You value competence, logic, and constant improvement.',
      strengths: [
        'Strategic, long-range thinking',
        'Independent and confident in their analysis',
        'Quick to spot flaws in a system',
        'Persistent in pursuing goals',
      ],
      challenges: [
        'Can come across as cold or overly critical',
        'Impatient with anything inefficient',
        'Finds it hard to delegate',
      ],
      careers: [
        'Data analyst',
        'Software architect',
        'Strategy consultant',
        'Researcher',
        'Engineer',
        'Financial planner',
      ],
    },
    INTP: {
      name: 'The Analyst',
      summary:
        'A puzzle solver who loves understanding how things work. You are logical, curious, and enjoy testing ideas from every angle.',
      strengths: [
        'Sharp logical analysis',
        'Deep curiosity',
        'Creative at finding new solutions',
        'Objective and open to ideas',
      ],
      challenges: [
        'Gets lost in thought and delays action',
        'Uninterested in routine matters',
        'Sometimes struggles to express feelings',
      ],
      careers: [
        'Programmer',
        'Scientist',
        'Mathematician',
        'Systems analyst',
        'Academic researcher',
        'Game designer',
      ],
    },
    ENTJ: {
      name: 'The Director',
      summary:
        'A natural leader who is decisive, organized, and results-driven. You set goals quickly, build strategies, and rally people to reach them.',
      strengths: [
        'Leadership and decisiveness',
        'Strong planning and organization',
        'Confident decision-making',
        'Efficient and goal-oriented',
      ],
      challenges: [
        'Can seem domineering',
        'Impatient with people who work slowly',
        'Tends to put targets ahead of feelings',
      ],
      careers: [
        'Manager',
        'Entrepreneur',
        'Management consultant',
        'Lawyer',
        'Project director',
        'Sales executive',
      ],
    },
    ENTP: {
      name: 'The Innovator',
      summary:
        'A quick thinker who loves debate and challenging old ways. You are full of ideas, great at improvising, and enjoy intellectual challenges.',
      strengths: [
        'Creative and innovative',
        'Quick-witted and persuasive',
        'Adaptable',
        'Excited by new challenges',
      ],
      challenges: [
        'Gets bored with routine work',
        'Starts many things but finishes few',
        'Can argue until others are worn out',
      ],
      careers: [
        'Startup founder',
        'Creative marketer',
        'Consultant',
        'Journalist',
        'Product developer',
        'Lawyer',
      ],
    },
    INFJ: {
      name: 'The Confidant',
      summary:
        'A quiet idealist with a deep understanding of people. You hold strong values and want your life to make a difference for others.',
      strengths: [
        'Understands people deeply',
        'Principled and committed',
        'Creative with a long-term vision',
        'A good listener',
      ],
      challenges: [
        'Easily drained emotionally',
        'Perfectionistic and sensitive to criticism',
        'Keeps feelings bottled up',
      ],
      careers: ['Psychologist', 'Counselor', 'Writer', 'Teacher', 'Social worker', 'UX designer'],
    },
    INFP: {
      name: 'The Idealist',
      summary:
        'A gentle soul guided by values and imagination. You want to live true to your conscience and love expressing yourself through creative work.',
      strengths: [
        'Deep empathy',
        'Creative and imaginative',
        'Loyal to personal values',
        'Open and accepting of differences',
      ],
      challenges: [
        'So idealistic that disappointment comes easily',
        'Struggles with conflict',
        'Disorganized with practical matters',
      ],
      careers: ['Writer', 'Illustrator', 'Psychologist', 'Teacher', 'Counselor', 'Translator'],
    },
    ENFJ: {
      name: 'The Mentor',
      summary:
        'A warm leader who reads and motivates people well. You enjoy helping others grow and bringing groups together.',
      strengths: [
        'Charismatic and persuasive',
        'Invested in the growth of others',
        'A great communicator',
        'Good at uniting a team',
      ],
      challenges: [
        'Worries too much about what others think',
        'Finds it hard to say no',
        'May neglect their own needs',
      ],
      careers: [
        'Teacher',
        'Coach',
        'HR specialist',
        'Public relations',
        'Team manager',
        'Counselor',
      ],
    },
    ENFP: {
      name: 'The Spark',
      summary:
        'An enthusiastic, idea-filled person who sees opportunities everywhere. You make friends easily, think creatively, and spread energy to everyone around you.',
      strengths: [
        'Enthusiastic and inspiring',
        'Creative and full of ideas',
        'Warm and sociable',
        'Flexible when things change',
      ],
      challenges: [
        'Easily distracted',
        'Struggles to finish the details',
        'Feels stressed when boxed in by rules',
      ],
      careers: [
        'Marketer',
        'Content creator',
        'Journalist',
        'Designer',
        'Event planner',
        'Counselor',
      ],
    },
    ISTJ: {
      name: 'The Organizer',
      summary:
        'A responsible person who respects rules, facts, and proven habits. You are thorough, dependable, and finish what you start.',
      strengths: [
        'Highly dependable',
        'Thorough and systematic',
        'Honest and direct',
        'Patient and persistent',
      ],
      challenges: [
        'Rigid about change',
        'Wary of unconventional methods',
        'Rarely expresses feelings',
      ],
      careers: [
        'Accountant',
        'Auditor',
        'Administrator',
        'Financial analyst',
        'Civil engineer',
        'Civil servant',
      ],
    },
    ISFJ: {
      name: 'The Caretaker',
      summary:
        "A warm and loyal protector. You notice other people's needs and quietly work hard so everything runs smoothly.",
      strengths: [
        'Attentive and supportive',
        'Thorough and responsible',
        'Loyal and patient',
        'Remembers small details about people',
      ],
      challenges: [
        'Finds it hard to say no',
        'Keeps feelings to themselves',
        'Hesitant about big changes',
      ],
      careers: [
        'Nurse',
        'Elementary teacher',
        'Office administrator',
        'Pharmacist',
        'Librarian',
        'Customer service',
      ],
    },
    ESTJ: {
      name: 'The Manager',
      summary:
        'A practical organizer who likes order and clarity. You lead with clear rules and make sure work gets done on time.',
      strengths: [
        'Organized and efficient',
        'Firm and straightforward',
        'Responsible',
        'Good at managing people and processes',
      ],
      challenges: [
        'Not very flexible',
        'Can be too demanding',
        'Impatient with feelings and untested ideas',
      ],
      careers: [
        'Operations manager',
        'Project lead',
        'Production supervisor',
        'Bank manager',
        'School principal',
        'Contractor',
      ],
    },
    ESFJ: {
      name: 'The Host',
      summary:
        'A friendly, caring person who keeps the people around them close. You love helping, keep things tidy, and value tradition.',
      strengths: [
        'Warm and sociable',
        'Responsible and tidy',
        "Sensitive to people's needs",
        'A strong team player',
      ],
      challenges: [
        'Needs a lot of appreciation',
        'Sensitive to criticism',
        'Struggles with sudden change',
      ],
      careers: [
        'Nurse',
        'Teacher',
        'HR specialist',
        'Event planner',
        'Hospitality',
        'Customer service',
      ],
    },
    ISTP: {
      name: 'The Troubleshooter',
      summary:
        'A calm, practical person who loves figuring out how tools and systems work. You stay quick in emergencies and learn fastest by doing.',
      strengths: [
        'Calm in emergencies',
        'Technically skilled',
        'Logical and practical',
        'Independent and flexible',
      ],
      challenges: ['Bored by long-term plans', 'Private about feelings', 'Can seem indifferent'],
      careers: ['Technician', 'Mechanic', 'Engineer', 'Pilot', 'Forensic specialist', 'Programmer'],
    },
    ISFP: {
      name: 'The Artist',
      summary:
        'A gentle, sensitive person who enjoys beauty and the present moment. You would rather express yourself through your work than through words.',
      strengths: [
        'Eye for beauty',
        'Humble and kind',
        'Flexible and easygoing',
        'True to their own values',
      ],
      challenges: ['Avoids conflict', 'Finds long-term planning hard', 'Easily hurt by criticism'],
      careers: [
        'Graphic designer',
        'Photographer',
        'Musician',
        'Makeup artist',
        'Therapist',
        'Chef',
      ],
    },
    ESTP: {
      name: 'The Doer',
      summary:
        'An energetic person who loves action and is not afraid of risk. You read situations quickly, negotiate well, and live in the moment.',
      strengths: [
        'Bold and responsive',
        'A skilled negotiator',
        'Practical and realistic',
        'Sociable',
      ],
      challenges: ['Impatient', 'Prone to taking too many risks', 'Dislikes rules and planning'],
      careers: [
        'Salesperson',
        'Entrepreneur',
        'Real estate agent',
        'Athlete',
        'Paramedic',
        'Police officer',
      ],
    },
    ESFP: {
      name: 'The Livewire',
      summary:
        'A cheerful, spontaneous person who loves being where the action is. You enjoy life, make friends easily, and lift the mood of everyone nearby.',
      strengths: [
        'Cheerful and fun',
        'Attuned to others',
        'Practical and spontaneous',
        'Confident in front of an audience',
      ],
      challenges: ['Gets bored easily', 'Plans too little', 'Tends to avoid unpleasant problems'],
      careers: [
        'Presenter',
        'Event planner',
        'Salesperson',
        'Tour guide',
        'Flight attendant',
        'Preschool teacher',
      ],
    },
  },
  eyebrow: 'Your personality type',
  barsTitle: 'Preference on each dimension',
  lean: '{n}% {name}.',
  strengths: 'Strengths',
  challenges: 'Challenges',
  careers: 'Careers that fit',
};

export function types16Test(locale: Locale): Types16Test {
  return makeTypes16(locale === 'en' ? EN : ID);
}
