/**
 * Template siap pakai Editor Diagram. Setiap template dibangun dari item pustaka (gaya dan ukuran
 * sama dengan panel shape) menjadi XML mxGraphModel, lalu dibuka sebagai halaman baru.
 */
import type { CellStyle } from '@maxgraph/core';
import { attr, styleToString } from './drawio';
import { LIBRARY, type LibItem } from './library';
import { WIRE_STYLE } from './library-tech';

type Lang = 'id' | 'en';
type Pt = [number, number];

const ITEMS = new Map<string, LibItem>(
  LIBRARY.flatMap((g) => g.items.map((i) => [i.id, i] as const)),
);

class Builder {
  private cells: string[] = [];
  private n = 2;

  /** Shape dari item pustaka `id` di (x, y); ukuran bawaan item kecuali diberi w/h. */
  add(
    id: string,
    value: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    extra: CellStyle = {},
  ): string {
    const it = ITEMS.get(id);
    if (!it) throw new Error(`Item pustaka tidak ada: ${id}`);
    return this.raw(value, x, y, w ?? it.w, h ?? it.h, { ...it.style, ...extra });
  }

  raw(value: string, x: number, y: number, w: number, h: number, style: CellStyle): string {
    const id = `t${this.n++}`;
    this.cells.push(
      `<mxCell id="${id}" value="${attr(value)}" style="${attr(`${styleToString(style)}html=1;`)}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`,
    );
    return id;
  }

  /** Garis antar shape; `exit`/`entry` = titik sambung relatif (untuk pin komponen). */
  link(
    src: string,
    tgt: string,
    value = '',
    style: CellStyle = {},
    o: { exit?: Pt; entry?: Pt; points?: Pt[] } = {},
  ): string {
    const id = `t${this.n++}`;
    const s: Record<string, unknown> = { ...style };
    if (o.exit) Object.assign(s, { exitX: o.exit[0], exitY: o.exit[1], exitPerimeter: 0 });
    if (o.entry) Object.assign(s, { entryX: o.entry[0], entryY: o.entry[1], entryPerimeter: 0 });
    const pts = o.points?.length
      ? `<Array as="points">${o.points.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array>`
      : '';
    this.cells.push(
      `<mxCell id="${id}" value="${attr(value)}" style="${attr(`${styleToString(s as CellStyle)}html=1;`)}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`,
    );
    return id;
  }

  xml(): string {
    return `<mxGraphModel grid="1" gridSize="10" guides="1" connect="1" arrows="1" page="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${this.cells.join('')}</root></mxGraphModel>`;
  }
}

const edge = (id: string): CellStyle => ({ ...ITEMS.get(id)!.style });

/** Label kelas UML / tabel ERD bergaya HTML (nama, garis, baris-baris). */
function boxHtml(title: string, ...sections: string[][]): string {
  const head = `<p style="margin:0px;margin-top:4px;text-align:center;"><b>${title}</b></p>`;
  return (
    head +
    sections
      .map(
        (rows) => `<hr size="1"/><p style="margin:0px;margin-left:6px;">${rows.join('<br/>')}</p>`,
      )
      .join('')
  );
}

export interface DiagramTemplate {
  id: string;
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  build: (lang: Lang) => string;
}

const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en);

export const TEMPLATES: DiagramTemplate[] = [
  {
    id: 'flowLogin',
    name: { id: 'Flowchart login', en: 'Login flowchart' },
    desc: {
      id: 'Alur masuk dengan validasi dan percabangan',
      en: 'Sign-in flow with validation and branching',
    },
    build(l) {
      const b = new Builder();
      const start = b.add('fcTerminator', T(l, 'Mulai', 'Start'), 200, 20);
      const input = b.add(
        'fcData',
        T(l, 'Input username dan password', 'Enter username and password'),
        180,
        110,
        160,
        60,
      );
      const valid = b.add('fcDecision', T(l, 'Data valid?', 'Valid?'), 200, 210, 120, 90);
      const dash = b.add('fcProcess', T(l, 'Tampilkan dasbor', 'Show dashboard'), 200, 350);
      const end = b.add('fcTerminator', T(l, 'Selesai', 'End'), 200, 450);
      const fail = b.add(
        'fcProcess',
        T(l, 'Tampilkan pesan gagal', 'Show error message'),
        400,
        225,
        140,
        60,
      );
      b.link(start, input);
      b.link(input, valid);
      b.link(valid, dash, T(l, 'Ya', 'Yes'));
      b.link(dash, end);
      b.link(valid, fail, T(l, 'Tidak', 'No'));
      b.link(fail, input, '', {}, { exit: [0.5, 0], entry: [1, 0.5] });
      return b.xml();
    },
  },
  {
    id: 'flowLoop',
    name: { id: 'Flowchart perulangan', en: 'Loop flowchart' },
    desc: {
      id: 'Menghitung rata-rata n nilai dengan perulangan',
      en: 'Average of n values using a loop',
    },
    build(l) {
      const b = new Builder();
      const start = b.add('fcTerminator', T(l, 'Mulai', 'Start'), 200, 20);
      const init = b.add('fcPreparation', 'i = 0, total = 0', 190, 100, 140, 50);
      const input = b.add('fcData', T(l, 'Input nilai', 'Enter value'), 200, 180);
      const add = b.add('fcProcess', 'total = total + nilai<br>i = i + 1', 190, 270, 140, 60);
      const cond = b.add('fcDecision', 'i < n ?', 210, 360, 100, 80);
      const avg = b.add('fcProcess', 'rata = total / n', 200, 480);
      const out = b.add('fcData', T(l, 'Tampilkan rata', 'Show average'), 200, 570);
      const end = b.add('fcTerminator', T(l, 'Selesai', 'End'), 200, 660);
      b.link(start, init);
      b.link(init, input);
      b.link(input, add);
      b.link(add, cond);
      b.link(
        cond,
        input,
        T(l, 'Ya', 'Yes'),
        {},
        {
          exit: [1, 0.5],
          entry: [1, 0.5],
          points: [
            [380, 400],
            [380, 210],
          ],
        },
      );
      b.link(cond, avg, T(l, 'Tidak', 'No'));
      b.link(avg, out);
      b.link(out, end);
      return b.xml();
    },
  },
  {
    id: 'circuitLed',
    name: { id: 'Rangkaian LED', en: 'LED circuit' },
    desc: {
      id: 'Baterai, saklar, resistor, dan LED seri',
      en: 'Battery, switch, resistor, and LED in series',
    },
    build() {
      const b = new Builder();
      const bat = b.add('elBattery', '9V', 40, 100);
      const sw = b.add('elSwitch', 'S1', 160, 100);
      const res = b.add('elResistor', 'R1 220Ω', 300, 110);
      const led = b.add('elLed', 'LED1', 440, 95);
      b.link(bat, sw, '', WIRE_STYLE, { exit: [1, 0.5], entry: [0, 0.667] });
      b.link(sw, res, '', WIRE_STYLE, { exit: [1, 0.667], entry: [0, 0.5] });
      b.link(res, led, '', WIRE_STYLE, { exit: [1, 0.5], entry: [0, 0.625] });
      b.link(led, bat, '', WIRE_STYLE, {
        exit: [1, 0.625],
        entry: [0, 0.5],
        points: [
          [540, 110],
          [540, 200],
          [20, 200],
          [20, 120],
        ],
      });
      return b.xml();
    },
  },
  {
    id: 'halfAdder',
    name: { id: 'Half adder', en: 'Half adder' },
    desc: {
      id: 'Penjumlah setengah dengan gerbang XOR dan AND',
      en: 'Half adder with XOR and AND gates',
    },
    build() {
      const b = new Builder();
      const a = b.add('text', 'A', 20, 60, 30, 30);
      const bb = b.add('text', 'B', 20, 160, 30, 30);
      const xor = b.add('lgXor', 'XOR', 160, 60);
      const and = b.add('lgAnd', 'AND', 160, 170);
      const s = b.add('text', 'S (sum)', 340, 70, 70, 30);
      const c = b.add('text', 'C (carry)', 340, 180, 70, 30);
      b.link(a, xor, '', WIRE_STYLE, { entry: [0, 0.3] });
      b.link(a, and, '', WIRE_STYLE, { entry: [0, 0.3] });
      b.link(bb, xor, '', WIRE_STYLE, { entry: [0, 0.7] });
      b.link(bb, and, '', WIRE_STYLE, { entry: [0, 0.7] });
      b.link(xor, s, '', WIRE_STYLE, { exit: [1, 0.5] });
      b.link(and, c, '', WIRE_STYLE, { exit: [1, 0.5] });
      return b.xml();
    },
  },
  {
    id: 'iotTemp',
    name: { id: 'Arsitektur IoT monitoring suhu', en: 'IoT temperature monitoring' },
    desc: {
      id: 'Sensor, ESP32, cloud MQTT, dasbor, dan relay kipas',
      en: 'Sensor, ESP32, MQTT cloud, dashboard, and fan relay',
    },
    build(l) {
      const b = new Builder();
      const dht = b.add('iotTemp', 'DHT22', 40, 60);
      const esp = b.add('iotEsp', 'ESP32', 200, 60);
      const wifi = b.add('iotWifi', 'WiFi', 360, 60);
      const cloud = b.add('iotCloud', 'Cloud (MQTT)', 500, 60);
      const dash = b.add('iotDashboard', T(l, 'Dasbor web', 'Web dashboard'), 680, 0);
      const app = b.add('iotPhone', T(l, 'Aplikasi ponsel', 'Mobile app'), 680, 130);
      const relay = b.add('iotRelay', 'Relay', 200, 220);
      const fan = b.add('iotMotor', T(l, 'Kipas', 'Fan'), 360, 220);
      b.link(dht, esp, T(l, 'suhu', 'temp'));
      b.link(esp, wifi);
      b.link(wifi, cloud, '', { dashed: true, endArrow: 'none' });
      b.link(cloud, dash);
      b.link(cloud, app);
      b.link(esp, relay, T(l, 'kendali', 'control'));
      b.link(relay, fan);
      return b.xml();
    },
  },
  {
    id: 'netOffice',
    name: { id: 'Topologi jaringan kantor', en: 'Office network topology' },
    desc: {
      id: 'Internet, firewall, router, switch, server, dan klien',
      en: 'Internet, firewall, router, switch, server, and clients',
    },
    build(l) {
      const b = new Builder();
      const net = b.add('netInternet', 'Internet', 280, 0);
      const modem = b.add('netModem', 'Modem', 300, 110);
      const fw = b.add('netFirewall', 'Firewall', 300, 220);
      const router = b.add('netRouter', 'Router', 300, 330);
      const sw = b.add('netSwitch', 'Switch', 300, 440);
      const pc1 = b.add('netPc', 'PC 1', 60, 580);
      const pc2 = b.add('netPc', 'PC 2', 180, 580);
      const srv = b.add('netServer', 'Server', 300, 575);
      const prn = b.add('netPrinter', 'Printer', 420, 575);
      const ap = b.add('netAp', 'Access point', 560, 440);
      const lap = b.add('netLaptop', T(l, 'Laptop tamu', 'Guest laptop'), 560, 580);
      const link = edge('netLink');
      for (const [a, c] of [
        [net, modem],
        [modem, fw],
        [fw, router],
        [router, sw],
        [sw, pc1],
        [sw, pc2],
        [sw, srv],
        [sw, prn],
        [sw, ap],
      ])
        b.link(a, c, '', { ...link, edgeStyle: 'orthogonalEdgeStyle' });
      b.link(ap, lap, '', edge('netWireless'));
      return b.xml();
    },
  },
  {
    id: 'erdShop',
    name: { id: 'ERD toko online', en: 'Online store ERD' },
    desc: {
      id: 'Tabel pelanggan, pesanan, detail, dan produk',
      en: 'Customer, order, order item, and product tables',
    },
    build(l) {
      const b = new Builder();
      const cust = b.add(
        'erTable',
        boxHtml(T(l, 'Pelanggan', 'Customer'), [
          '<u>id_pelanggan</u> (PK)',
          'nama',
          'email',
          'telepon',
        ]),
        20,
        40,
        170,
        110,
      );
      const order = b.add(
        'erTable',
        boxHtml(T(l, 'Pesanan', 'Order'), [
          '<u>id_pesanan</u> (PK)',
          'id_pelanggan (FK)',
          'tanggal',
          'total',
        ]),
        280,
        40,
        170,
        110,
      );
      const item = b.add(
        'erTable',
        boxHtml(T(l, 'Detail pesanan', 'Order item'), [
          '<u>id_detail</u> (PK)',
          'id_pesanan (FK)',
          'id_produk (FK)',
          'jumlah',
        ]),
        280,
        230,
        170,
        110,
      );
      const prod = b.add(
        'erTable',
        boxHtml(T(l, 'Produk', 'Product'), ['<u>id_produk</u> (PK)', 'nama', 'harga', 'stok']),
        540,
        230,
        170,
        110,
      );
      b.link(cust, order, '', edge('er1n'));
      b.link(order, item, '', edge('er1n'));
      b.link(prod, item, '', edge('er1n'));
      return b.xml();
    },
  },
  {
    id: 'useCaseLib',
    name: { id: 'Use case perpustakaan', en: 'Library use case' },
    desc: {
      id: 'Aktor anggota dan petugas dalam batas sistem',
      en: 'Member and librarian actors in a system boundary',
    },
    build(l) {
      const b = new Builder();
      b.add('umlSystem', T(l, 'Sistem Perpustakaan', 'Library System'), 140, 0, 300, 400);
      const member = b.add('umlActor', T(l, 'Anggota', 'Member'), 40, 150);
      const staff = b.add('umlActor', T(l, 'Petugas', 'Librarian'), 520, 150);
      const login = b.add('umlUseCase', 'Login', 220, 40);
      const search = b.add('umlUseCase', T(l, 'Cari buku', 'Search books'), 220, 120);
      const borrow = b.add('umlUseCase', T(l, 'Pinjam buku', 'Borrow book'), 220, 200);
      const ret = b.add('umlUseCase', T(l, 'Kembalikan buku', 'Return book'), 220, 280);
      const manage = b.add(
        'umlUseCase',
        T(l, 'Kelola data buku', 'Manage books'),
        220,
        340,
        140,
        50,
      );
      const assoc = edge('umlAssoc');
      for (const u of [login, search, borrow, ret]) b.link(member, u, '', assoc);
      for (const u of [login, borrow, ret, manage]) b.link(staff, u, '', assoc);
      b.link(borrow, login, '«include»', edge('umlDepend'), {
        exit: [1, 0.5],
        entry: [1, 0.5],
        points: [
          [400, 230],
          [400, 70],
        ],
      });
      return b.xml();
    },
  },
  {
    id: 'classAcademic',
    name: { id: 'Class diagram akademik', en: 'Academic class diagram' },
    desc: {
      id: 'Pewarisan pengguna, mahasiswa, dosen, dan mata kuliah',
      en: 'User, student, lecturer inheritance and courses',
    },
    build(l) {
      const b = new Builder();
      const user = b.add(
        'umlClass',
        boxHtml(T(l, 'Pengguna', 'User'), ['- id: int', '- nama: String'], ['+ login(): bool']),
        220,
        20,
        170,
        100,
      );
      const stu = b.add(
        'umlClass',
        boxHtml(T(l, 'Mahasiswa', 'Student'), ['- nim: String'], ['+ ambilKRS(): void']),
        60,
        200,
        170,
        90,
      );
      const lec = b.add(
        'umlClass',
        boxHtml(T(l, 'Dosen', 'Lecturer'), ['- nidn: String'], ['+ inputNilai(): void']),
        380,
        200,
        170,
        90,
      );
      const course = b.add(
        'umlClass',
        boxHtml(T(l, 'MataKuliah', 'Course'), ['- kode: String', '- nama: String', '- sks: int']),
        220,
        380,
        170,
        90,
      );
      b.link(stu, user, '', edge('umlInherit'));
      b.link(lec, user, '', edge('umlInherit'));
      b.link(stu, course, T(l, 'mengambil', 'takes'), edge('umlAssoc'));
      b.link(lec, course, T(l, 'mengajar', 'teaches'), edge('umlAssoc'));
      return b.xml();
    },
  },
];
