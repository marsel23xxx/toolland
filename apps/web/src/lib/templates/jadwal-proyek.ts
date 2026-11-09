/**
 * Template Jadwal Proyek (Gantt): daftar tugas dengan fase, PIC, tanggal mulai atau tugas
 * pendahulu, durasi hari kerja (WORKDAY + daftar libur), progres dan status; Gantt chart harian
 * dari format bersyarat (tanpa rumus per sel); tim, beban kerja per minggu, dan dashboard.
 */
import type { Locale } from '../format';
import { type Style, Workbook, colName, excelDate } from '../xlsx';
import {
  type FormValues,
  type TemplateForm,
  formChoice,
  formDate,
  formList,
  formText,
} from './form';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  GOOD,
  GOOD_BG,
  MONTHS,
  WARN,
  WARN_BG,
  cleanList,
  kpiCard,
  makeStyles,
  menuSheet,
  q,
  sheetHeader,
} from './kit';

export interface ScheduleOptions {
  locale: Locale;
  project: string;
  start: [number, number, number];
  phases: string[];
  team: string[];
  sample: boolean;
}

const FIRST = 6;
const TASK_ROWS = 150;
const TEAM_ROWS = 30;
const PHASE_ROWS = 15;
const HOLIDAY_ROWS = 30;
const DAYS = 120;
const WEEKS = 16;
const GANTT_FIRST = 8; // baris tugas pertama di sheet Gantt
const DAY_COL = 8; // kolom H = hari pertama

const L = {
  id: {
    brand: 'TOOLLAND · JADWAL PROYEK',
    name: 'Jadwal Proyek (Gantt)',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      tasks: 'Tugas',
      gantt: 'Gantt',
      load: 'Beban Kerja',
      team: 'Tim',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Progres vs rencana, tugas selesai, berjalan, terlambat, tenggat terdekat, dan grafik.',
      tasks:
        'Daftar tugas: fase, PIC, mulai atau setelah tugas lain, durasi hari kerja, progres, status.',
      gantt: 'Gantt chart harian otomatis dengan progres, akhir pekan, hari ini, dan milestone.',
      load: 'Jumlah tugas aktif tiap anggota tim per minggu untuk melihat siapa yang kelebihan beban.',
      team: 'Anggota tim beserta jumlah tugas, tugas terlambat, dan rata-rata progresnya.',
      set: 'Nama proyek, tanggal mulai, mulai tampilan Gantt, fase, dan hari libur.',
    },
    subtitle: {
      menu: 'Susun jadwal proyek, lihat Gantt chart, dan pantau tugas yang terlambat. Mulai dari Pengaturan.',
      tasks:
        'Isi Mulai, atau kosongkan dan pilih Setelah tugas agar mulai otomatis sehari kerja setelahnya. Durasi 0 = milestone.',
      gantt: 'Dibuat otomatis dari sheet Tugas. Geser awal tampilan di sheet Pengaturan.',
      load: 'Jumlah tugas yang sedang berjalan per orang per minggu. Merah = 3 tugas atau lebih.',
      team: 'Satu baris per anggota. Nama dipakai di dropdown PIC sheet Tugas.',
      set: 'Atur sekali di awal. Hari libur tidak dihitung sebagai hari kerja.',
      dash: 'Kondisi proyek hari ini.',
    },
    steps: [
      'Isi Pengaturan (nama proyek, tanggal mulai, fase, libur) dan daftar anggota di sheet Tim.',
      'Tulis tugas di sheet Tugas: fase, PIC, mulai atau tugas pendahulu, dan durasi dalam hari kerja.',
      'Perbarui progres setiap minggu. Gantt chart, beban kerja, dan dashboard ikut berubah.',
    ],
    set: [
      ['Nama proyek', 'ProjectName', 'text'],
      ['Manajer proyek', 'ProjectManager', 'text'],
      ['Tanggal mulai proyek', 'ProjectStart', 'date'],
      ['Mulai tampilan Gantt', 'GanttStart', 'calc'],
    ] as [string, string, string][],
    ganttNote:
      'Mulai tampilan Gantt otomatis Senin di minggu mulai proyek. Ganti dengan tanggal lain untuk menggeser tampilan (120 hari).',
    phasesH: 'Fase',
    phaseHead: ['Fase', 'Tugas', 'Progres'],
    holidaysH: 'Hari libur',
    holidayHead: ['Tanggal', 'Keterangan'],
    tasks: [
      'ID',
      'Fase',
      'Tugas',
      'PIC',
      'Mulai',
      'Durasi (hari kerja)',
      'Setelah tugas',
      'Mulai (dipakai)',
      'Selesai',
      'Progres',
      'Status',
      'Prioritas',
      'Sisa hari',
      'Catatan',
    ],
    status: { done: 'Selesai', todo: 'Belum mulai', late: 'Terlambat', run: 'Berjalan' },
    priorities: ['Tinggi', 'Sedang', 'Rendah'],
    startMsg: 'Kosongkan bila tugas dimulai setelah tugas lain (isi kolom Setelah tugas).',
    durMsg: 'Jumlah hari kerja. Isi 0 untuk milestone.',
    predMsg: 'ID tugas pendahulu. Mulai otomatis 1 hari kerja setelah tugas itu selesai.',
    ganttHead: ['ID', 'Tugas', 'PIC', 'Mulai', 'Selesai', 'Progres'],
    days: ['S', 'S', 'R', 'K', 'J', 'S', 'M'],
    team: [
      'Nama',
      'Peran',
      'Email',
      'Jumlah tugas',
      'Aktif',
      'Terlambat',
      'Hari kerja',
      'Rata-rata progres',
    ],
    loadHead: 'Anggota',
    weekLabel: 'Mg ',
    kTotal: 'Total tugas',
    kDone: 'Selesai',
    kRun: 'Berjalan',
    kLate: 'Terlambat',
    kProgress: 'Progres keseluruhan',
    kPlan: 'Rencana hari ini',
    kDev: 'Deviasi',
    kEnd: 'Perkiraan selesai',
    milestones: ' milestone',
    ofAll: ' dari semua tugas',
    notStarted: ' belum mulai',
    needAction: 'Perlu ditindaklanjuti',
    weightNote: 'Ditimbang dengan durasi',
    ahead: 'Lebih cepat dari jadwal',
    behind: 'Tertinggal dari jadwal',
    onPlan: 'Sesuai jadwal',
    daysLeft: ' hari lagi',
    chartStatus: 'Status tugas',
    chartPhase: 'Progres per fase',
    chartPic: 'Tugas per PIC',
    dueH: 'Tenggat dekat & terlambat',
    dueHead: ['ID', 'Tugas', 'PIC', 'Selesai'],
    noDue: 'Tidak ada tugas terlambat atau bertenggat 7 hari ke depan.',
    picDone: 'Selesai',
    picOpen: 'Belum selesai',
    sample: {
      project: 'Peluncuran Toko Online',
      manager: 'Andi Pratama',
      phases: ['Perencanaan', 'Desain', 'Pengembangan', 'Pengujian', 'Peluncuran'],
      team: [
        ['Andi Pratama', 'Manajer proyek'],
        ['Rina Wulandari', 'Desainer UI/UX'],
        ['Budi Santoso', 'Frontend developer'],
        ['Sari Lestari', 'Backend developer'],
        ['Dewi Anggraini', 'QA tester'],
        ['Fajar Nugroho', 'Marketing'],
      ],
      tasks: [
        [0, 'Kickoff meeting', 0, 1],
        [0, 'Kumpulkan kebutuhan', 0, 3],
        [0, 'Susun timeline & anggaran', 0, 2],
        [0, 'Rencana disetujui', 0, 0],
        [1, 'Wireframe halaman utama', 1, 4],
        [1, 'Desain UI lengkap', 1, 6],
        [1, 'Revisi desain', 1, 3],
        [1, 'Desain disetujui', 0, 0],
        [2, 'Siapkan server & domain', 3, 2],
        [2, 'Frontend toko', 2, 12],
        [2, 'Backend & database', 3, 10],
        [2, 'Integrasi pembayaran', 3, 5],
        [2, 'Input 200 produk', 5, 6],
        [3, 'Uji fungsional', 4, 5],
        [3, 'Uji pengguna (UAT)', 4, 4],
        [3, 'Perbaikan bug', 2, 5],
        [4, 'Pelatihan admin toko', 0, 2],
        [4, 'Go-live', 0, 0],
        [4, 'Kampanye peluncuran', 5, 5],
        [4, 'Evaluasi pasca peluncuran', 0, 3],
      ] as [number, string, number, number][],
    },
  },
  en: {
    brand: 'TOOLLAND · PROJECT SCHEDULE',
    name: 'Project Schedule (Gantt)',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      tasks: 'Tasks',
      gantt: 'Gantt',
      load: 'Workload',
      team: 'Team',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Progress vs plan, tasks done, in progress, overdue, upcoming deadlines, and charts.',
      tasks:
        'Task list: phase, owner, start or after another task, duration in working days, progress, status.',
      gantt: 'Automatic daily Gantt chart with progress, weekends, today, and milestones.',
      load: 'Active tasks per team member per week, to spot who is overloaded.',
      team: 'Team members with their number of tasks, overdue tasks, and average progress.',
      set: 'Project name, start date, Gantt view start, phases, and holidays.',
    },
    subtitle: {
      menu: 'Plan your project schedule, see the Gantt chart, and track overdue tasks. Start with Settings.',
      tasks:
        'Enter a Start date, or leave it empty and pick After task to start one working day later. Duration 0 = milestone.',
      gantt: 'Built from the Tasks sheet. Shift the view start in Settings.',
      load: 'Number of tasks in progress per person per week. Red = 3 or more tasks.',
      team: 'One row per member. Names feed the Owner dropdown in Tasks.',
      set: 'Set this up once. Holidays are not counted as working days.',
      dash: 'Project status as of today.',
    },
    steps: [
      'Fill in Settings (project name, start date, phases, holidays) and your members in Team.',
      'List tasks in Tasks: phase, owner, start or predecessor, and duration in working days.',
      'Update progress every week. The Gantt chart, workload, and dashboard follow.',
    ],
    set: [
      ['Project name', 'ProjectName', 'text'],
      ['Project manager', 'ProjectManager', 'text'],
      ['Project start date', 'ProjectStart', 'date'],
      ['Gantt view starts', 'GanttStart', 'calc'],
    ] as [string, string, string][],
    ganttNote:
      'The Gantt view starts on the Monday of the project start week. Replace it with another date to shift the 120-day view.',
    phasesH: 'Phases',
    phaseHead: ['Phase', 'Tasks', 'Progress'],
    holidaysH: 'Holidays',
    holidayHead: ['Date', 'Notes'],
    tasks: [
      'ID',
      'Phase',
      'Task',
      'Owner',
      'Start',
      'Duration (work days)',
      'After task',
      'Start (used)',
      'End',
      'Progress',
      'Status',
      'Priority',
      'Days left',
      'Notes',
    ],
    status: { done: 'Done', todo: 'Not started', late: 'Overdue', run: 'In progress' },
    priorities: ['High', 'Medium', 'Low'],
    startMsg: 'Leave empty if the task starts after another task (fill in After task).',
    durMsg: 'Number of working days. Enter 0 for a milestone.',
    predMsg: 'ID of the preceding task. Starts 1 working day after that task ends.',
    ganttHead: ['ID', 'Task', 'Owner', 'Start', 'End', 'Progress'],
    days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    team: ['Name', 'Role', 'Email', 'Tasks', 'Active', 'Overdue', 'Work days', 'Average progress'],
    loadHead: 'Member',
    weekLabel: 'Wk ',
    kTotal: 'Total tasks',
    kDone: 'Done',
    kRun: 'In progress',
    kLate: 'Overdue',
    kProgress: 'Overall progress',
    kPlan: 'Planned by today',
    kDev: 'Deviation',
    kEnd: 'Estimated finish',
    milestones: ' milestones',
    ofAll: ' of all tasks',
    notStarted: ' not started',
    needAction: 'Need attention',
    weightNote: 'Weighted by duration',
    ahead: 'Ahead of schedule',
    behind: 'Behind schedule',
    onPlan: 'On schedule',
    daysLeft: ' days to go',
    chartStatus: 'Task status',
    chartPhase: 'Progress by phase',
    chartPic: 'Tasks by owner',
    dueH: 'Due soon & overdue',
    dueHead: ['ID', 'Task', 'Owner', 'End'],
    noDue: 'No tasks overdue or due in the next 7 days.',
    picDone: 'Done',
    picOpen: 'Open',
    sample: {
      project: 'Online Store Launch',
      manager: 'Andi Pratama',
      phases: ['Planning', 'Design', 'Development', 'Testing', 'Launch'],
      team: [
        ['Andi Pratama', 'Project manager'],
        ['Rina Wulandari', 'UI/UX designer'],
        ['Budi Santoso', 'Frontend developer'],
        ['Sari Lestari', 'Backend developer'],
        ['Dewi Anggraini', 'QA tester'],
        ['Fajar Nugroho', 'Marketing'],
      ],
      tasks: [
        [0, 'Kickoff meeting', 0, 1],
        [0, 'Gather requirements', 0, 3],
        [0, 'Timeline & budget', 0, 2],
        [0, 'Plan approved', 0, 0],
        [1, 'Home page wireframe', 1, 4],
        [1, 'Full UI design', 1, 6],
        [1, 'Design revisions', 1, 3],
        [1, 'Design approved', 0, 0],
        [2, 'Server & domain setup', 3, 2],
        [2, 'Store frontend', 2, 12],
        [2, 'Backend & database', 3, 10],
        [2, 'Payment integration', 3, 5],
        [2, 'Upload 200 products', 5, 6],
        [3, 'Functional testing', 4, 5],
        [3, 'User acceptance testing', 4, 4],
        [3, 'Bug fixing', 2, 5],
        [4, 'Store admin training', 0, 2],
        [4, 'Go-live', 0, 0],
        [4, 'Launch campaign', 5, 5],
        [4, 'Post-launch review', 0, 3],
      ] as [number, string, number, number][],
    },
  },
};

/** Pendahulu contoh (indeks tugas sebelumnya; -1 = mulai di tanggal proyek) dan progres contoh. */
const SAMPLE_LINKS: [number, number][] = [
  [-1, 1],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 0.6],
  [6, 0],
  [3, 1],
  [7, 0.1],
  [8, 0.45],
  [10, 0],
  [8, 0.2],
  [11, 0],
  [13, 0],
  [14, 0],
  [15, 0],
  [16, 0],
  [17, 0],
  [18, 0],
];

export const PHASE_PRESETS: Record<Locale, Record<string, string[]>> = {
  id: {
    it: ['Perencanaan', 'Desain', 'Pengembangan', 'Pengujian', 'Peluncuran'],
    acara: [
      'Konsep & anggaran',
      'Vendor & venue',
      'Promosi & undangan',
      'Persiapan teknis',
      'Hari H',
      'Evaluasi',
    ],
    konstruksi: [
      'Perizinan & desain',
      'Persiapan lahan',
      'Struktur',
      'Arsitektur & finishing',
      'MEP',
      'Serah terima',
    ],
    pemasaran: [
      'Riset & strategi',
      'Produksi konten',
      'Peluncuran kampanye',
      'Optimasi',
      'Laporan',
    ],
  },
  en: {
    it: ['Planning', 'Design', 'Development', 'Testing', 'Launch'],
    acara: [
      'Concept & budget',
      'Vendors & venue',
      'Promotion & invitations',
      'Technical prep',
      'Event day',
      'Review',
    ],
    konstruksi: [
      'Permits & design',
      'Site preparation',
      'Structure',
      'Architecture & finishing',
      'MEP',
      'Handover',
    ],
    pemasaran: [
      'Research & strategy',
      'Content production',
      'Campaign launch',
      'Optimisation',
      'Reporting',
    ],
  },
};

const presetForm = (locale: Locale) => ({
  key: 'preset',
  label: locale === 'id' ? 'Jenis proyek' : 'Project type',
  hint:
    locale === 'id' ? 'Mengisi ulang daftar fase di bawah.' : 'Refills the list of phases below.',
  options:
    locale === 'id'
      ? [
          { value: 'it', label: 'Aplikasi / IT' },
          { value: 'acara', label: 'Acara / event' },
          { value: 'konstruksi', label: 'Konstruksi' },
          { value: 'pemasaran', label: 'Kampanye pemasaran' },
        ]
      : [
          { value: 'it', label: 'Software / IT' },
          { value: 'acara', label: 'Event' },
          { value: 'konstruksi', label: 'Construction' },
          { value: 'pemasaran', label: 'Marketing campaign' },
        ],
  fill: Object.fromEntries(
    Object.entries(PHASE_PRESETS[locale]).map(([k, v]) => [k, { phases: v.join('\n') }]),
  ),
});

export const SCHEDULE_FORM: Record<Locale, TemplateForm> = {
  id: {
    template: 'schedule',
    fileBase: 'Jadwal-Proyek',
    fileKey: 'project',
    heading: 'Atur sesuai proyekmu',
    fields: [
      {
        key: 'project',
        kind: 'text',
        label: 'Nama proyek',
        placeholder: 'misalnya Peluncuran Aplikasi',
        span: 2,
      },
      { key: 'start', kind: 'date', label: 'Tanggal mulai', value: 'today+0' },
      {
        key: 'phases',
        kind: 'list',
        label: 'Fase',
        value: PHASE_PRESETS.id.it.join('\n'),
        max: PHASE_ROWS,
      },
      {
        key: 'team',
        kind: 'list',
        label: 'Anggota tim',
        value: '',
        max: TEAM_ROWS,
        hint: 'Satu nama per baris. Boleh dikosongkan dan diisi di file.',
      },
    ],
    presets: presetForm('id'),
    sample: {
      label: 'Isi contoh proyek',
      hint: '20 tugas peluncuran toko online dengan 6 anggota tim, ketergantungan antar tugas, dan progres 3 minggu, jadi Gantt dan dashboard langsung terisi. Contoh memakai fase proyek IT.',
    },
  },
  en: {
    template: 'schedule',
    fileBase: 'Project-Schedule',
    fileKey: 'project',
    heading: 'Set it up for your project',
    fields: [
      {
        key: 'project',
        kind: 'text',
        label: 'Project name',
        placeholder: 'for example App Launch',
        span: 2,
      },
      { key: 'start', kind: 'date', label: 'Start date', value: 'today+0' },
      {
        key: 'phases',
        kind: 'list',
        label: 'Phases',
        value: PHASE_PRESETS.en.it.join('\n'),
        max: PHASE_ROWS,
      },
      {
        key: 'team',
        kind: 'list',
        label: 'Team members',
        value: '',
        max: TEAM_ROWS,
        hint: 'One name per line. Optional, you can add them in the file.',
      },
    ],
    presets: presetForm('en'),
    sample: {
      label: 'Include a sample project',
      hint: '20 tasks for an online store launch with 6 team members, task dependencies, and 3 weeks of progress, so the Gantt chart and dashboard are filled in. The sample uses the IT phases.',
    },
  },
};

export function buildFromForm(v: FormValues): Workbook {
  const now = new Date();
  return buildScheduleWorkbook({
    locale: formChoice(v, 'locale', ['id', 'en'] as const, 'id'),
    project: formText(v, 'project'),
    start: formDate(v, 'start') ?? [now.getFullYear(), now.getMonth() + 1, now.getDate()],
    phases: formList(v, 'phases'),
    team: formList(v, 'team'),
    sample: v.sample === true,
  });
}

export function buildScheduleWorkbook(opts: ScheduleOptions): Workbook {
  const { locale } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.nila;
  const st = makeStyles(accent, 'IDR', locale);
  const sample = opts.sample;
  const phases = sample
    ? t.sample.phases
    : cleanList(opts.phases, PHASE_ROWS).length
      ? cleanList(opts.phases, PHASE_ROWS)
      : PHASE_PRESETS[locale].it;
  const team = sample
    ? t.sample.team
    : cleanList(opts.team, TEAM_ROWS).map((n) => [n, ''] as [string, string]);
  const project =
    opts.project.trim().slice(0, 80) ||
    (sample ? t.sample.project : locale === 'id' ? 'Nama Proyek' : 'Project Name');
  const now = new Date();
  const todayX = excelDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  // Contoh dimulai 3 minggu lalu (hari Senin) agar ada tugas selesai, berjalan, dan terlambat.
  const start = sample
    ? todayX - 21 - ((new Date(now.getTime() - 21 * 864e5).getDay() + 6) % 7)
    : excelDate(...opts.start);
  const ST = {
    done: q(t.status.done),
    todo: q(t.status.todo),
    late: q(t.status.late),
    run: q(t.status.run),
  };

  const wb = new Workbook({ title: `${t.name} – ${project}`, subject: t.name, company: project });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shTasks = wb.addSheet(S.tasks, { tabColor: '8F5E0A', ...landscape });
  const shGantt = wb.addSheet(S.gantt, { tabColor: '3C6A33', ...landscape, zoom: 85 });
  const shLoad = wb.addSheet(S.load, { tabColor: 'A8461F', ...landscape });
  const shTeam = wb.addSheet(S.team, { tabColor: 'A8461F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const taskLast = FIRST + TASK_ROWS - 1;
  const teamLast = FIRST + TEAM_ROWS - 1;
  const col = (sheet: string, c: string, first: number, last: number) =>
    ref(sheet, `$${c}$${first}:$${c}$${last}`);

  // ---------- Daftar ----------
  MONTHS[locale].short.forEach((m, i) => shList.set(`B${i + 2}`, m));
  wb.defineName('MonthsShort', ref(S.list, '$B$2:$B$13'));
  t.days.forEach((d, i) => shList.set(`D${i + 2}`, d));
  wb.defineName('DayInitials', ref(S.list, '$D$2:$D$8'));
  t.priorities.forEach((p, i) => shList.set(`F${i + 2}`, p));
  wb.defineName('Priorities', ref(S.list, '$F$2:$F$4'));

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'J',
    menu,
  });
  shSet.widths({ B: 24, C: 22, D: 3, E: 26, F: 9, G: 10, H: 3, I: 13, J: 26 });
  const setVals: Record<string, string | number> = {
    ProjectName: project,
    ProjectManager: sample ? t.sample.manager : '',
    ProjectStart: start,
    GanttStart: '=ProjectStart-WEEKDAY(ProjectStart,2)+1',
  };
  t.set.forEach(([label, name, kind], i) => {
    const r = 5 + i;
    const style: Style =
      kind === 'date' ? st.inputDate : kind === 'calc' ? st.inputDate : st.inputText;
    shSet.set(`B${r}`, label, st.label).set(`C${r}`, setVals[name], style).height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.merge('B10:C12', t.ganttNote, st.note);
  shSet.merge('E5:G5', t.phasesH, st.h2);
  t.phaseHead.forEach((h, i) => shSet.set(`${'EFG'[i]}6`, h, i ? st.th : st.thLeft));
  for (let k = 0; k < PHASE_ROWS; k++) {
    const r = 7 + k;
    shSet
      .set(`E${r}`, phases[k] ?? null, st.inputText)
      .set(`F${r}`, `=IF(E${r}="","",COUNTIF(TaskPhase,E${r}))`, st.calcInt)
      .set(
        `G${r}`,
        `=IF(OR(E${r}="",SUMIFS(TaskWeight,TaskPhase,E${r})=0),"",SUMPRODUCT(--(TaskPhase=E${r}),TaskWeight,TaskProgress)/SUMPRODUCT(--(TaskPhase=E${r}),TaskWeight))`,
        st.calcPct,
      );
  }
  shSet.cond(`G7:G${6 + PHASE_ROWS}`, { type: 'dataBar', color: accent.main, min: '0', max: '1' });
  wb.defineName('Phases', ref(S.set, `$E$7:$E$${6 + PHASE_ROWS}`));
  wb.defineName('PhaseProgress', ref(S.set, `$G$7:$G$${6 + PHASE_ROWS}`));
  shSet.merge('I5:J5', t.holidaysH, st.h2);
  shSet.set('I6', t.holidayHead[0], st.th).set('J6', t.holidayHead[1], st.thLeft);
  for (let k = 0; k < HOLIDAY_ROWS; k++)
    shSet.set(`I${7 + k}`, null, st.inputDate).set(`J${7 + k}`, null, st.inputText);
  wb.defineName('Holidays', ref(S.set, `$I$7:$I$${6 + HOLIDAY_ROWS}`));

  // ---------- Tim ----------
  sheetHeader(shTeam, st, {
    brand: t.brand,
    title: S.team,
    subtitle: t.subtitle.team,
    lastCol: 'I',
    menu,
  });
  shTeam.widths({ B: 24, C: 22, D: 26, E: 11, F: 9, G: 10, H: 11, I: 13 });
  t.team.forEach((h, i) => shTeam.set(`${'BCDEFGHI'[i]}${head}`, h, i < 3 ? st.thLeft : st.th));
  shTeam.height(head, 28);
  for (let r = FIRST; r <= teamLast; r++) {
    const m = team[r - FIRST];
    shTeam
      .set(`B${r}`, m?.[0] ?? null, st.inputText)
      .set(`C${r}`, m?.[1] || null, st.inputText)
      .set(`D${r}`, null, st.inputText)
      .set(`E${r}`, `=IF($B${r}="","",COUNTIF(TaskOwner,$B${r}))`, st.calcInt)
      .set(
        `F${r}`,
        `=IF($B${r}="","",COUNTIFS(TaskOwner,$B${r},TaskStatus,${ST.run})+COUNTIFS(TaskOwner,$B${r},TaskStatus,${ST.late}))`,
        st.calcInt,
      )
      .set(
        `G${r}`,
        `=IF($B${r}="","",COUNTIFS(TaskOwner,$B${r},TaskStatus,${ST.late}))`,
        st.calcInt,
      )
      .set(`H${r}`, `=IF($B${r}="","",SUMIFS(TaskDuration,TaskOwner,$B${r}))`, st.calcInt)
      .set(
        `I${r}`,
        `=IF(OR($B${r}="",N(E${r})=0),"",AVERAGEIFS(TaskProgress,TaskOwner,$B${r}))`,
        st.calcPct,
      );
  }
  shTeam.cond(`G${FIRST}:G${teamLast}`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shTeam.cond(`I${FIRST}:I${teamLast}`, {
    type: 'dataBar',
    color: accent.main,
    min: '0',
    max: '1',
  });
  shTeam.freeze(`C${FIRST}`);
  wb.defineName('Team', col(S.team, 'B', FIRST, teamLast));
  wb.defineName('TeamTasks', col(S.team, 'E', FIRST, teamLast));

  // ---------- Tugas ----------
  sheetHeader(shTasks, st, {
    brand: t.brand,
    title: S.tasks,
    subtitle: t.subtitle.tasks,
    lastCol: 'O',
    menu,
  });
  const TC = 'BCDEFGHIJKLMNO';
  [7, 18, 34, 18, 12, 10, 10, 12, 12, 9, 13, 10, 9, 26].forEach((w, i) => shTasks.width(TC[i], w));
  for (const c of 'PQR') shTasks.width(c, 6, true);
  t.tasks.forEach((h, i) =>
    shTasks.set(`${TC[i]}${head}`, h, [1, 2, 3, 13].includes(i) ? st.thLeft : st.th),
  );
  for (const c of 'PQR') shTasks.set(`${c}${head}`, '#');
  shTasks.height(head, 32);
  const sampleTasks = sample ? t.sample.tasks : [];
  for (let r = FIRST; r <= taskLast; r++) {
    const s = sampleTasks[r - FIRST];
    const link = s ? SAMPLE_LINKS[r - FIRST] : undefined;
    const filled = `$D${r}<>""`;
    shTasks
      .set(`B${r}`, `=IF(${filled},"T"&TEXT(ROW()-${head},"000"),"")`, st.calcCenter)
      .set(`C${r}`, s ? phases[s[0]] : null, st.inputText)
      .set(`D${r}`, s?.[1] ?? null, st.inputText)
      .set(`E${r}`, s ? (team[s[2]]?.[0] ?? null) : null, st.inputText)
      .set(`F${r}`, link && link[0] < 0 ? start : null, st.inputDate)
      .set(`G${r}`, s?.[3] ?? null, st.inputInt)
      .set(`H${r}`, link && link[0] >= 0 ? `T${String(link[0] + 1).padStart(3, '0')}` : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(
        `I${r}`,
        `=IF($F${r}<>"",$F${r},IF($H${r}="","",IFERROR(WORKDAY(INDEX(TaskEnd,MATCH($H${r},TaskId,0)),1,Holidays),"")))`,
        st.calcDate,
      )
      .set(
        `J${r}`,
        `=IF(OR($I${r}="",$G${r}=""),"",IF(N($G${r})=0,$I${r},WORKDAY($I${r},$G${r}-1,Holidays)))`,
        st.calcDate,
      )
      .set(`K${r}`, link ? link[1] : null, { ...st.input, numFmt: '0%', align: { h: 'center' } })
      .set(
        `L${r}`,
        `=IF(OR(${filled}=FALSE,$J${r}=""),"",IF(N($K${r})>=1,${ST.done},IF(TODAY()>$J${r},${ST.late},IF(AND(TODAY()<$I${r},N($K${r})=0),${ST.todo},${ST.run}))))`,
        st.calcCenter,
      )
      .set(`M${r}`, s ? t.priorities[r % 3 === 0 ? 0 : 1] : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`N${r}`, `=IF(OR($J${r}="",$L${r}=${ST.done}),"",$J${r}-TODAY())`, st.calcInt)
      .set(`O${r}`, null, st.inputText)
      // Bantu: bobot (durasi, milestone = 0), rencana hari ini (porsi waktu yang sudah lewat),
      // urutan tugas tenggat dekat/terlambat untuk dashboard.
      .set(`P${r}`, `=IF($J${r}="","",N($G${r}))`)
      .set(`Q${r}`, `=IF($J${r}="","",MAX(0,MIN(1,(TODAY()-$I${r}+1)/($J${r}-$I${r}+1))))`)
      .set(
        `R${r}`,
        `=IF(AND($J${r}<>"",$L${r}<>${ST.done},N($J${r})<=TODAY()+7),N(R${r - 1})+1,N(R${r - 1}))`,
      );
  }
  const tr = (c: string) => `${c}${FIRST}:${c}${taskLast}`;
  shTasks.validate(tr('C'), { type: 'list', formula1: '=Phases' });
  shTasks.validate(tr('E'), { type: 'list', formula1: '=Team', errorStyle: 'warning' });
  shTasks.validate(tr('F'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    prompt: t.startMsg,
    errorStyle: 'warning',
  });
  shTasks.validate(tr('G'), {
    type: 'whole',
    operator: 'between',
    formula1: '0',
    formula2: '999',
    prompt: t.durMsg,
  });
  shTasks.validate(tr('H'), {
    type: 'list',
    formula1: '=TaskId',
    prompt: t.predMsg,
    errorStyle: 'warning',
  });
  shTasks.validate(tr('K'), {
    type: 'decimal',
    operator: 'between',
    formula1: '0',
    formula2: '1',
    error: '0%–100%',
  });
  shTasks.validate(tr('M'), { type: 'list', formula1: '=Priorities' });
  for (const [s, fill, color] of [
    [ST.done, GOOD_BG, GOOD],
    [ST.late, BAD_BG, BAD],
    [ST.run, 'E1E8F5', '2C4A86'],
  ] as const)
    shTasks.cond(tr('L'), {
      type: 'cellIs',
      operator: 'equal',
      formula: s,
      style: { fill, font: { color, bold: true } },
    });
  shTasks.cond(tr('K'), { type: 'dataBar', color: '3C6A33', min: '0', max: '1' });
  shTasks.cond(tr('M'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.priorities[0]),
    style: { font: { color: BAD, bold: true } },
  });
  shTasks.cond(tr('N'), {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  shTasks.cond(tr('G'), {
    type: 'cellIs',
    operator: 'equal',
    formula: '0',
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shTasks.freeze(`E${FIRST}`).autoFilter(`B${head}:O${taskLast}`).printTitles(head, head);
  const taskNames: [string, string][] = [
    ['TaskId', 'B'],
    ['TaskPhase', 'C'],
    ['TaskName', 'D'],
    ['TaskOwner', 'E'],
    ['TaskDuration', 'G'],
    ['TaskStart', 'I'],
    ['TaskEnd', 'J'],
    ['TaskProgress', 'K'],
    ['TaskStatus', 'L'],
    ['TaskWeight', 'P'],
    ['TaskPlanned', 'Q'],
    ['TaskDueSeq', 'R'],
  ];
  for (const [n, c] of taskNames) wb.defineName(n, col(S.tasks, c, FIRST, taskLast));

  // ---------- Gantt ----------
  sheetHeader(shGantt, st, {
    brand: t.brand,
    title: S.gantt,
    subtitle: t.subtitle.gantt,
    lastCol: 'G',
    menu,
  });
  shGantt.widths({ B: 6, C: 28, D: 14, E: 9, F: 9, G: 8 });
  const dayCol = (d: number) => colName(DAY_COL + d);
  const lastDay = dayCol(DAYS - 1);
  for (let d = 0; d < DAYS; d++) shGantt.width(dayCol(d), 2.8);
  const hdr = GANTT_FIRST - 1;
  t.ganttHead.forEach((h, i) =>
    shGantt.set(`${'BCDEFG'[i]}${hdr}`, h, i === 1 ? st.thLeft : st.th),
  );
  const tiny = (s: Style): Style => ({
    ...s,
    font: { size: 7, bold: true, color: 'FFFFFF' },
    align: { h: 'center', v: 'center' },
  });
  for (let d = 0; d < DAYS; d++) {
    const c = dayCol(d);
    shGantt
      .set(
        `${c}5`,
        `=IF(OR(${d}=0,DAY(${c}6)=1),INDEX(MonthsShort,MONTH(${c}6))&" "&RIGHT(YEAR(${c}6),2),"")`,
        {
          font: { size: 8, bold: true, color: accent.dark },
        },
      )
      .set(`${c}6`, d === 0 ? '=GanttStart' : `=${dayCol(d - 1)}6+1`, {
        ...tiny(st.th),
        numFmt: 'd',
      })
      .set(`${c}${hdr}`, `=INDEX(DayInitials,WEEKDAY(${c}6,2))`, tiny(st.th));
  }
  shGantt.height(6, 16).height(hdr, 16);
  const gLast = GANTT_FIRST + TASK_ROWS - 1;
  for (let r = GANTT_FIRST; r <= gLast; r++) {
    const tRow = r - GANTT_FIRST + FIRST;
    const tk = `'${S.tasks}'!`;
    const small = { font: { size: 9 } };
    shGantt
      .set(`B${r}`, `=IF(${tk}$B${tRow}="","",${tk}$B${tRow})`, { ...st.calcCenter, ...small })
      .set(`C${r}`, `=IF($B${r}="","",${tk}$D${tRow}&"")`, { ...st.calcText, ...small })
      .set(`D${r}`, `=IF($B${r}="","",${tk}$E${tRow}&"")`, { ...st.calcText, ...small })
      .set(`E${r}`, `=IF($B${r}="","",${tk}$I${tRow})`, {
        ...st.calcDate,
        numFmt: 'dd/mm',
        ...small,
      })
      .set(`F${r}`, `=IF($B${r}="","",${tk}$J${tRow})`, {
        ...st.calcDate,
        numFmt: 'dd/mm',
        ...small,
      })
      .set(`G${r}`, `=IF($B${r}="","",N(${tk}$K${tRow}))`, { ...st.calcPct, ...small });
  }
  const area = `H${GANTT_FIRST}:${lastDay}${gLast}`;
  const C0 = `H$6`;
  const R0 = GANTT_FIRST;
  const inBar = `AND(ISNUMBER($E${R0}),${C0}>=$E${R0},${C0}<=$F${R0})`;
  shGantt.cond(area, {
    type: 'expression',
    formula: `AND(ISNUMBER($E${R0}),$E${R0}=$F${R0},${C0}=$E${R0},N(INDEX(TaskDuration,ROW()-${GANTT_FIRST - 1}))=0)`,
    style: { fill: '8F5E0A' },
  });
  shGantt.cond(area, {
    type: 'expression',
    formula: `AND(${inBar},${C0}<$E${R0}+($F${R0}-$E${R0}+1)*N($G${R0}))`,
    style: { fill: accent.dark },
  });
  shGantt.cond(area, {
    type: 'expression',
    formula: `AND(${inBar},INDEX(TaskStatus,ROW()-${GANTT_FIRST - 1})=${ST.late})`,
    style: { fill: 'D9707F' },
  });
  shGantt.cond(area, { type: 'expression', formula: inBar, style: { fill: '94AEE6' } });
  shGantt.cond(area, { type: 'expression', formula: `${C0}=TODAY()`, style: { fill: 'F6DEE1' } });
  shGantt.cond(area, {
    type: 'expression',
    formula: `WEEKDAY(${C0},2)>5`,
    style: { fill: 'EFE9DE' },
  });
  shGantt.cond(`H6:${lastDay}6`, {
    type: 'expression',
    formula: 'H6=TODAY()',
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  shGantt.style(area, {
    border: {
      left: { style: 'hair', color: 'E8E2D7' },
      bottom: { style: 'hair', color: 'E8E2D7' },
    },
  });
  shGantt.freeze(`H${GANTT_FIRST}`).printTitles(hdr, hdr);

  // ---------- Beban Kerja ----------
  sheetHeader(shLoad, st, {
    brand: t.brand,
    title: S.load,
    subtitle: t.subtitle.load,
    lastCol: 'R',
    menu,
  });
  shLoad.width('B', 24);
  const wkCol = (w: number) => colName(3 + w);
  for (let w = 0; w < WEEKS; w++) shLoad.width(wkCol(w), 8);
  shLoad.set(`B${head}`, t.loadHead, st.thLeft);
  for (let w = 0; w < WEEKS; w++)
    shLoad.set(`${wkCol(w)}${head}`, `=${q(t.weekLabel)}&TEXT(GanttStart+${w * 7},"dd/mm")`, {
      ...st.th,
      font: { size: 9, bold: true, color: 'FFFFFF' },
    });
  shLoad.height(head, 26);
  for (let r = FIRST; r <= teamLast; r++) {
    const name = `INDEX(Team,${r - FIRST + 1})`;
    shLoad.set(`B${r}`, `=IF(${name}="","",${name})`, st.rowLabel);
    for (let w = 0; w < WEEKS; w++)
      shLoad.set(
        `${wkCol(w)}${r}`,
        `=IF($B${r}="","",COUNTIFS(TaskOwner,$B${r},TaskStart,"<="&(GanttStart+${w * 7 + 6}),TaskEnd,">="&(GanttStart+${w * 7})))`,
        { ...st.rowMoney, numFmt: '0;;""', align: { h: 'center' } },
      );
  }
  const loadArea = `C${FIRST}:${wkCol(WEEKS - 1)}${teamLast}`;
  shLoad.cond(loadArea, {
    type: 'cellIs',
    operator: 'greaterThanOrEqual',
    formula: '3',
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  shLoad.cond(loadArea, {
    type: 'cellIs',
    operator: 'equal',
    formula: '2',
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shLoad.cond(loadArea, {
    type: 'cellIs',
    operator: 'equal',
    formula: '1',
    style: { fill: GOOD_BG, font: { color: GOOD } },
  });
  shLoad.freeze(`C${FIRST}`);

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
  shDash.set('B2', `=${q(S.dash + ' · ')}&ProjectName`, st.title);
  shDash.height(6, 8).height(10, 10);
  const total = 'COUNTIF(TaskId,"?*")';
  const progress = 'IF(SUM(TaskWeight)=0,0,SUMPRODUCT(TaskWeight,TaskProgress)/SUM(TaskWeight))';
  const planned = 'IF(SUM(TaskWeight)=0,0,SUMPRODUCT(TaskWeight,TaskPlanned)/SUM(TaskWeight))';
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kTotal,
    value: `=${total}`,
    note: `=COUNTIFS(TaskId,"?*",TaskDuration,0)&${q(t.milestones)}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kDone,
    value: `=COUNTIF(TaskStatus,${ST.done})`,
    note: `=IF(${total}=0,"",TEXT(COUNTIF(TaskStatus,${ST.done})/${total},"0%")&${q(t.ofAll)})`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kRun,
    value: `=COUNTIF(TaskStatus,${ST.run})`,
    note: `=COUNTIF(TaskStatus,${ST.todo})&${q(t.notStarted)}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kLate,
    value: `=COUNTIF(TaskStatus,${ST.late})`,
    note: t.needAction,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kProgress,
    value: `=${progress}`,
    note: t.weightNote,
    numFmt: '0.0%',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kPlan,
    value: `=${planned}`,
    numFmt: '0.0%',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kDev,
    value: `=${progress}-${planned}`,
    note: `=IF(ABS(${progress}-${planned})<0.005,${q(t.onPlan)},IF(${progress}>${planned},${q(t.ahead)},${q(t.behind)}))`,
    numFmt: '+0.0%;-0.0%;0.0%',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kEnd,
    value: '=IF(COUNT(TaskEnd)=0,"",MAX(TaskEnd))',
    note: `=IF(COUNT(TaskEnd)=0,"",MAX(TaskEnd)-TODAY()&${q(t.daysLeft)})`,
    numFmt: 'dd mmm yyyy',
  });
  shDash.cond('K8:M8', {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  shDash.cond('H12:J12', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  shDash.cond('H12:J12', {
    type: 'cellIs',
    operator: 'greaterThanOrEqual',
    formula: '0',
    style: { font: { color: GOOD } },
  });
  // Data grafik (kolom tersembunyi O:R)
  const statuses = [t.status.done, t.status.run, t.status.late, t.status.todo];
  statuses.forEach((s, i) =>
    shDash.set(`O${16 + i}`, s).set(`P${16 + i}`, `=COUNTIF(TaskStatus,O${16 + i})`),
  );
  shDash.chart({
    type: 'doughnut',
    title: t.chartStatus,
    from: 'B15',
    to: 'H33',
    legend: 'r',
    sliceColors: ['3C6A33', '2C4A86', '9A2E3F', 'C9BFAE'],
    series: [
      {
        name: t.chartStatus,
        categories: ref(S.dash, '$O$16:$O$19'),
        values: ref(S.dash, '$P$16:$P$19'),
      },
    ],
  });
  const nPh = Math.max(1, phases.length);
  shDash.chart({
    type: 'bar',
    title: t.chartPhase,
    from: 'H15',
    to: 'N33',
    numFmt: '0%',
    legend: 'none',
    series: [
      {
        name: t.kProgress,
        categories: ref(S.set, `$E$7:$E$${6 + nPh}`),
        values: ref(S.set, `$G$7:$G$${6 + nPh}`),
        color: accent.main,
      },
    ],
  });
  const nTeam = Math.max(1, team.length);
  for (let k = 0; k < nTeam; k++) {
    const r = 40 + k;
    const name = `INDEX(Team,${k + 1})`;
    shDash
      .set(`O${r}`, `=IF(${name}="","",${name})`)
      .set(`P${r}`, `=IF(O${r}="",0,COUNTIFS(TaskOwner,O${r},TaskStatus,${ST.done}))`)
      .set(`Q${r}`, `=IF(O${r}="",0,COUNTIF(TaskOwner,O${r})-P${r})`);
  }
  shDash.chart({
    type: 'column',
    title: t.chartPic,
    from: 'B35',
    to: 'H53',
    numFmt: '0',
    stacked: true,
    series: [
      {
        name: t.picDone,
        categories: ref(S.dash, `$O$40:$O$${39 + nTeam}`),
        values: ref(S.dash, `$P$40:$P$${39 + nTeam}`),
        color: '3C6A33',
      },
      {
        name: t.picOpen,
        categories: ref(S.dash, `$O$40:$O$${39 + nTeam}`),
        values: ref(S.dash, `$Q$40:$Q$${39 + nTeam}`),
        color: CHART_COLORS[2],
      },
    ],
  });
  shDash.merge('I35:M35', t.dueH, st.h2);
  shDash
    .set('I36', t.dueHead[0], st.th)
    .merge('J36:K36', t.dueHead[1], st.thLeft)
    .set('L36', t.dueHead[2], st.thLeft)
    .set('M36', t.dueHead[3], st.th)
    .height(36, 26);
  for (let k = 1; k <= 14; k++) {
    const r = 36 + k;
    const ix = (n: string) => `IF($R${r}="","",INDEX(${n},$R${r}))`;
    shDash
      .set(`R${r}`, `=IFERROR(MATCH(${k},TaskDueSeq,0),"")`)
      .set(`I${r}`, k === 1 ? `=IF($R${r}="","",INDEX(TaskId,$R${r}))` : `=${ix('TaskId')}`, {
        ...st.rowLabel,
        align: { h: 'center' },
      })
      .merge(
        `J${r}:K${r}`,
        k === 1 ? `=IF($R${r}="",${q(t.noDue)},INDEX(TaskName,$R${r}))` : `=${ix('TaskName')}`,
        st.rowLabel,
      )
      .set(`L${r}`, `=${ix('TaskOwner')}`, st.rowLabel)
      .set(`M${r}`, `=${ix('TaskEnd')}`, {
        ...st.rowMoney,
        numFmt: 'dd/mm/yy',
        align: { h: 'center' },
      });
  }
  shDash.cond('M37:M50', {
    type: 'expression',
    formula: 'AND(ISNUMBER(M37),M37<TODAY())',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: '=ProjectName',
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.tasks, t.desc.tasks],
      [S.gantt, t.desc.gantt],
      [S.load, t.desc.load],
      [S.team, t.desc.team],
      [S.set, t.desc.set],
    ],
  });
  return wb;
}
