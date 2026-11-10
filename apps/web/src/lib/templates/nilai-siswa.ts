/**
 * Template Nilai Siswa (untuk guru mata pelajaran): daftar siswa banyak kelas, nilai tugas,
 * ulangan harian, PTS/STS, PAS/SAS dengan bobot, nilai akhir, predikat sesuai KKTP, status tuntas,
 * peringkat kelas, deskripsi capaian otomatis, lembar nilai per siswa, rekap kelas, dan dashboard.
 * Nilai akhir = rata-rata berbobot dari komponen yang sudah terisi.
 */
import type { Locale } from '../format';
import { type Style, Workbook } from '../xlsx';
import {
  type FormValues,
  type TemplateForm,
  formChoice,
  formList,
  formNumber,
  formText,
} from './form';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  GOOD,
  GOOD_BG,
  INK,
  WARN,
  WARN_BG,
  cleanList,
  kpiCard,
  makeStyles,
  menuSheet,
  q,
  seeded,
  sheetHeader,
} from './kit';

export interface GradesOptions {
  locale: Locale;
  school: string;
  teacher: string;
  subject: string;
  academicYear: string;
  semester: string;
  kktp: number;
  classes: string[];
  /** "Nama | kelas" per baris. */
  students: string[];
  sample: boolean;
}

const FIRST = 6;
const STUDENT_ROWS = 240;
const CLASS_ROWS = 12;
const TASKS = 6;
const QUIZZES = 4;

const L = {
  id: {
    brand: 'TOOLLAND · NILAI SISWA',
    name: 'Nilai Siswa',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      grades: 'Nilai',
      card: 'Rapor Siswa',
      recap: 'Rekap Kelas',
      students: 'Siswa',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Rata-rata, persentase tuntas, siswa remedial, siswa terbaik, sebaran nilai, dan grafik per kelas.',
      grades:
        'Nilai tugas, ulangan harian, PTS, PAS; nilai akhir, predikat, status, peringkat, dan deskripsi otomatis.',
      card: 'Lembar nilai satu siswa siap cetak untuk dibagikan ke siswa atau orang tua.',
      recap:
        'Ringkasan per kelas: rata-rata, tertinggi, terendah, persentase tuntas, dan sebaran predikat.',
      students: 'Daftar siswa: NIS, NISN, nama, jenis kelamin, kelas, dan kehadiran.',
      set: 'Sekolah, guru, mata pelajaran, semester, KKTP, bobot nilai, batas predikat, dan deskripsi.',
    },
    subtitle: {
      menu: 'Olah nilai siswa satu mata pelajaran untuk banyak kelas sekaligus. Mulai dari Pengaturan.',
      grades:
        'Isi nilai 0-100 di sel krem. Nilai akhir memakai bobot di Pengaturan dan hanya menghitung komponen yang sudah diisi.',
      card: 'Pilih NIS siswa, lalu cetak (Ctrl+P) atau simpan sebagai PDF.',
      recap: 'Dihitung otomatis dari sheet Nilai.',
      students: 'Satu baris per siswa. Urutan baris sama dengan sheet Nilai.',
      set: 'Atur sekali di awal semester.',
      dash: 'Ringkasan nilai semua kelas.',
    },
    steps: [
      'Isi Pengaturan (sekolah, mapel, KKTP, bobot) dan daftar siswa beserta kelasnya di sheet Siswa.',
      'Masukkan nilai tugas, ulangan harian, PTS, dan PAS di sheet Nilai. Nilai akhir dan predikat terisi otomatis.',
      'Lihat Rekap Kelas dan Dashboard, lalu cetak Rapor Siswa untuk tiap anak.',
    ],
    set: [
      ['Nama sekolah', 'SchoolName', 'text'],
      ['Guru mata pelajaran', 'TeacherName', 'text'],
      ['NIP', 'TeacherId', 'text'],
      ['Mata pelajaran', 'SubjectName', 'text'],
      ['Tahun ajaran', 'AcademicYear', 'text'],
      ['Semester', 'Semester', 'text'],
      ['KKTP / KKM', 'Kktp', 'int'],
      ['Kota & tanggal rapor', 'ReportPlace', 'text'],
    ] as [string, string, string][],
    weightsH: 'Bobot nilai akhir (%)',
    weights: ['Rata-rata tugas', 'Rata-rata ulangan harian', 'PTS / STS', 'PAS / SAS'],
    weightTotal: 'Total bobot',
    predH: 'Predikat & deskripsi',
    predHead: ['Predikat', 'Nilai minimal', 'Deskripsi capaian'],
    predDesc: [
      'Menunjukkan penguasaan yang sangat baik pada seluruh materi dan mampu menerapkannya.',
      'Menunjukkan penguasaan yang baik pada sebagian besar materi.',
      'Cukup menguasai materi, perlu penguatan pada beberapa bagian.',
      'Belum mencapai KKTP, perlu bimbingan dan remedial.',
    ],
    predNote:
      'Nilai minimal predikat C mengikuti KKTP. Ubah angka dan deskripsi sesuai kebijakan sekolah.',
    classesH: 'Daftar kelas',
    semesters: ['Ganjil', 'Genap'],
    gender: ['L', 'P'],
    students: ['No', 'NIS', 'NISN', 'Nama siswa', 'L/P', 'Kelas', 'Sakit', 'Izin', 'Alpa'],
    gradesHead: {
      base: ['NIS', 'Nama', 'Kelas'],
      task: 'T',
      taskAvg: 'Rata tugas',
      quiz: 'UH',
      quizAvg: 'Rata UH',
      mid: 'PTS',
      fin: 'PAS',
      final: 'Nilai akhir',
      pred: 'Predikat',
      status: 'Status',
      rank: 'Peringkat',
      desc: 'Deskripsi',
    },
    passed: 'Tuntas',
    remedial: 'Remedial',
    groupTasks: 'Tugas',
    groupQuiz: 'Ulangan harian',
    groupExam: 'Ujian',
    groupResult: 'Hasil',
    card: {
      pick: 'NIS siswa',
      title: 'LAPORAN NILAI',
      name: 'Nama siswa',
      cls: 'Kelas',
      nis: 'NIS / NISN',
      subject: 'Mata pelajaran',
      period: 'Semester',
      comp: ['Komponen', 'Nilai', 'Bobot'],
      tasks: 'Rata-rata tugas',
      quiz: 'Rata-rata ulangan harian',
      mid: 'PTS / STS',
      fin: 'PAS / SAS',
      final: 'NILAI AKHIR',
      pred: 'Predikat',
      status: 'Status',
      rank: 'Peringkat di kelas',
      of: ' dari ',
      desc: 'Deskripsi capaian',
      att: 'Kehadiran',
      attHead: ['Sakit', 'Izin', 'Alpa'],
      days: ' hari',
      parent: 'Orang tua / wali',
      teacher: 'Guru mata pelajaran',
      detail: 'Rincian nilai',
      notFound: 'NIS tidak ditemukan.',
    },
    recap: [
      'Kelas',
      'Siswa',
      'Rata-rata',
      'Tertinggi',
      'Terendah',
      '% tuntas',
      'Remedial',
      'A',
      'B',
      'C',
      'D',
    ],
    total: 'Semua kelas',
    kStudents: 'Jumlah siswa',
    kAvg: 'Rata-rata nilai akhir',
    kPass: 'Tuntas',
    kRemedial: 'Perlu remedial',
    kTop: 'Nilai tertinggi',
    kBestClass: 'Kelas terbaik',
    kA: 'Predikat A',
    kAbsent: 'Total alpa',
    classes: ' kelas',
    kktpNote: 'KKTP: ',
    ofStudents: ' siswa',
    avgNote: 'Rata-rata ',
    chartClass: 'Rata-rata per kelas',
    chartPred: 'Sebaran predikat',
    chartDist: 'Sebaran nilai akhir',
    bins: ['< 60', '60–69', '70–79', '80–89', '90–100'],
    topH: '10 siswa terbaik',
    remH: 'Perlu remedial',
    topHead: ['Nama', 'Kelas', 'Nilai'],
    noRemedial: 'Semua siswa tuntas.',
    avgLabel: 'Rata-rata',
    countLabel: 'Siswa',
    sample: {
      school: 'SMP Negeri 1 Harapan',
      teacher: 'Dra. Sri Wahyuni',
      subject: 'Matematika',
      place: 'Sleman, 19 Desember 2025',
      classes: ['VII A', 'VII B', 'VII C'],
      first: [
        'Aditya',
        'Bagas',
        'Citra',
        'Dinda',
        'Eka',
        'Farhan',
        'Gita',
        'Hana',
        'Ilham',
        'Jihan',
        'Kevin',
        'Laras',
        'Malik',
        'Nadia',
        'Oki',
        'Putri',
        'Raka',
        'Salsa',
        'Tegar',
        'Umi',
        'Vino',
        'Wulan',
        'Yoga',
        'Zahra',
        'Arya',
        'Bella',
        'Dimas',
        'Fitri',
        'Galih',
        'Intan',
      ],
      last: [
        'Pratama',
        'Putri',
        'Saputra',
        'Lestari',
        'Ramadhan',
        'Nugraha',
        'Anggraini',
        'Wijaya',
        'Kusuma',
        'Maharani',
      ],
    },
  },
  en: {
    brand: 'TOOLLAND · STUDENT GRADES',
    name: 'Student Grades',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      grades: 'Grades',
      card: 'Student Report',
      recap: 'Class Summary',
      students: 'Students',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Average, pass rate, students needing remedial work, top students, grade spread, and charts by class.',
      grades:
        'Assignments, quizzes, midterm, final exam; final grade, letter, status, class rank, and automatic comments.',
      card: 'Printable grade report for one student, to share with the student or parents.',
      recap: 'Summary by class: average, highest, lowest, pass rate, and letter grade spread.',
      students: 'Student list: ID, national ID, name, gender, class, and attendance.',
      set: 'School, teacher, subject, term, passing grade, weights, letter grade cut-offs, and comments.',
    },
    subtitle: {
      menu: 'Grade one subject across several classes at once. Start with Settings.',
      grades:
        'Enter scores 0-100 in the cream cells. The final grade uses the weights in Settings and only counts components already filled in.',
      card: 'Choose a student ID, then print (Ctrl+P) or save as PDF.',
      recap: 'Calculated from the Grades sheet.',
      students: 'One row per student. Rows line up with the Grades sheet.',
      set: 'Set this up at the start of term.',
      dash: 'Grade summary for all classes.',
    },
    steps: [
      'Fill in Settings (school, subject, passing grade, weights) and your students with their classes.',
      'Enter assignment, quiz, midterm, and final exam scores in Grades. Final grades and letters fill in.',
      'Check the Class Summary and Dashboard, then print a Student Report for each student.',
    ],
    set: [
      ['School', 'SchoolName', 'text'],
      ['Teacher', 'TeacherName', 'text'],
      ['Staff ID', 'TeacherId', 'text'],
      ['Subject', 'SubjectName', 'text'],
      ['Academic year', 'AcademicYear', 'text'],
      ['Term', 'Semester', 'text'],
      ['Passing grade', 'Kktp', 'int'],
      ['Place & report date', 'ReportPlace', 'text'],
    ] as [string, string, string][],
    weightsH: 'Final grade weights (%)',
    weights: ['Assignment average', 'Quiz average', 'Midterm', 'Final exam'],
    weightTotal: 'Total weight',
    predH: 'Letter grades & comments',
    predHead: ['Letter', 'Minimum score', 'Comment'],
    predDesc: [
      'Shows excellent mastery of all material and can apply it.',
      'Shows good mastery of most of the material.',
      'Adequate understanding; needs reinforcement in some areas.',
      'Below the passing grade; needs support and remedial work.',
    ],
    predNote:
      'The minimum for C follows the passing grade. Adjust the numbers and comments to your school policy.',
    classesH: 'Classes',
    semesters: ['Term 1', 'Term 2'],
    gender: ['M', 'F'],
    students: [
      'No',
      'Student ID',
      'National ID',
      'Student name',
      'M/F',
      'Class',
      'Sick',
      'Excused',
      'Absent',
    ],
    gradesHead: {
      base: ['ID', 'Name', 'Class'],
      task: 'A',
      taskAvg: 'Assign. avg',
      quiz: 'Q',
      quizAvg: 'Quiz avg',
      mid: 'Mid',
      fin: 'Final',
      final: 'Final grade',
      pred: 'Letter',
      status: 'Status',
      rank: 'Rank',
      desc: 'Comment',
    },
    passed: 'Passed',
    remedial: 'Remedial',
    groupTasks: 'Assignments',
    groupQuiz: 'Quizzes',
    groupExam: 'Exams',
    groupResult: 'Result',
    card: {
      pick: 'Student ID',
      title: 'GRADE REPORT',
      name: 'Student',
      cls: 'Class',
      nis: 'ID / National ID',
      subject: 'Subject',
      period: 'Term',
      comp: ['Component', 'Score', 'Weight'],
      tasks: 'Assignment average',
      quiz: 'Quiz average',
      mid: 'Midterm',
      fin: 'Final exam',
      final: 'FINAL GRADE',
      pred: 'Letter grade',
      status: 'Status',
      rank: 'Class rank',
      of: ' of ',
      desc: 'Comment',
      att: 'Attendance',
      attHead: ['Sick', 'Excused', 'Absent'],
      days: ' days',
      parent: 'Parent / guardian',
      teacher: 'Subject teacher',
      detail: 'Score details',
      notFound: 'Student ID not found.',
    },
    recap: [
      'Class',
      'Students',
      'Average',
      'Highest',
      'Lowest',
      '% passed',
      'Remedial',
      'A',
      'B',
      'C',
      'D',
    ],
    total: 'All classes',
    kStudents: 'Students',
    kAvg: 'Average final grade',
    kPass: 'Passed',
    kRemedial: 'Need remedial',
    kTop: 'Top score',
    kBestClass: 'Best class',
    kA: 'Grade A',
    kAbsent: 'Total absences',
    classes: ' classes',
    kktpNote: 'Passing grade: ',
    ofStudents: ' students',
    avgNote: 'Average ',
    chartClass: 'Average by class',
    chartPred: 'Letter grade spread',
    chartDist: 'Final grade distribution',
    bins: ['< 60', '60–69', '70–79', '80–89', '90–100'],
    topH: 'Top 10 students',
    remH: 'Need remedial work',
    topHead: ['Name', 'Class', 'Grade'],
    noRemedial: 'Every student passed.',
    avgLabel: 'Average',
    countLabel: 'Students',
    sample: {
      school: 'Harapan Junior High School',
      teacher: 'Mrs. Sri Wahyuni',
      subject: 'Mathematics',
      place: 'Sleman, 19 December 2025',
      classes: ['7A', '7B', '7C'],
      first: [
        'Aditya',
        'Bagas',
        'Citra',
        'Dinda',
        'Eka',
        'Farhan',
        'Gita',
        'Hana',
        'Ilham',
        'Jihan',
        'Kevin',
        'Laras',
        'Malik',
        'Nadia',
        'Oki',
        'Putri',
        'Raka',
        'Salsa',
        'Tegar',
        'Umi',
        'Vino',
        'Wulan',
        'Yoga',
        'Zahra',
        'Arya',
        'Bella',
        'Dimas',
        'Fitri',
        'Galih',
        'Intan',
      ],
      last: [
        'Pratama',
        'Putri',
        'Saputra',
        'Lestari',
        'Ramadhan',
        'Nugraha',
        'Anggraini',
        'Wijaya',
        'Kusuma',
        'Maharani',
      ],
    },
  },
};

const form = (locale: Locale): TemplateForm => {
  const id = locale === 'id';
  return {
    template: 'grades',
    fileBase: id ? 'Nilai-Siswa' : 'Student-Grades',
    fileKey: 'subject',
    heading: id ? 'Atur sesuai kelasmu' : 'Set it up for your classes',
    fields: [
      {
        key: 'school',
        kind: 'text',
        label: id ? 'Nama sekolah' : 'School',
        placeholder: id ? 'misalnya SMP Negeri 1 Harapan' : 'for example Harapan Junior High',
        span: 2,
      },
      {
        key: 'subject',
        kind: 'text',
        label: id ? 'Mata pelajaran' : 'Subject',
        placeholder: id ? 'Matematika' : 'Mathematics',
      },
      { key: 'teacher', kind: 'text', label: id ? 'Nama guru' : 'Teacher' },
      {
        key: 'academicYear',
        kind: 'text',
        label: id ? 'Tahun ajaran' : 'Academic year',
        value: (() => {
          const y = new Date().getFullYear();
          const m = new Date().getMonth();
          return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
        })(),
      },
      {
        key: 'semester',
        kind: 'select',
        label: id ? 'Semester' : 'Term',
        options: L[locale].semesters.map((s) => ({ value: s, label: s })),
        value: L[locale].semesters[0],
      },
      {
        key: 'kktp',
        kind: 'number',
        label: id ? 'KKTP / KKM' : 'Passing grade',
        value: 75,
        min: 0,
        max: 100,
      },
      {
        key: 'classes',
        kind: 'list',
        label: id ? 'Kelas' : 'Classes',
        value: id ? 'VII A\nVII B\nVII C' : '7A\n7B\n7C',
        max: CLASS_ROWS,
      },
      {
        key: 'students',
        kind: 'list',
        label: id ? 'Siswa (nama | kelas)' : 'Students (name | class)',
        value: '',
        max: STUDENT_ROWS,
        hint: id
          ? 'Opsional. Satu per baris, misalnya "Citra Lestari | VII A". Bisa ditempel dari daftar sekolah.'
          : 'Optional. One per line, for example "Citra Lestari | 7A".',
      },
    ],
    note: id
      ? 'Bobot bawaan: tugas 20%, ulangan harian 30%, PTS 20%, PAS 30%. Predikat A ≥ 90, B ≥ 80, C ≥ KKTP. Semuanya bisa diubah di sheet Pengaturan.'
      : 'Default weights: assignments 20%, quizzes 30%, midterm 20%, final exam 30%. Letters: A ≥ 90, B ≥ 80, C ≥ passing grade. All editable in Settings.',
    sample: id
      ? {
          label: 'Isi contoh data',
          hint: '3 kelas dengan 90 siswa dan nilai satu semester lengkap, jadi rekap, rapor, dan dashboard langsung terisi.',
        }
      : {
          label: 'Include sample data',
          hint: '3 classes with 90 students and a full term of scores, so summaries, reports, and the dashboard are filled in.',
        },
  };
};

export const GRADES_FORM: Record<Locale, TemplateForm> = { id: form('id'), en: form('en') };

export function buildFromForm(v: FormValues): Workbook {
  const locale = formChoice(v, 'locale', ['id', 'en'] as const, 'id');
  return buildGradesWorkbook({
    locale,
    school: formText(v, 'school'),
    teacher: formText(v, 'teacher'),
    subject: formText(v, 'subject'),
    academicYear: formText(v, 'academicYear', 20),
    semester: formText(v, 'semester', 20),
    kktp: formNumber(v, 'kktp', 75, 0, 100),
    classes: formList(v, 'classes'),
    students: formList(v, 'students'),
    sample: v.sample === true,
  });
}

export function buildGradesWorkbook(opts: GradesOptions): Workbook {
  const { locale } = opts;
  const t = L[locale];
  const S = t.sheets;
  const G = t.gradesHead;
  const accent = ACCENTS.nila;
  const st = makeStyles(accent, 'IDR', locale);
  const sample = opts.sample;
  const classes = sample ? t.sample.classes : cleanList(opts.classes, CLASS_ROWS);
  const smp = sample ? makeSample() : undefined;
  const students =
    smp ??
    opts.students
      .map((l) => l.split('|').map((x) => x.replace(/\s+/g, ' ').trim()))
      .filter((s) => s[0])
      .slice(0, STUDENT_ROWS)
      .map(([name, cls]) => ({
        name: name.slice(0, 60),
        cls: cls ?? '',
        gender: '',
        scores: undefined as number[] | undefined,
        att: undefined as number[] | undefined,
      }));
  const school =
    opts.school.trim().slice(0, 80) ||
    (sample ? t.sample.school : locale === 'id' ? 'Nama Sekolah' : 'School Name');
  const subject =
    opts.subject.trim().slice(0, 60) ||
    (sample ? t.sample.subject : locale === 'id' ? 'Mata Pelajaran' : 'Subject');
  const PASS = q(t.passed);
  const REM = q(t.remedial);

  const wb = new Workbook({ title: `${t.name} – ${subject}`, subject: t.name, company: school });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shGr = wb.addSheet(S.grades, { tabColor: '3C6A33', ...landscape });
  const shCard = wb.addSheet(S.card, { tabColor: '8F5E0A', gridlines: false, fitWidth: true });
  const shRec = wb.addSheet(S.recap, { tabColor: 'A8461F', ...landscape });
  const shStu = wb.addSheet(S.students, { tabColor: 'A8461F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const last = FIRST + STUDENT_ROWS - 1;
  const col = (sheet: string, c: string) => ref(sheet, `$${c}$${FIRST}:$${c}$${last}`);

  // ---------- Daftar ----------
  t.semesters.forEach((s, i) => shList.set(`B${i + 2}`, s));
  wb.defineName('Semesters', ref(S.list, '$B$2:$B$3'));
  t.gender.forEach((g, i) => shList.set(`D${i + 2}`, g));
  wb.defineName('Genders', ref(S.list, '$D$2:$D$3'));

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'I',
    menu,
  });
  shSet.widths({ B: 26, C: 32, D: 3, E: 12, F: 13, G: 56, H: 3, I: 14 });
  const setVals: Record<string, string | number> = {
    SchoolName: school,
    TeacherName: opts.teacher.trim().slice(0, 60) || (sample ? t.sample.teacher : ''),
    TeacherId: '',
    SubjectName: subject,
    AcademicYear: opts.academicYear || '2025/2026',
    Semester: t.semesters.includes(opts.semester) ? opts.semester : t.semesters[0],
    Kktp: Math.round(Math.max(0, Math.min(100, opts.kktp))),
    ReportPlace: sample ? t.sample.place : '',
  };
  t.set.forEach(([label, name, kind], i) => {
    const r = 5 + i;
    shSet
      .set(`B${r}`, label, st.label)
      .set(`C${r}`, setVals[name], kind === 'int' ? st.inputInt : st.inputText)
      .height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.validate('C10', { type: 'list', formula1: '=Semesters', errorStyle: 'warning' });
  shSet.validate('C11', { type: 'whole', operator: 'between', formula1: '0', formula2: '100' });
  shSet.merge('B14:C14', t.weightsH, st.h2);
  const wDefault = [20, 30, 20, 30];
  const wNames = ['WTask', 'WQuiz', 'WMid', 'WFinal'];
  t.weights.forEach((label, i) => {
    shSet
      .set(`B${15 + i}`, label, st.rowLabel)
      .set(`C${15 + i}`, wDefault[i], { ...st.input, numFmt: '0"%"', align: { h: 'center' } });
    wb.defineName(wNames[i], ref(S.set, `$C$${15 + i}`));
  });
  shSet
    .set('B19', t.weightTotal, st.totalLabel)
    .set('C19', '=SUM(C15:C18)', { ...st.totalMoney, numFmt: '0"%"', align: { h: 'center' } });
  shSet.cond('C19', {
    type: 'cellIs',
    operator: 'notEqual',
    formula: '100',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shSet.merge('E5:G5', t.predH, st.h2);
  t.predHead.forEach((h, i) => shSet.set(`${'EFG'[i]}6`, h, i === 2 ? st.thLeft : st.th));
  const letters = ['A', 'B', 'C', 'D'];
  const mins: (number | string)[] = [90, 80, '=Kktp', 0];
  letters.forEach((l, i) => {
    const r = 7 + i;
    shSet
      .set(`E${r}`, l, { ...st.calcCenter, font: { size: 12, bold: true } })
      .set(`F${r}`, mins[i], i === 2 || i === 3 ? st.calcCenter : st.inputInt)
      .set(`G${r}`, t.predDesc[i], {
        ...st.inputText,
        align: { wrap: true, v: 'center', indent: 1 },
      })
      .height(r, 34);
  });
  shSet.merge('E11:G12', t.predNote, st.note);
  wb.defineName('PredLetters', ref(S.set, '$E$7:$E$10'));
  wb.defineName('PredMin', ref(S.set, '$F$7:$F$10'));
  wb.defineName('PredDesc', ref(S.set, '$G$7:$G$10'));
  shSet.set('I5', t.classesH, st.h2).set('I6', t.classesH, st.thLeft);
  for (let k = 0; k < CLASS_ROWS; k++) shSet.set(`I${7 + k}`, classes[k] ?? null, st.inputText);
  wb.defineName('Classes', ref(S.set, `$I$7:$I$${6 + CLASS_ROWS}`));

  // ---------- Siswa ----------
  sheetHeader(shStu, st, {
    brand: t.brand,
    title: S.students,
    subtitle: t.subtitle.students,
    lastCol: 'J',
    menu,
  });
  const SC = 'BCDEFGHIJ';
  [6, 12, 14, 30, 6, 10, 8, 8, 8].forEach((w, i) => shStu.width(SC[i], w));
  t.students.forEach((h, i) => shStu.set(`${SC[i]}${head}`, h, i === 3 ? st.thLeft : st.th));
  shStu.height(head, 26);
  for (let r = FIRST; r <= last; r++) {
    const s = students[r - FIRST];
    const n = r - FIRST + 1;
    shStu
      .set(`B${r}`, `=IF($E${r}="","",ROW()-${head})`, st.calcCenter)
      .set(`C${r}`, s ? (sample ? `${2500 + n}` : `${1000 + n}`) : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`D${r}`, s && sample ? `00${80000000 + n * 137}` : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`E${r}`, s?.name ?? null, st.inputText)
      .set(`F${r}`, s?.gender || null, { ...st.inputText, align: { h: 'center' } })
      .set(`G${r}`, s?.cls || null, { ...st.inputText, align: { h: 'center' } })
      .set(`H${r}`, s?.att?.[0] ?? null, st.inputInt)
      .set(`I${r}`, s?.att?.[1] ?? null, st.inputInt)
      .set(`J${r}`, s?.att?.[2] ?? null, st.inputInt);
  }
  shStu.validate(`C${FIRST}:C${last}`, {
    type: 'custom',
    formula1: `COUNTIF($C$${FIRST}:$C$${last},C${FIRST})=1`,
    error: 'Duplicate',
  });
  shStu.validate(`F${FIRST}:F${last}`, { type: 'list', formula1: '=Genders' });
  shStu.validate(`G${FIRST}:G${last}`, { type: 'list', formula1: '=Classes' });
  for (const c of 'HIJ')
    shStu.validate(`${c}${FIRST}:${c}${last}`, {
      type: 'whole',
      operator: 'between',
      formula1: '0',
      formula2: '200',
    });
  shStu.cond(`J${FIRST}:J${last}`, {
    type: 'cellIs',
    operator: 'greaterThanOrEqual',
    formula: '3',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shStu.freeze(`F${FIRST}`).autoFilter(`B${head}:J${last}`);
  wb.defineName('StuNis', col(S.students, 'C'));
  wb.defineName('StuNisn', col(S.students, 'D'));
  wb.defineName('StuName', col(S.students, 'E'));
  wb.defineName('StuClass', col(S.students, 'G'));
  wb.defineName('StuSick', col(S.students, 'H'));
  wb.defineName('StuExcused', col(S.students, 'I'));
  wb.defineName('StuAbsent', col(S.students, 'J'));

  // ---------- Nilai ----------
  sheetHeader(shGr, st, {
    brand: t.brand,
    title: S.grades,
    subtitle: t.subtitle.grades,
    lastCol: 'W',
    menu,
  });
  // Kolom: B NIS, C Nama, D Kelas, E-J tugas, K rata tugas, L-O UH, P rata UH, Q PTS, R PAS,
  // S nilai akhir, T predikat, U status, V peringkat, W deskripsi; X-Z bantu (tersembunyi).
  const TC = ['E', 'F', 'G', 'H', 'I', 'J'];
  const QC = ['L', 'M', 'N', 'O'];
  shGr.widths({ B: 9, C: 24, D: 8, K: 9, P: 9, Q: 7, R: 7, S: 10, T: 9, U: 10, V: 9, W: 46 });
  for (const c of [...TC, ...QC]) shGr.width(c, 5.5);
  for (const c of 'XYZ') shGr.width(c, 6, true);
  // Baris 4: kelompok kolom
  shGr
    .merge('E4:K4', t.groupTasks, st.section)
    .merge('L4:P4', t.groupQuiz, st.section)
    .merge('Q4:R4', t.groupExam, st.section)
    .merge('S4:W4', t.groupResult, st.section);
  G.base.forEach((h, i) => shGr.set(`${'BCD'[i]}${head}`, h, i === 1 ? st.thLeft : st.th));
  TC.forEach((c, i) => shGr.set(`${c}${head}`, `${G.task}${i + 1}`, st.th));
  shGr.set(`K${head}`, G.taskAvg, st.th);
  QC.forEach((c, i) => shGr.set(`${c}${head}`, `${G.quiz}${i + 1}`, st.th));
  shGr
    .set(`P${head}`, G.quizAvg, st.th)
    .set(`Q${head}`, G.mid, st.th)
    .set(`R${head}`, G.fin, st.th);
  shGr
    .set(`S${head}`, G.final, st.th)
    .set(`T${head}`, G.pred, st.th)
    .set(`U${head}`, G.status, st.th)
    .set(`V${head}`, G.rank, st.th)
    .set(`W${head}`, G.desc, st.thLeft);
  for (const c of 'XYZ') shGr.set(`${c}${head}`, '#');
  shGr.height(head, 30);
  const score: Style = { ...st.input, numFmt: '0;;0;@', align: { h: 'center' } };
  for (let r = FIRST; r <= last; r++) {
    const s = students[r - FIRST];
    const sc = s?.scores;
    const stu = `'${S.students}'!`;
    const comp = (avg: string, w: string) => `IF(${avg}="",0,${w})`;
    const num = `IF($K${r}="",0,$K${r}*WTask)+IF($P${r}="",0,$P${r}*WQuiz)+IF($Q${r}="",0,$Q${r}*WMid)+IF($R${r}="",0,$R${r}*WFinal)`;
    const den = `${comp(`$K${r}`, 'WTask')}+${comp(`$P${r}`, 'WQuiz')}+${comp(`$Q${r}`, 'WMid')}+${comp(`$R${r}`, 'WFinal')}`;
    shGr
      .set(`B${r}`, `=IF(${stu}$E${r}="","",${stu}$C${r}&"")`, st.calcCenter)
      .set(`C${r}`, `=IF(${stu}$E${r}="","",${stu}$E${r})`, st.calcText)
      .set(`D${r}`, `=IF($C${r}="","",${stu}$G${r}&"")`, st.calcCenter);
    TC.forEach((c, i) => shGr.set(`${c}${r}`, sc?.[i] ?? null, score));
    shGr.set(`K${r}`, `=IF(COUNT(E${r}:J${r})=0,"",ROUND(AVERAGE(E${r}:J${r}),1))`, {
      ...st.calcCenter,
      numFmt: '0.0',
    });
    QC.forEach((c, i) => shGr.set(`${c}${r}`, sc?.[TASKS + i] ?? null, score));
    shGr
      .set(`P${r}`, `=IF(COUNT(L${r}:O${r})=0,"",ROUND(AVERAGE(L${r}:O${r}),1))`, {
        ...st.calcCenter,
        numFmt: '0.0',
      })
      .set(`Q${r}`, sc?.[TASKS + QUIZZES] ?? null, score)
      .set(`R${r}`, sc?.[TASKS + QUIZZES + 1] ?? null, score)
      .set(`S${r}`, `=IF(OR($C${r}="",(${den})=0),"",ROUND((${num})/(${den}),0))`, {
        ...st.calcCenter,
        numFmt: '0',
        font: { size: 11, bold: true, color: INK },
      })
      .set(
        `T${r}`,
        `=IF($S${r}="","",IF($S${r}>=INDEX(PredMin,1),"A",IF($S${r}>=INDEX(PredMin,2),"B",IF($S${r}>=INDEX(PredMin,3),"C","D"))))`,
        { ...st.calcCenter, font: { size: 11, bold: true } },
      )
      .set(`U${r}`, `=IF($S${r}="","",IF($S${r}>=Kktp,${PASS},${REM}))`, st.calcCenter)
      .set(
        `V${r}`,
        `=IF($S${r}="","",COUNTIFS(GrClass,$D${r},GrFinal,">"&$S${r})+1)`,
        st.calcCenter,
      )
      .set(`W${r}`, `=IF($T${r}="","",INDEX(PredDesc,MATCH($T${r},PredLetters,0)))`, {
        ...st.calcText,
        font: { size: 9, color: '4A433A' },
      })
      // Bantu: nilai untuk MAX/MIN per kelas (selalu angka), kunci urutan siswa terbaik.
      .set(`X${r}`, `=IF($S${r}="",-1,$S${r})`)
      .set(`Y${r}`, `=IF($S${r}="",999,$S${r})`)
      .set(`Z${r}`, `=IF($S${r}="","",$S${r}+(100000-ROW())/10000000000)`);
  }
  const scoreArea = `E${FIRST}:J${last} L${FIRST}:O${last} Q${FIRST}:R${last}`;
  shGr.validate(scoreArea, {
    type: 'decimal',
    operator: 'between',
    formula1: '0',
    formula2: '100',
    error: '0–100',
  });
  shGr.cond(scoreArea, {
    type: 'expression',
    formula: `AND(ISNUMBER(E${FIRST}),E${FIRST}<Kktp)`,
    style: { font: { color: BAD, bold: true } },
  });
  for (const [l, fill, color] of [
    ['A', GOOD_BG, GOOD],
    ['B', 'E1E8F5', '2C4A86'],
    ['C', WARN_BG, WARN],
    ['D', BAD_BG, BAD],
  ] as const)
    shGr.cond(`T${FIRST}:T${last}`, {
      type: 'cellIs',
      operator: 'equal',
      formula: `"${l}"`,
      style: { fill, font: { color, bold: true } },
    });
  shGr.cond(`U${FIRST}:U${last}`, {
    type: 'cellIs',
    operator: 'equal',
    formula: REM,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shGr.cond(`V${FIRST}:V${last}`, {
    type: 'cellIs',
    operator: 'lessThanOrEqual',
    formula: '3',
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shGr.freeze(`E${FIRST}`).autoFilter(`B${head}:W${last}`).printTitles(head, head);
  const grNames: [string, string][] = [
    ['GrNis', 'B'],
    ['GrName', 'C'],
    ['GrClass', 'D'],
    ['GrTask', 'K'],
    ['GrQuiz', 'P'],
    ['GrMid', 'Q'],
    ['GrFinalExam', 'R'],
    ['GrFinal', 'S'],
    ['GrLetter', 'T'],
    ['GrStatus', 'U'],
    ['GrRank', 'V'],
    ['GrDesc', 'W'],
    ['GrMax', 'X'],
    ['GrMin', 'Y'],
    ['GrKey', 'Z'],
  ];
  for (const [n, c] of grNames) wb.defineName(n, col(S.grades, c));

  // ---------- Rapor Siswa ----------
  const C = t.card;
  sheetHeader(shCard, st, {
    brand: t.brand,
    title: S.card,
    subtitle: t.subtitle.card,
    lastCol: 'F',
    menu,
  });
  shCard.widths({ B: 26, C: 22, D: 3, E: 22, F: 16 });
  shCard.width('H', 6, true);
  const pick = { ...st.inputText, font: { size: 11, bold: true }, align: { h: 'center' as const } };
  shCard
    .set('B5', C.pick, st.label)
    .set('C5', students[0] ? (sample ? '2501' : '1001') : '', pick)
    .height(5, 22);
  shCard.validate('C5', { type: 'list', formula1: '=StuNis', errorStyle: 'warning' });
  shCard.set('H5', '=IFERROR(MATCH($C$5&"",GrNis,0),"")');
  const gv = (n: string) => `IF($H$5="","",INDEX(${n},$H$5))`;
  shCard.merge('E5:F5', `=IF(AND($C$5<>"",$H$5=""),${q(C.notFound)},"")`, {
    ...st.note,
    font: { size: 10, bold: true, color: BAD },
  });
  shCard.style('B7:F7', { fill: INK });
  shCard.merge('B7:C7', C.title, {
    font: { name: 'Georgia', size: 15, bold: true, color: 'FFFFFF' },
    fill: INK,
    align: { v: 'center', indent: 1 },
  });
  shCard.merge('E7:F7', '=Semester&" · "&AcademicYear', {
    font: { size: 10, bold: true, color: 'FFFFFF' },
    fill: INK,
    align: { h: 'right', v: 'center', indent: 1 },
  });
  shCard.height(7, 28);
  shCard
    .merge('B8:F8', '=SchoolName', {
      font: { size: 12, bold: true, color: INK },
      align: { indent: 1, v: 'center' },
    })
    .height(8, 22);
  const info: [string, string, string, string][] = [
    [C.name, `=${gv('GrName')}&""`, C.cls, `=${gv('GrClass')}&""`],
    [C.nis, `=IF($H$5="","",$C$5&" / "&INDEX(StuNisn,$H$5))`, C.subject, '=SubjectName'],
  ];
  info.forEach(([l1, v1, l2, v2], i) => {
    const r = 10 + i;
    shCard
      .set(`B${r}`, l1, st.label)
      .set(`C${r}`, v1, st.calcText)
      .set(`E${r}`, l2, st.label)
      .set(`F${r}`, v2, st.calcText);
  });
  shCard.merge('B13:F13', C.detail, st.h2);
  shCard
    .set('B14', C.comp[0], st.thLeft)
    .set('C14', C.comp[1], st.th)
    .merge('E14:F14', C.comp[2], st.th);
  const rows: [string, string, string][] = [
    [C.tasks, 'GrTask', 'WTask'],
    [C.quiz, 'GrQuiz', 'WQuiz'],
    [C.mid, 'GrMid', 'WMid'],
    [C.fin, 'GrFinalExam', 'WFinal'],
  ];
  rows.forEach(([label, n, w], i) => {
    const r = 15 + i;
    shCard
      .set(`B${r}`, label, st.rowLabel)
      .set(`C${r}`, `=IF($H$5="","",IF(INDEX(${n},$H$5)="","-",INDEX(${n},$H$5)))`, {
        ...st.rowMoney,
        numFmt: '0.0',
        align: { h: 'center' },
      })
      .merge(`E${r}:F${r}`, `=${w}/100`, { ...st.rowPct, numFmt: '0%' });
  });
  shCard
    .set('B20', C.final, st.grandLabel)
    .set('C20', `=${gv('GrFinal')}`, {
      ...st.grandMoney,
      numFmt: '0',
      align: { h: 'center' },
      font: { size: 14, bold: true, color: 'FFFFFF' },
    })
    .height(20, 28);
  shCard.set('E20', C.pred, st.label).set('F20', `=${gv('GrLetter')}&""`, {
    ...st.calcCenter,
    font: { size: 16, bold: true, color: accent.main },
  });
  shCard.set('B21', C.status, st.label).set('C21', `=${gv('GrStatus')}&""`, st.calcCenter);
  shCard
    .set('E21', C.rank, st.label)
    .set(
      'F21',
      `=IF($H$5="","",INDEX(GrRank,$H$5)&${q(C.of)}&COUNTIFS(GrClass,INDEX(GrClass,$H$5),GrFinal,">=0"))`,
      st.calcCenter,
    );
  shCard.cond('C21', {
    type: 'cellIs',
    operator: 'equal',
    formula: REM,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shCard.cond('C21', {
    type: 'cellIs',
    operator: 'equal',
    formula: PASS,
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shCard.merge('B23:F23', C.desc, st.h2);
  shCard.merge('B24:F26', `=${gv('GrDesc')}&""`, {
    font: { size: 10, color: INK },
    align: { wrap: true, v: 'top', indent: 1 },
    border: { bottom: { style: 'thin', color: 'DDD4C4' } },
  });
  shCard.merge('B28:F28', C.att, st.h2);
  C.attHead.forEach((h, i) => {
    const names = ['StuSick', 'StuExcused', 'StuAbsent'];
    shCard.set(`${'BCE'[i]}29`, h, st.th);
    shCard.set(
      `${'BCE'[i]}30`,
      `=IF($H$5="","",N(INDEX(${names[i]},$H$5))&${q(C.days)})`,
      st.calcCenter,
    );
  });
  shCard.merge('E33:F33', '=ReportPlace&""', { ...st.footer, align: { h: 'center' } });
  shCard
    .set('B34', C.parent, { ...st.footer, align: { h: 'center' } })
    .merge('E34:F34', C.teacher, { ...st.footer, align: { h: 'center' } });
  const sign = {
    font: { size: 10, bold: true, color: INK },
    border: { top: { style: 'thin' as const, color: INK } },
    align: { h: 'center' as const },
  };
  shCard.set('B38', '', sign).merge('E38:F38', '=TeacherName&""', sign);
  shCard.merge('E39:F39', '=IF(TeacherId="","","NIP "&TeacherId)', {
    ...st.footer,
    align: { h: 'center' },
  });

  // ---------- Rekap Kelas ----------
  sheetHeader(shRec, st, {
    brand: t.brand,
    title: S.recap,
    subtitle: t.subtitle.recap,
    lastCol: 'L',
    menu,
  });
  const RC = 'BCDEFGHIJKL';
  [14, 9, 11, 11, 11, 11, 11, 7, 7, 7, 7].forEach((w, i) => shRec.width(RC[i], w));
  t.recap.forEach((h, i) => shRec.set(`${RC[i]}${head}`, h, i === 0 ? st.thLeft : st.th));
  shRec.height(head, 26);
  for (let k = 0; k <= CLASS_ROWS; k++) {
    const r = FIRST + k;
    const isTotal = k === CLASS_ROWS;
    const cls = isTotal ? '' : `INDEX(Classes,${k + 1})`;
    const crit = isTotal ? '' : `GrClass,$B${r},`;
    const count = isTotal ? 'COUNT(GrFinal)' : `COUNTIFS(GrClass,$B${r},GrFinal,">=0")`;
    const lab: Style = isTotal ? st.grandLabel : st.rowLabel;
    const val = (s: Style): Style =>
      isTotal ? { ...st.grandMoney, numFmt: s.numFmt, align: s.align } : s;
    const num1 = val({ ...st.rowMoney, numFmt: '0.0', align: { h: 'center' } });
    const num0 = val({ ...st.rowMoney, numFmt: '0', align: { h: 'center' } });
    shRec.set(`B${r}`, isTotal ? t.total : `=IF(${cls}="","",${cls})`, lab);
    const on = isTotal ? '' : `$B${r}="",`;
    const wrap = (f: string) => (isTotal ? `=${f}` : `=IF(OR(${on}${count}=0),"",${f})`);
    shRec
      .set(
        `C${r}`,
        isTotal ? `=COUNTA(StuName)` : `=IF($B${r}="","",COUNTIF(GrClass,$B${r}))`,
        num0,
      )
      .set(
        `D${r}`,
        wrap(
          isTotal
            ? 'IF(COUNT(GrFinal)=0,"",AVERAGE(GrFinal))'
            : `AVERAGEIFS(GrFinal,GrClass,$B${r})`,
        ),
        num1,
      )
      .set(
        `E${r}`,
        wrap(
          isTotal
            ? 'IF(COUNT(GrFinal)=0,"",MAX(GrFinal))'
            : `SUMPRODUCT(MAX((GrClass=$B${r})*GrMax))`,
        ),
        num0,
      )
      .set(
        `F${r}`,
        wrap(
          isTotal
            ? 'IF(COUNT(GrFinal)=0,"",MIN(GrFinal))'
            : `SUMPRODUCT(MIN((GrClass=$B${r})*GrMin+(GrClass<>$B${r})*999))`,
        ),
        num0,
      )
      .set(
        `G${r}`,
        wrap(
          isTotal
            ? `IF(COUNT(GrFinal)=0,"",COUNTIF(GrStatus,${PASS})/COUNT(GrFinal))`
            : `COUNTIFS(${crit}GrStatus,${PASS})/${count}`,
        ),
        val({ ...st.rowPct, numFmt: '0%' }),
      )
      .set(`H${r}`, wrap(`COUNTIFS(${crit}GrStatus,${REM})`), num0);
    letters.forEach((l, i) =>
      shRec.set(`${'IJKL'[i]}${r}`, wrap(`COUNTIFS(${crit}GrLetter,"${l}")`), num0),
    );
  }
  shRec.cond(`G${FIRST}:G${FIRST + CLASS_ROWS - 1}`, {
    type: 'dataBar',
    color: '3C6A33',
    min: '0',
    max: '1',
  });
  shRec.cond(`H${FIRST}:H${FIRST + CLASS_ROWS - 1}`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  wb.defineName('RecClass', ref(S.recap, `$B$${FIRST}:$B$${FIRST + CLASS_ROWS - 1}`));
  wb.defineName('RecAvg', ref(S.recap, `$D$${FIRST}:$D$${FIRST + CLASS_ROWS - 1}`));

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  for (const c of 'OPQR') shDash.width(c, 6, true);
  shDash.set('B2', `=${q(S.dash + ' · ')}&SubjectName`, st.title);
  shDash
    .merge('B5:J5', '=SchoolName&" · "&Semester&" "&AcademicYear', {
      ...st.label,
      align: { v: 'center' },
    })
    .height(5, 22)
    .height(6, 8)
    .height(10, 10);
  const graded = 'COUNT(GrFinal)';
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kStudents,
    value: '=COUNTA(StuName)',
    note: `=COUNTA(Classes)&${q(t.classes)}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kAvg,
    value: `=IF(${graded}=0,0,AVERAGE(GrFinal))`,
    note: `=${q(t.kktpNote)}&Kktp`,
    numFmt: '0.0',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kPass,
    value: `=IF(${graded}=0,0,COUNTIF(GrStatus,${PASS})/${graded})`,
    note: `=COUNTIF(GrStatus,${PASS})&${q(t.ofStudents)}`,
    numFmt: '0%',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kRemedial,
    value: `=COUNTIF(GrStatus,${REM})`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kTop,
    value: `=IF(${graded}=0,0,MAX(GrFinal))`,
    note: '=IFERROR(INDEX(GrName,MATCH(LARGE(GrKey,1),GrKey,0))&" · "&INDEX(GrClass,MATCH(LARGE(GrKey,1),GrKey,0)),"")',
    numFmt: '0',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kBestClass,
    value: '=IFERROR(INDEX(RecClass,MATCH(MAX(RecAvg),RecAvg,0)),"-")',
    note: `=IFERROR(${q(t.avgNote)}&TEXT(MAX(RecAvg),"0.0"),"")`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kA,
    value: '=COUNTIF(GrLetter,"A")',
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kAbsent,
    value: '=SUM(StuAbsent)',
    numFmt: '#,##0',
  });
  shDash.cond('K8:M8', {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  const nCls = Math.max(1, classes.length);
  shDash.chart({
    type: 'column',
    title: t.chartClass,
    from: 'B15',
    to: 'H33',
    numFmt: '0',
    legend: 'none',
    series: [
      {
        name: t.avgLabel,
        categories: ref(S.recap, `$B$${FIRST}:$B$${FIRST + nCls - 1}`),
        values: ref(S.recap, `$D$${FIRST}:$D$${FIRST + nCls - 1}`),
        color: accent.main,
      },
    ],
  });
  letters.forEach((l, i) =>
    shDash.set(`O${16 + i}`, l).set(`P${16 + i}`, `=COUNTIF(GrLetter,"${l}")`),
  );
  shDash.chart({
    type: 'doughnut',
    title: t.chartPred,
    from: 'H15',
    to: 'N33',
    legend: 'r',
    sliceColors: ['3C6A33', '2C4A86', '8F5E0A', '9A2E3F'],
    series: [
      {
        name: t.chartPred,
        categories: ref(S.dash, '$O$16:$O$19'),
        values: ref(S.dash, '$P$16:$P$19'),
      },
    ],
  });
  const binF = [
    'COUNTIFS(GrFinal,"<60")',
    'COUNTIFS(GrFinal,">=60",GrFinal,"<70")',
    'COUNTIFS(GrFinal,">=70",GrFinal,"<80")',
    'COUNTIFS(GrFinal,">=80",GrFinal,"<90")',
    'COUNTIFS(GrFinal,">=90")',
  ];
  t.bins.forEach((b, i) => shDash.set(`O${22 + i}`, b).set(`P${22 + i}`, `=${binF[i]}`));
  shDash.chart({
    type: 'column',
    title: t.chartDist,
    from: 'B35',
    to: 'H53',
    numFmt: '0',
    legend: 'none',
    series: [
      {
        name: t.countLabel,
        categories: ref(S.dash, '$O$22:$O$26'),
        values: ref(S.dash, '$P$22:$P$26'),
        color: CHART_COLORS[1],
      },
    ],
  });
  // 10 siswa terbaik dan daftar remedial (kolom bantu Q dan R)
  shDash.merge('I35:M35', t.topH, st.h2);
  shDash
    .merge('I36:J36', t.topHead[0], st.thLeft)
    .set('K36', t.topHead[1], st.th)
    .set('L36', t.topHead[2], st.th)
    .height(36, 24);
  for (let k = 1; k <= 10; k++) {
    const r = 36 + k;
    const ix = (n: string) => `IF($Q${r}="","",INDEX(${n},$Q${r}))`;
    shDash
      .set(`Q${r}`, `=IFERROR(MATCH(LARGE(GrKey,${k}),GrKey,0),"")`)
      .merge(`I${r}:J${r}`, `=IF($Q${r}="","",${k}&". "&INDEX(GrName,$Q${r}))`, st.rowLabel)
      .set(`K${r}`, `=${ix('GrClass')}`, { ...st.rowLabel, align: { h: 'center' } })
      .set(`L${r}`, `=${ix('GrFinal')}`, {
        ...st.rowMoney,
        numFmt: '0',
        align: { h: 'center' },
        font: { size: 10, bold: true },
      });
  }
  shDash.merge('B55:H55', t.remH, st.h2);
  shDash
    .merge('B56:D56', t.topHead[0], st.thLeft)
    .set('E56', t.topHead[1], st.th)
    .set('F56', t.topHead[2], st.th)
    .height(56, 24);
  // Urutan siswa remedial di sheet Nilai (kolom bantu AA).
  shGr.width('AA', 6, true).set(`AA${head}`, '#');
  for (let r = FIRST; r <= last; r++)
    shGr.set(`AA${r}`, `=IF($U${r}=${REM},N(AA${r - 1})+1,N(AA${r - 1}))`);
  wb.defineName('GrRemSeq', col(S.grades, 'AA'));
  for (let k = 1; k <= 15; k++) {
    const r = 56 + k;
    const ix = (n: string) => `IF($R${r}="","",INDEX(${n},$R${r}))`;
    shDash
      .set(`R${r}`, `=IFERROR(MATCH(${k},GrRemSeq,0),"")`)
      .merge(
        `B${r}:D${r}`,
        k === 1
          ? `=IF($R${r}="",IF(COUNT(GrFinal)=0,"",${q(t.noRemedial)}),INDEX(GrName,$R${r}))`
          : `=${ix('GrName')}`,
        st.rowLabel,
      )
      .set(`E${r}`, `=${ix('GrClass')}`, { ...st.rowLabel, align: { h: 'center' } })
      .set(`F${r}`, `=${ix('GrFinal')}`, {
        ...st.rowMoney,
        numFmt: '0',
        align: { h: 'center' },
        font: { size: 10, bold: true, color: BAD },
      });
  }

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: `=SubjectName&" · "&SchoolName`,
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.grades, t.desc.grades],
      [S.card, t.desc.card],
      [S.recap, t.desc.recap],
      [S.students, t.desc.students],
      [S.set, t.desc.set],
    ],
  });
  return wb;

  function makeSample() {
    const rnd = seeded(2025);
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2; // kira-kira normal, -1..1
    const clamp = (x: number) => Math.max(40, Math.min(100, Math.round(x)));
    const out: { name: string; cls: string; gender: string; scores: number[]; att: number[] }[] =
      [];
    t.sample.classes.forEach((cls, ci) => {
      for (let i = 0; i < 30; i++) {
        const fi = (i + ci * 7) % t.sample.first.length;
        const ability = 80 + ci * 1.5 + gauss() * 14;
        const scores = [
          ...Array.from({ length: TASKS }, () => clamp(ability + 4 + gauss() * 8)),
          ...Array.from({ length: QUIZZES }, () => clamp(ability + gauss() * 10)),
          clamp(ability - 2 + gauss() * 9),
          clamp(ability - 3 + gauss() * 9),
        ];
        out.push({
          name: `${t.sample.first[fi]} ${t.sample.last[(i * 3 + ci) % t.sample.last.length]}`,
          cls,
          gender: t.gender[fi % 2],
          scores,
          att: [
            Math.floor(rnd() * 3),
            Math.floor(rnd() * 2),
            rnd() < 0.15 ? 1 + Math.floor(rnd() * 3) : 0,
          ],
        });
      }
    });
    return out;
  }
}
