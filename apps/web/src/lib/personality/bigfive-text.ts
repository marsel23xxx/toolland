/**
 * Teks Tes Big Five per bahasa. Hanya diimpor halaman .astro saat build; island menerima teks
 * satu bahasa lewat props. Versi Inggris memakai kalimat IPIP asli (domain publik), versi
 * Indonesia terjemahan Toolland.
 */
import type { Locale } from '../format';
import { makeBigFive, type BigFiveTest, type BigFiveText } from './bigfive';

const SCALE_ID = ['Sangat tidak sesuai', 'Tidak sesuai', 'Netral', 'Sesuai', 'Sangat sesuai'];
const SCALE_EN = ['Very inaccurate', 'Inaccurate', 'Neutral', 'Accurate', 'Very accurate'];

const ID: BigFiveText = {
  meta: {
    title: 'Hasil Tes Kepribadian Big Five',
    intro: [
      'Ada 50 pernyataan tentang dirimu, sekitar 8 menit.',
      'Pilih seberapa sesuai tiap pernyataan dengan dirimu yang biasanya, bukan dirimu yang kamu inginkan.',
      'Tidak ada jawaban benar atau salah. Jawab jujur dan jangan terlalu lama berpikir.',
      'Hasilnya skor 0-100 untuk lima sifat: Keterbukaan, Ketelitian, Ekstraversi, Keramahan, dan Neurotisisme.',
    ],
    disclaimer:
      'Pernyataan tes ini berasal dari International Personality Item Pool (IPIP) yang bebas dipakai umum. Hasilnya untuk mengenal diri, bukan diagnosis psikologis. Skor dihitung dari jawabanmu sendiri, tidak dibandingkan dengan norma populasi.',
    minutes: 8,
    file: 'hasil-tes-big-five',
  },
  scale: SCALE_ID,
  items: [
    'Saya sering menjadi penghidup suasana saat berkumpul.',
    'Saya kurang peduli pada orang lain.',
    'Saya selalu mempersiapkan segala sesuatu.',
    'Saya mudah stres.',
    'Saya punya kosakata yang kaya.',
    'Saya tidak banyak bicara.',
    'Saya tertarik pada orang lain.',
    'Saya suka menaruh barang sembarangan.',
    'Saya santai hampir sepanjang waktu.',
    'Saya sulit memahami ide-ide abstrak.',
    'Saya merasa nyaman berada di antara orang-orang.',
    'Saya suka mengejek atau menyinggung orang lain.',
    'Saya memperhatikan detail.',
    'Saya sering mengkhawatirkan banyak hal.',
    'Saya punya imajinasi yang hidup.',
    'Saya lebih suka berada di belakang layar.',
    'Saya bersimpati pada perasaan orang lain.',
    'Saya sering membuat sesuatu jadi berantakan.',
    'Saya jarang merasa sedih.',
    'Saya tidak tertarik pada ide-ide abstrak.',
    'Saya yang biasanya memulai percakapan.',
    'Saya tidak tertarik pada masalah orang lain.',
    'Saya langsung menyelesaikan pekerjaan rutin tanpa menunda.',
    'Saya mudah gelisah atau terganggu.',
    'Saya punya ide-ide yang bagus.',
    'Saya tidak punya banyak hal untuk dibicarakan.',
    'Saya berhati lembut.',
    'Saya sering lupa mengembalikan barang ke tempatnya.',
    'Saya mudah kesal.',
    'Imajinasi saya kurang bagus.',
    'Saya mengobrol dengan banyak orang yang berbeda saat ada acara.',
    'Saya tidak terlalu tertarik pada orang lain.',
    'Saya suka keteraturan.',
    'Suasana hati saya mudah berubah-ubah.',
    'Saya cepat memahami sesuatu.',
    'Saya tidak suka menarik perhatian.',
    'Saya meluangkan waktu untuk orang lain.',
    'Saya suka menghindari kewajiban.',
    'Saya sering mengalami perubahan suasana hati yang drastis.',
    'Saya memakai kata-kata yang sulit.',
    'Saya tidak keberatan menjadi pusat perhatian.',
    'Saya bisa merasakan emosi orang lain.',
    'Saya mengikuti jadwal.',
    'Saya mudah jengkel.',
    'Saya meluangkan waktu untuk merenungkan banyak hal.',
    'Saya pendiam di depan orang yang belum saya kenal.',
    'Saya membuat orang lain merasa nyaman.',
    'Saya teliti dan menuntut hasil kerja yang tepat.',
    'Saya sering merasa sedih atau murung.',
    'Saya penuh dengan ide.',
  ],
  eyebrow: 'Profil Big Five',
  name: 'Lima sifat utamamu',
  summary:
    'Sifat yang paling menonjol darimu adalah {top}, sedangkan yang paling rendah adalah {bottom}. Tidak ada profil yang lebih baik dari yang lain; tiap kombinasi punya kelebihan sendiri.',
  barsTitle: 'Skor tiap sifat (0-100)',
  bands: { low: 'Rendah', mid: 'Sedang', high: 'Tinggi' },
  traits: {
    O: {
      name: 'Keterbukaan',
      high: {
        desc: 'Kamu penasaran dan imajinatif, suka ide baru, seni, dan cara berpikir yang tidak biasa.',
        strength: 'Kreatif dan cepat menangkap ide baru',
        growth: 'Ide yang banyak perlu diimbangi dengan menuntaskannya satu per satu',
      },
      mid: {
        desc: 'Kamu mau mencoba hal baru kalau jelas manfaatnya, tapi tetap menghargai cara yang sudah terbukti.',
        strength: 'Seimbang antara ide baru dan cara yang sudah terbukti',
        growth: '',
      },
      low: {
        desc: 'Kamu praktis dan membumi. Kamu lebih suka hal yang konkret dan cara yang sudah terbukti daripada teori.',
        strength: 'Praktis, realistis, dan fokus pada hal yang nyata',
        growth: 'Sesekali coba cara baru, siapa tahu lebih efisien dari kebiasaan lama',
      },
    },
    C: {
      name: 'Ketelitian',
      high: {
        desc: 'Kamu teratur, disiplin, dan bisa diandalkan. Rencana dan tenggat biasanya kamu tepati.',
        strength: 'Disiplin, rapi, dan menepati janji',
        growth: 'Jangan terlalu keras pada diri sendiri saat rencana meleset',
      },
      mid: {
        desc: 'Kamu cukup teratur untuk menyelesaikan kewajiban, tapi masih luwes saat keadaan berubah.',
        strength: 'Cukup teratur tapi tetap luwes',
        growth: '',
      },
      low: {
        desc: 'Kamu spontan dan fleksibel, tapi kadang menunda atau melewatkan detail kecil.',
        strength: 'Spontan dan mudah beradaptasi',
        growth: 'Pakai daftar tugas dan pengingat sederhana agar tenggat tidak terlewat',
      },
    },
    E: {
      name: 'Ekstraversi',
      high: {
        desc: 'Kamu bersemangat di tengah orang banyak, mudah membuka obrolan, dan mendapat energi dari interaksi.',
        strength: 'Mudah bergaul dan membangun jaringan',
        growth: 'Beri ruang orang lain bicara dan dengarkan sampai selesai',
      },
      mid: {
        desc: 'Kamu nyaman bergaul tapi juga butuh waktu sendiri, dan bisa menyesuaikan diri dengan suasana.',
        strength: 'Luwes di keramaian maupun saat sendiri',
        growth: '',
      },
      low: {
        desc: 'Kamu tenang dan reflektif, lebih suka obrolan mendalam dengan sedikit orang, dan mengisi energi saat sendiri.',
        strength: 'Pendengar yang baik dan fokus saat bekerja sendiri',
        growth: 'Sesekali sampaikan idemu lebih dulu, karena pendapatmu layak didengar',
      },
    },
    A: {
      name: 'Keramahan',
      high: {
        desc: 'Kamu hangat, peduli, dan mudah percaya. Kamu suka membantu dan cenderung menghindari konflik.',
        strength: 'Empati tinggi dan enak diajak bekerja sama',
        growth: 'Belajar berkata tidak tanpa merasa bersalah',
      },
      mid: {
        desc: 'Kamu peduli pada orang lain, tapi tetap bisa tegas membela kepentinganmu sendiri.',
        strength: 'Peduli tapi tetap bisa tegas',
        growth: '',
      },
      low: {
        desc: 'Kamu lugas, kritis, dan kompetitif. Kamu tidak segan berbeda pendapat demi hasil yang benar.',
        strength: 'Berani bersikap dan objektif dalam menilai',
        growth: 'Sampaikan kritik dengan cara yang tetap menghargai perasaan orang',
      },
    },
    N: {
      name: 'Neurotisisme',
      high: {
        desc: 'Kamu peka terhadap tekanan: mudah cemas, khawatir, atau terbawa suasana hati.',
        strength: 'Peka terhadap risiko dan perasaan',
        growth:
          'Latih cara meredakan stres, misalnya istirahat cukup, olahraga, atau bercerita pada orang yang kamu percaya',
      },
      mid: {
        desc: 'Kamu cukup tenang sehari-hari, walau tekanan besar kadang membuatmu cemas.',
        strength: 'Cukup stabil menghadapi tekanan sehari-hari',
        growth: '',
      },
      low: {
        desc: 'Kamu tenang, stabil, dan jarang panik. Tekanan biasanya tidak lama mengganggumu.',
        strength: 'Tenang dan stabil di bawah tekanan',
        growth: 'Jaga agar ketenanganmu tidak membuat masalah orang lain terlihat sepele',
      },
    },
  },
  strengths: 'Kekuatanmu',
  growth: 'Yang bisa dikembangkan',
};

const EN: BigFiveText = {
  meta: {
    title: 'Big Five Personality Test Result',
    intro: [
      'There are 50 statements about you. It takes about 8 minutes.',
      'Rate how accurately each statement describes you as you generally are now, not as you wish to be.',
      'There are no right or wrong answers. Answer honestly and do not overthink.',
      'You get a 0-100 score for five traits: Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism.',
    ],
    disclaimer:
      'The statements come from the International Personality Item Pool (IPIP), which is in the public domain. The result is for self-discovery, not a psychological diagnosis. Scores come from your own answers and are not compared with population norms.',
    minutes: 8,
    file: 'big-five-result',
  },
  scale: SCALE_EN,
  items: [
    'I am the life of the party.',
    'I feel little concern for others.',
    'I am always prepared.',
    'I get stressed out easily.',
    'I have a rich vocabulary.',
    "I don't talk a lot.",
    'I am interested in people.',
    'I leave my belongings around.',
    'I am relaxed most of the time.',
    'I have difficulty understanding abstract ideas.',
    'I feel comfortable around people.',
    'I insult people.',
    'I pay attention to details.',
    'I worry about things.',
    'I have a vivid imagination.',
    'I keep in the background.',
    "I sympathize with others' feelings.",
    'I make a mess of things.',
    'I seldom feel blue.',
    'I am not interested in abstract ideas.',
    'I start conversations.',
    "I am not interested in other people's problems.",
    'I get chores done right away.',
    'I am easily disturbed.',
    'I have excellent ideas.',
    'I have little to say.',
    'I have a soft heart.',
    'I often forget to put things back in their proper place.',
    'I get upset easily.',
    'I do not have a good imagination.',
    'I talk to a lot of different people at parties.',
    'I am not really interested in others.',
    'I like order.',
    'I change my mood a lot.',
    'I am quick to understand things.',
    "I don't like to draw attention to myself.",
    'I take time out for others.',
    'I shirk my duties.',
    'I have frequent mood swings.',
    'I use difficult words.',
    "I don't mind being the center of attention.",
    "I feel others' emotions.",
    'I follow a schedule.',
    'I get irritated easily.',
    'I spend time reflecting on things.',
    'I am quiet around strangers.',
    'I make people feel at ease.',
    'I am exacting in my work.',
    'I often feel blue.',
    'I am full of ideas.',
  ],
  eyebrow: 'Big Five profile',
  name: 'Your five core traits',
  summary:
    'Your most prominent trait is {top}, and your lowest is {bottom}. No profile is better than another; every combination has its own strengths.',
  barsTitle: 'Score per trait (0-100)',
  bands: { low: 'Low', mid: 'Moderate', high: 'High' },
  traits: {
    O: {
      name: 'Openness',
      high: {
        desc: 'You are curious and imaginative, and enjoy new ideas, art, and unconventional thinking.',
        strength: 'Creative and quick to pick up new ideas',
        growth: 'Balance your many ideas by finishing them one at a time',
      },
      mid: {
        desc: 'You try new things when they make sense, while still valuing proven ways.',
        strength: 'Balanced between new ideas and proven methods',
        growth: '',
      },
      low: {
        desc: 'You are practical and down to earth, and prefer concrete facts and proven methods over theory.',
        strength: 'Practical, realistic, and focused on what is real',
        growth: 'Try a new approach now and then; it may beat an old habit',
      },
    },
    C: {
      name: 'Conscientiousness',
      high: {
        desc: 'You are organized, disciplined, and reliable. You usually keep plans and deadlines.',
        strength: 'Disciplined, tidy, and dependable',
        growth: 'Go easy on yourself when plans fall through',
      },
      mid: {
        desc: 'You are organized enough to meet your obligations, yet flexible when things change.',
        strength: 'Organized but still flexible',
        growth: '',
      },
      low: {
        desc: 'You are spontaneous and flexible, but sometimes procrastinate or miss small details.',
        strength: 'Spontaneous and adaptable',
        growth: 'Use simple to-do lists and reminders so deadlines do not slip',
      },
    },
    E: {
      name: 'Extraversion',
      high: {
        desc: 'You come alive around people, start conversations easily, and gain energy from interaction.',
        strength: 'Sociable and good at networking',
        growth: 'Leave room for others to talk, and listen to the end',
      },
      mid: {
        desc: 'You enjoy company but also need time alone, and adapt to the situation.',
        strength: 'Comfortable both in a crowd and on your own',
        growth: '',
      },
      low: {
        desc: 'You are calm and reflective, prefer deep talks with a few people, and recharge alone.',
        strength: 'A good listener who focuses well alone',
        growth: 'Share your ideas first now and then; your view deserves to be heard',
      },
    },
    A: {
      name: 'Agreeableness',
      high: {
        desc: 'You are warm, caring, and trusting. You like to help and tend to avoid conflict.',
        strength: 'Empathetic and easy to work with',
        growth: 'Learn to say no without feeling guilty',
      },
      mid: {
        desc: 'You care about others but can still stand up for your own interests.',
        strength: 'Caring yet assertive',
        growth: '',
      },
      low: {
        desc: 'You are direct, critical, and competitive, and do not shy away from disagreement to get things right.',
        strength: 'Takes a stand and judges objectively',
        growth: "Deliver criticism in a way that respects people's feelings",
      },
    },
    N: {
      name: 'Neuroticism',
      high: {
        desc: 'You are sensitive to pressure: you worry easily, feel anxious, or get carried by your moods.',
        strength: 'Alert to risks and feelings',
        growth:
          'Practice ways to relieve stress, such as enough rest, exercise, or talking to someone you trust',
      },
      mid: {
        desc: 'You are fairly calm day to day, though heavy pressure can make you anxious.',
        strength: 'Fairly steady under everyday pressure',
        growth: '',
      },
      low: {
        desc: 'You are calm, stable, and rarely panic. Stress does not bother you for long.',
        strength: 'Calm and steady under pressure',
        growth: "Make sure your calm does not make other people's problems seem small",
      },
    },
  },
  strengths: 'Your strengths',
  growth: 'Room to grow',
};

export function bigFiveTest(locale: Locale): BigFiveTest {
  return makeBigFive(locale === 'en' ? EN : ID);
}
