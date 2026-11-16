/**
 * Stencil teknik buatan Toolland (tahap 2): elektronika, gerbang logika, IoT, jaringan, UML, ERD.
 * Semua digambar sendiri dalam bahasa stencil maxGraph. Nama diawali "tl." supaya tidak bentrok
 * dengan shape bawaan; titik sambung (constraint) ditaruh tepat di ujung pin.
 *
 * Simbol garis (resistor, dioda, dll.) diberi area klik transparan selebar kotaknya, supaya mudah
 * dipilih walau gambarnya hanya garis tipis.
 */

type Pin = [x: number, y: number, name?: string];

const INK = '#1f2937';
const r = (n: number) => Math.round(n * 100) / 100;

// --- Primitif ------------------------------------------------------------------------------------
const mv = (x: number, y: number) => `<move x="${r(x)}" y="${r(y)}"/>`;
const ln = (x: number, y: number) => `<line x="${r(x)}" y="${r(y)}"/>`;
const cv = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
  `<curve x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" x3="${r(x3)}" y3="${r(y3)}"/>`;
const ar = (rx: number, ry: number, x: number, y: number, sweep = 1, large = 0) =>
  `<arc rx="${r(rx)}" ry="${r(ry)}" x-axis-rotation="0" large-arc-flag="${large}" sweep-flag="${sweep}" x="${r(x)}" y="${r(y)}"/>`;

type Mode = 'stroke' | 'fillstroke' | 'fill';
const path = (d: string, mode: Mode = 'stroke', close = false) =>
  `<path>${d}${close ? '<close/>' : ''}</path><${mode}/>`;
/** Garis lurus. */
const L = (x1: number, y1: number, x2: number, y2: number) => path(mv(x1, y1) + ln(x2, y2));
/** Garis patah melewati titik-titik. */
const poly = (pts: number[][], mode: Mode = 'stroke', close = false) =>
  path(
    mv(pts[0][0], pts[0][1]) +
      pts
        .slice(1)
        .map(([x, y]) => ln(x, y))
        .join(''),
    mode,
    close,
  );
const rect = (x: number, y: number, w: number, h: number, mode: Mode = 'fillstroke') =>
  `<rect x="${r(x)}" y="${r(y)}" w="${r(w)}" h="${r(h)}"/><${mode}/>`;
const rrect = (x: number, y: number, w: number, h: number, arc = 20, mode: Mode = 'fillstroke') =>
  `<roundrect x="${r(x)}" y="${r(y)}" w="${r(w)}" h="${r(h)}" arcsize="${arc}"/><${mode}/>`;
const circle = (cx: number, cy: number, rad: number, mode: Mode = 'fillstroke') =>
  `<ellipse x="${r(cx - rad)}" y="${r(cy - rad)}" w="${r(rad * 2)}" h="${r(rad * 2)}"/><${mode}/>`;
/** Bentuk padat berwarna tinta (titik, kepala panah), lalu kembali ke warna isi semula. */
const solid = (inner: string) => `<save/><fillcolor color="${INK}"/>${inner}<restore/>`;
const text = (str: string, x: number, y: number, size = 12, bold = false) =>
  `<save/><fontsize size="${size}"/>${bold ? '<fontstyle style="1"/>' : ''}<fontcolor color="${INK}"/><text str="${str}" x="${r(x)}" y="${r(y)}" align="center" valign="middle"/><restore/>`;
const dashed = (inner: string) => `<save/><dashed dashed="1"/>${inner}<restore/>`;
/** Busur dari sudut a0 ke a1 (derajat, 0 = kanan, berlawanan jarum jam = ke atas). */
const arcDeg = (cx: number, cy: number, rad: number, a0: number, a1: number) => {
  const p = (a: number) => [
    cx + rad * Math.cos((a * Math.PI) / 180),
    cy - rad * Math.sin((a * Math.PI) / 180),
  ];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return path(mv(x0, y0) + ar(rad, rad, x1, y1, 0, Math.abs(a1 - a0) > 180 ? 1 : 0));
};

// --- Pembungkus ----------------------------------------------------------------------------------
interface Opts {
  aspect?: 'fixed' | 'variable';
  /** Area klik transparan seluas kotak (untuk simbol garis). */
  hit?: boolean;
}
function shape(
  name: string,
  w: number,
  h: number,
  body: string,
  pins: Pin[],
  o: Opts = {},
): string {
  const cons = pins
    .map(
      ([x, y, n]) =>
        `<constraint x="${r(x)}" y="${r(y)}" perimeter="0"${n ? ` name="${n}"` : ''}/>`,
    )
    .join('');
  const hit = o.hit
    ? `<save/><fillcolor color="none"/><rect x="0" y="0" w="${w}" h="${h}"/><fill/><restore/>`
    : '';
  return `<shape name="${name}" w="${w}" h="${h}" aspect="${o.aspect ?? 'variable'}" strokewidth="inherit"><connections>${cons}</connections><foreground>${hit}${body}</foreground></shape>`;
}
/** Titik sambung kotak: tengah tiap sisi + seperempat atas/bawah. */
const BOX: Pin[] = [
  [0.5, 0],
  [0.5, 1],
  [0, 0.5],
  [1, 0.5],
  [0.25, 0],
  [0.75, 0],
  [0.25, 1],
  [0.75, 1],
];
const SIDES: Pin[] = [
  [0, 0.5, 'a'],
  [1, 0.5, 'b'],
];

// --- Elektronika ---------------------------------------------------------------------------------
const head = (tip: number[], w1: number[], w2: number[]) =>
  solid(poly([tip, w1, w2], 'fill', true));

const ELECTRONICS: Record<string, string> = {
  'tl.el.resistor': shape(
    'tl.el.resistor',
    80,
    20,
    L(0, 10, 16, 10) +
      poly([
        [16, 10],
        [20, 2],
        [28, 18],
        [36, 2],
        [44, 18],
        [52, 2],
        [60, 18],
        [64, 10],
      ]) +
      L(64, 10, 80, 10),
    SIDES,
    { hit: true },
  ),
  'tl.el.resistorIec': shape(
    'tl.el.resistorIec',
    80,
    20,
    L(0, 10, 20, 10) + rect(20, 4, 40, 12) + L(60, 10, 80, 10),
    SIDES,
    { hit: true },
  ),
  'tl.el.capacitor': shape(
    'tl.el.capacitor',
    60,
    40,
    L(0, 20, 26, 20) + L(26, 4, 26, 36) + L(34, 4, 34, 36) + L(34, 20, 60, 20),
    SIDES,
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.capPolar': shape(
    'tl.el.capPolar',
    60,
    40,
    L(0, 20, 26, 20) +
      L(26, 4, 26, 36) +
      path(mv(38, 4) + cv(32, 14, 32, 26, 38, 36)) +
      L(33.5, 20, 60, 20) +
      text('+', 18, 9, 11, true),
    SIDES,
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.inductor': shape(
    'tl.el.inductor',
    80,
    20,
    L(0, 14, 12, 14) +
      path(mv(12, 14) + ar(7, 7, 26, 14) + ar(7, 7, 40, 14) + ar(7, 7, 54, 14) + ar(7, 7, 68, 14)) +
      L(68, 14, 80, 14),
    [
      [0, 0.7, 'a'],
      [1, 0.7, 'b'],
    ],
    { hit: true },
  ),
  'tl.el.diode': shape(
    'tl.el.diode',
    60,
    30,
    L(0, 15, 20, 15) +
      poly(
        [
          [20, 3],
          [20, 27],
          [40, 15],
        ],
        'fillstroke',
        true,
      ) +
      L(40, 3, 40, 27) +
      L(40, 15, 60, 15),
    SIDES,
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.zener': shape(
    'tl.el.zener',
    60,
    30,
    L(0, 15, 20, 15) +
      poly(
        [
          [20, 3],
          [20, 27],
          [40, 15],
        ],
        'fillstroke',
        true,
      ) +
      poly([
        [36, 1],
        [40, 3],
        [40, 27],
        [44, 29],
      ]) +
      L(40, 15, 60, 15),
    SIDES,
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.led': shape(
    'tl.el.led',
    60,
    40,
    L(0, 25, 20, 25) +
      poly(
        [
          [20, 13],
          [20, 37],
          [40, 25],
        ],
        'fillstroke',
        true,
      ) +
      L(40, 13, 40, 37) +
      L(40, 25, 60, 25) +
      L(30, 10, 37, 3) +
      head([39, 1], [33, 3], [37, 7]) +
      L(38, 12, 45, 5) +
      head([47, 3], [41, 5], [45, 9]),
    [
      [0, 0.625, 'a'],
      [1, 0.625, 'k'],
    ],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.npn': shape(
    'tl.el.npn',
    60,
    60,
    circle(34, 30, 24, 'stroke') +
      L(0, 30, 22, 30) +
      L(22, 16, 22, 44) +
      poly([
        [22, 24],
        [42, 10],
        [42, 0],
      ]) +
      poly([
        [22, 36],
        [42, 50],
        [42, 60],
      ]) +
      head([40, 48.6], [31.5, 47], [35.8, 40.8]),
    [
      [0, 0.5, 'B'],
      [0.7, 0, 'C'],
      [0.7, 1, 'E'],
    ],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.pnp': shape(
    'tl.el.pnp',
    60,
    60,
    circle(34, 30, 24, 'stroke') +
      L(0, 30, 22, 30) +
      L(22, 16, 22, 44) +
      poly([
        [22, 24],
        [42, 10],
        [42, 0],
      ]) +
      poly([
        [22, 36],
        [42, 50],
        [42, 60],
      ]) +
      head([24.5, 37.7], [30.5, 46.8], [35, 40.2]),
    [
      [0, 0.5, 'B'],
      [0.7, 0, 'C'],
      [0.7, 1, 'E'],
    ],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.nmos': shape(
    'tl.el.nmos',
    60,
    60,
    L(0, 30, 18, 30) +
      L(18, 14, 18, 46) +
      L(24, 12, 24, 22) +
      L(24, 25, 24, 35) +
      L(24, 38, 24, 48) +
      poly([
        [24, 17],
        [44, 17],
        [44, 0],
      ]) +
      poly([
        [24, 43],
        [44, 43],
        [44, 60],
      ]) +
      poly([
        [24, 30],
        [44, 30],
        [44, 43],
      ]) +
      head([25, 30], [32, 26.5], [32, 33.5]),
    [
      [0, 0.5, 'G'],
      [0.733, 0, 'D'],
      [0.733, 1, 'S'],
    ],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.ground': shape(
    'tl.el.ground',
    40,
    30,
    L(20, 0, 20, 12) + L(4, 12, 36, 12) + L(10, 19, 30, 19) + L(16, 26, 24, 26),
    [[0.5, 0, 'gnd']],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.vcc': shape('tl.el.vcc', 40, 30, L(20, 30, 20, 8) + L(6, 8, 34, 8), [[0.5, 1, 'vcc']], {
    hit: true,
    aspect: 'fixed',
  }),
  'tl.el.battery': shape(
    'tl.el.battery',
    60,
    40,
    L(0, 20, 22, 20) +
      L(22, 6, 22, 34) +
      `<save/><strokewidth width="3"/>${L(28, 13, 28, 27)}${L(40, 13, 40, 27)}<restore/>` +
      L(34, 6, 34, 34) +
      L(40, 20, 60, 20) +
      text('+', 15, 8, 11, true),
    [
      [0, 0.5, '+'],
      [1, 0.5, '-'],
    ],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.dcSource': shape(
    'tl.el.dcSource',
    40,
    60,
    circle(20, 30, 16) +
      L(20, 0, 20, 14) +
      L(20, 46, 20, 60) +
      text('+', 20, 23, 11, true) +
      text('−', 20, 38, 12, true),
    [
      [0.5, 0, '+'],
      [0.5, 1, '-'],
    ],
    { aspect: 'fixed' },
  ),
  'tl.el.acSource': shape(
    'tl.el.acSource',
    40,
    60,
    circle(20, 30, 16) +
      L(20, 0, 20, 14) +
      L(20, 46, 20, 60) +
      path(mv(10, 30) + cv(13, 20, 17, 20, 20, 30) + cv(23, 40, 27, 40, 30, 30)),
    [
      [0.5, 0, 'a'],
      [0.5, 1, 'b'],
    ],
    { aspect: 'fixed' },
  ),
  'tl.el.switch': shape(
    'tl.el.switch',
    80,
    30,
    L(0, 20, 22, 20) + circle(24, 20, 2) + L(26, 19, 54, 6) + circle(56, 20, 2) + L(58, 20, 80, 20),
    [
      [0, 0.667, 'a'],
      [1, 0.667, 'b'],
    ],
    { hit: true },
  ),
  'tl.el.pushButton': shape(
    'tl.el.pushButton',
    80,
    40,
    L(0, 30, 22, 30) +
      circle(24, 30, 2) +
      circle(56, 30, 2) +
      L(58, 30, 80, 30) +
      L(20, 22, 60, 22) +
      L(40, 22, 40, 8) +
      L(33, 8, 47, 8),
    [
      [0, 0.75, 'a'],
      [1, 0.75, 'b'],
    ],
    { hit: true },
  ),
  'tl.el.fuse': shape(
    'tl.el.fuse',
    80,
    20,
    L(0, 10, 20, 10) + rect(20, 3, 40, 14) + L(20, 10, 60, 10) + L(60, 10, 80, 10),
    SIDES,
    { hit: true },
  ),
  'tl.el.lamp': shape(
    'tl.el.lamp',
    48,
    40,
    L(0, 20, 10, 20) +
      circle(24, 20, 14) +
      L(14, 10, 34, 30) +
      L(34, 10, 14, 30) +
      L(38, 20, 48, 20),
    SIDES,
    { aspect: 'fixed' },
  ),
  'tl.el.motor': shape(
    'tl.el.motor',
    48,
    40,
    L(0, 20, 8, 20) + circle(24, 20, 16) + text('M', 24, 20, 14, true) + L(40, 20, 48, 20),
    SIDES,
    { aspect: 'fixed' },
  ),
  'tl.el.buzzer': shape(
    'tl.el.buzzer',
    40,
    40,
    path(mv(6, 24) + ar(14, 14, 34, 24), 'fillstroke', true) +
      L(14, 24, 14, 40) +
      L(26, 24, 26, 40),
    [
      [0.35, 1, '+'],
      [0.65, 1, '-'],
    ],
    { aspect: 'fixed' },
  ),
  'tl.el.potentiometer': shape(
    'tl.el.potentiometer',
    80,
    40,
    L(0, 28, 20, 28) +
      rect(20, 22, 40, 12) +
      L(60, 28, 80, 28) +
      L(40, 0, 40, 16) +
      head([40, 21], [35.5, 13], [44.5, 13]),
    [
      [0, 0.7, 'a'],
      [1, 0.7, 'b'],
      [0.5, 0, 'w'],
    ],
    { hit: true },
  ),
  'tl.el.crystal': shape(
    'tl.el.crystal',
    60,
    40,
    L(0, 20, 18, 20) +
      L(18, 8, 18, 32) +
      rect(24, 6, 12, 28) +
      L(42, 8, 42, 32) +
      L(42, 20, 60, 20),
    SIDES,
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.antenna': shape(
    'tl.el.antenna',
    30,
    40,
    L(15, 40, 15, 12) +
      poly([
        [3, 0],
        [15, 14],
        [27, 0],
      ]) +
      L(15, 14, 15, 0),
    [[0.5, 1, 'a']],
    { hit: true, aspect: 'fixed' },
  ),
  'tl.el.opamp': shape(
    'tl.el.opamp',
    80,
    60,
    poly(
      [
        [16, 4],
        [16, 56],
        [66, 30],
      ],
      'fillstroke',
      true,
    ) +
      L(0, 18, 16, 18) +
      L(0, 42, 16, 42) +
      L(66, 30, 80, 30) +
      text('−', 23, 18, 13, true) +
      text('+', 23, 42, 12, true),
    [
      [0, 0.3, '-'],
      [0, 0.7, '+'],
      [1, 0.5, 'out'],
    ],
  ),
  'tl.el.ic8': shape(
    'tl.el.ic8',
    80,
    100,
    rect(15, 0, 50, 100) +
      path(mv(33, 0) + ar(7, 7, 47, 0, 0)) +
      [15, 38, 62, 85].map((y) => L(0, y, 15, y) + L(65, y, 80, y)).join(''),
    [15, 38, 62, 85].flatMap((y, i): Pin[] => [
      [0, y / 100, String(i + 1)],
      [1, y / 100, String(8 - i)],
    ]),
  ),
  'tl.el.junction': shape(
    'tl.el.junction',
    10,
    10,
    solid(circle(5, 5, 4, 'fill')),
    [[0.5, 0.5, 'j']],
    {
      aspect: 'fixed',
    },
  ),
};

// --- Gerbang logika ------------------------------------------------------------------------------
const GATE_PINS2: Pin[] = [
  [0, 0.3, 'a'],
  [0, 0.7, 'b'],
  [1, 0.5, 'y'],
];
const GATE_PINS1: Pin[] = [
  [0, 0.5, 'a'],
  [1, 0.5, 'y'],
];
const andBody = path(mv(16, 5) + ln(40, 5) + ar(20, 20, 40, 45) + ln(16, 45), 'fillstroke', true);
const orBody = (dx = 0) =>
  path(
    mv(14 + dx, 5) +
      cv(34 + dx, 5, 52 + dx, 10, 62 + dx, 25) +
      cv(52 + dx, 40, 34 + dx, 45, 14 + dx, 45) +
      cv(22 + dx, 35, 22 + dx, 15, 14 + dx, 5),
    'fillstroke',
    true,
  );
const inputs = (x: number) => L(0, 15, x, 15) + L(0, 35, x, 35);
const bubble = (cx: number) => circle(cx, 25, 4);
const xorBack = path(mv(12, 5) + cv(20, 15, 20, 35, 12, 45));

const LOGIC: Record<string, string> = {
  'tl.logic.and': shape(
    'tl.logic.and',
    80,
    50,
    inputs(16) + andBody + L(60, 25, 80, 25),
    GATE_PINS2,
  ),
  'tl.logic.nand': shape(
    'tl.logic.nand',
    80,
    50,
    inputs(16) + andBody + bubble(64) + L(68, 25, 80, 25),
    GATE_PINS2,
  ),
  'tl.logic.or': shape(
    'tl.logic.or',
    80,
    50,
    inputs(19) + orBody() + L(62, 25, 80, 25),
    GATE_PINS2,
  ),
  'tl.logic.nor': shape(
    'tl.logic.nor',
    80,
    50,
    inputs(19) + orBody() + bubble(66) + L(70, 25, 80, 25),
    GATE_PINS2,
  ),
  'tl.logic.xor': shape(
    'tl.logic.xor',
    80,
    50,
    inputs(17) + xorBack + orBody(4) + L(66, 25, 80, 25),
    GATE_PINS2,
  ),
  'tl.logic.xnor': shape(
    'tl.logic.xnor',
    80,
    50,
    inputs(17) + xorBack + orBody(4) + `<save/>${bubble(70)}<restore/>` + L(74, 25, 80, 25),
    GATE_PINS2,
  ),
  'tl.logic.not': shape(
    'tl.logic.not',
    80,
    50,
    L(0, 25, 16, 25) +
      poly(
        [
          [16, 5],
          [16, 45],
          [56, 25],
        ],
        'fillstroke',
        true,
      ) +
      bubble(60) +
      L(64, 25, 80, 25),
    GATE_PINS1,
  ),
  'tl.logic.buffer': shape(
    'tl.logic.buffer',
    80,
    50,
    L(0, 25, 16, 25) +
      poly(
        [
          [16, 5],
          [16, 45],
          [56, 25],
        ],
        'fillstroke',
        true,
      ) +
      L(56, 25, 80, 25),
    GATE_PINS1,
  ),
};

// --- IoT (ikon 60 × 60, label di bawah) ----------------------------------------------------------
const icon = (name: string, body: string, w = 60, h = 60) =>
  shape(name, w, h, body, BOX, { aspect: 'fixed', hit: true });
const waves = (cx: number, cy: number, radii: number[], a0 = 45, a1 = 135) =>
  radii.map((rad) => arcDeg(cx, cy, rad, a0, a1)).join('');

const IOT: Record<string, string> = {
  'tl.iot.mcu': icon(
    'tl.iot.mcu',
    rrect(6, 10, 48, 40, 8) +
      rect(0, 24, 7, 12) +
      rect(22, 20, 20, 20) +
      [12, 18, 24, 30, 36, 42, 48].map((x) => L(x, 10, x, 4) + L(x, 50, x, 56)).join(''),
  ),
  'tl.iot.esp': icon(
    'tl.iot.esp',
    rect(10, 2, 40, 56) +
      poly([
        [16, 14],
        [16, 8],
        [22, 8],
        [22, 14],
        [28, 14],
        [28, 8],
        [34, 8],
        [34, 14],
        [40, 14],
        [40, 8],
        [44, 8],
      ]) +
      rect(16, 22, 28, 24) +
      [26, 32, 42, 52].map((y) => L(4, y, 10, y) + L(50, y, 56, y)).join(''),
  ),
  'tl.iot.sbc': icon(
    'tl.iot.sbc',
    rrect(2, 10, 56, 40, 8) +
      rect(8, 13, 36, 6) +
      rect(14, 26, 16, 16) +
      rect(48, 20, 12, 8) +
      rect(48, 34, 12, 8),
  ),
  'tl.iot.sensor': icon(
    'tl.iot.sensor',
    circle(30, 38, 10) + circle(30, 38, 3, 'stroke') + waves(30, 38, [16, 23]),
  ),
  'tl.iot.temp': icon(
    'tl.iot.temp',
    rrect(24, 4, 12, 40, 50) +
      circle(30, 46, 9) +
      L(30, 44, 30, 16) +
      L(37, 12, 42, 12) +
      L(37, 20, 42, 20) +
      L(37, 28, 42, 28),
  ),
  'tl.iot.humidity': icon(
    'tl.iot.humidity',
    path(
      mv(30, 6) +
        cv(44, 24, 46, 32, 46, 38) +
        cv(46, 48, 38, 54, 30, 54) +
        cv(22, 54, 14, 48, 14, 38) +
        cv(14, 32, 16, 24, 30, 6),
      'fillstroke',
      true,
    ) + path(mv(22, 40) + cv(22, 45, 25, 48, 29, 48)),
  ),
  'tl.iot.pir': icon(
    'tl.iot.pir',
    rect(8, 40, 44, 10) +
      path(mv(12, 40) + ar(18, 18, 48, 40), 'fillstroke', true) +
      L(30, 22, 30, 40) +
      L(20, 27, 23, 40) +
      L(40, 27, 37, 40),
  ),
  'tl.iot.ultrasonic': icon(
    'tl.iot.ultrasonic',
    rrect(2, 16, 56, 28, 10) +
      circle(17, 30, 10) +
      circle(43, 30, 10) +
      circle(17, 30, 5, 'stroke') +
      circle(43, 30, 5, 'stroke'),
  ),
  'tl.iot.light': icon(
    'tl.iot.light',
    circle(30, 30, 9) +
      Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return L(
          30 + 14 * Math.cos(a),
          30 + 14 * Math.sin(a),
          30 + 21 * Math.cos(a),
          30 + 21 * Math.sin(a),
        );
      }).join(''),
  ),
  'tl.iot.gas': icon(
    'tl.iot.gas',
    rrect(12, 30, 36, 24, 15) +
      L(20, 38, 40, 38) +
      L(20, 46, 40, 46) +
      [20, 30, 40].map((x) => path(mv(x, 26) + cv(x - 5, 20, x + 4, 15, x - 1, 6))).join(''),
  ),
  'tl.iot.soil': icon(
    'tl.iot.soil',
    rect(16, 4, 28, 14) + rect(19, 18, 7, 36) + rect(34, 18, 7, 36) + dashed(L(2, 38, 58, 38)),
  ),
  'tl.iot.relay': icon(
    'tl.iot.relay',
    rrect(4, 8, 52, 44, 10) +
      rect(10, 16, 16, 28, 'stroke') +
      path(mv(14, 20) + ln(22, 25) + ln(14, 30) + ln(22, 35) + ln(14, 40)) +
      circle(34, 38, 2) +
      circle(48, 38, 2) +
      L(35, 37, 47, 26),
  ),
  'tl.iot.servo': icon(
    'tl.iot.servo',
    rect(0, 26, 6, 14) +
      rect(46, 26, 6, 14) +
      rect(6, 20, 40, 32) +
      circle(18, 20, 6) +
      `<save/><strokewidth width="4"/>${L(18, 20, 42, 8)}<restore/>`,
    52,
    56,
  ),
  'tl.iot.motor': icon(
    'tl.iot.motor',
    rrect(4, 16, 40, 28, 25) + L(44, 30, 56, 30) + text('M', 24, 30, 14, true),
  ),
  'tl.iot.led': icon(
    'tl.iot.led',
    path(mv(18, 40) + ln(18, 20) + ar(12, 12, 42, 20) + ln(42, 40), 'fillstroke', true) +
      L(14, 40, 46, 40) +
      L(25, 40, 25, 56) +
      L(35, 40, 35, 52),
  ),
  'tl.iot.buzzer': icon(
    'tl.iot.buzzer',
    circle(26, 30, 18) + circle(26, 30, 4) + waves(26, 30, [24, 30], -35, 35),
  ),
  'tl.iot.lcd': icon(
    'tl.iot.lcd',
    rrect(2, 12, 56, 36, 8) +
      rect(8, 18, 44, 18) +
      [12, 20, 28, 36, 44].map((x) => circle(x, 42, 1.5)).join(''),
  ),
  'tl.iot.keypad': icon(
    'tl.iot.keypad',
    rrect(10, 4, 40, 52, 10) +
      [0, 1, 2, 3]
        .flatMap((row) => [0, 1, 2].map((col) => rect(16 + col * 10, 10 + row * 11, 7, 7)))
        .join(''),
  ),
  'tl.iot.wifi': icon(
    'tl.iot.wifi',
    waves(30, 48, [10, 20, 30], 45, 135) + solid(circle(30, 48, 3.5, 'fill')),
  ),
  'tl.iot.bluetooth': icon(
    'tl.iot.bluetooth',
    rrect(12, 4, 36, 52, 45) +
      poly([
        [21, 20],
        [39, 38],
        [30, 47],
        [30, 13],
        [39, 22],
        [21, 40],
      ]),
  ),
  'tl.iot.lora': icon(
    'tl.iot.lora',
    L(30, 56, 30, 24) +
      solid(circle(30, 21, 3.5, 'fill')) +
      waves(30, 21, [9, 16], -40, 40) +
      waves(30, 21, [9, 16], 140, 220),
  ),
  'tl.iot.gsm': icon(
    'tl.iot.gsm',
    L(30, 20, 18, 56) +
      L(30, 20, 42, 56) +
      L(22, 44, 38, 44) +
      L(25, 33, 35, 33) +
      waves(30, 18, [8, 14], 20, 160),
  ),
  'tl.iot.gateway': icon(
    'tl.iot.gateway',
    rrect(4, 28, 52, 24, 15) +
      L(14, 28, 10, 6) +
      L(46, 28, 50, 6) +
      circle(16, 40, 2.5) +
      circle(26, 40, 2.5) +
      circle(36, 40, 2.5),
  ),
  'tl.iot.phone': icon(
    'tl.iot.phone',
    rrect(16, 4, 28, 52, 15) + rect(19, 10, 22, 38) + circle(30, 52, 2, 'stroke'),
  ),
  'tl.iot.dashboard': icon(
    'tl.iot.dashboard',
    rect(4, 6, 52, 36) +
      rect(12, 26, 6, 10) +
      rect(22, 18, 6, 18) +
      rect(32, 22, 6, 14) +
      rect(42, 12, 6, 24) +
      L(30, 42, 30, 50) +
      L(18, 50, 42, 50),
  ),
  'tl.iot.battery': icon(
    'tl.iot.battery',
    rrect(4, 18, 46, 24, 15) +
      solid(rect(50, 25, 6, 10, 'fill')) +
      solid(rect(9, 23, 9, 14, 'fill') + rect(21, 23, 9, 14, 'fill')),
  ),
  'tl.iot.solar': icon(
    'tl.iot.solar',
    poly(
      [
        [12, 8],
        [56, 8],
        [48, 40],
        [4, 40],
      ],
      'fillstroke',
      true,
    ) +
      L(26.7, 8, 18.7, 40) +
      L(41.3, 8, 33.3, 40) +
      L(8, 24, 52, 24) +
      L(30, 40, 30, 54) +
      L(20, 54, 40, 54),
  ),
  'tl.iot.power': icon(
    'tl.iot.power',
    rrect(14, 18, 32, 26, 20) + L(23, 6, 23, 18) + L(37, 6, 37, 18) + L(30, 44, 30, 58),
  ),
};

// --- Jaringan --------------------------------------------------------------------------------------
const NETWORK: Record<string, string> = {
  'tl.net.router': icon(
    'tl.net.router',
    rrect(4, 16, 52, 26, 50) +
      L(18, 23, 42, 35) +
      L(42, 23, 18, 35) +
      head([42, 23], [35, 22.5], [39.5, 28.5]) +
      head([18, 35], [25, 35.5], [20.5, 29.5]),
    60,
    56,
  ),
  'tl.net.switch': icon(
    'tl.net.switch',
    rect(2, 16, 56, 24) +
      L(10, 23, 44, 23) +
      head([50, 23], [43, 19.5], [43, 26.5]) +
      L(50, 33, 16, 33) +
      head([10, 33], [17, 29.5], [17, 36.5]),
    60,
    56,
  ),
  'tl.net.server': icon(
    'tl.net.server',
    [4, 21, 38]
      .map((y) => rect(10, y, 40, 15) + circle(42, y + 7.5, 2) + L(16, y + 7.5, 30, y + 7.5))
      .join(''),
  ),
  'tl.net.pc': icon(
    'tl.net.pc',
    rect(4, 6, 52, 34) + rect(8, 10, 44, 26) + L(30, 40, 30, 48) + L(18, 48, 42, 48),
    60,
    54,
  ),
  'tl.net.laptop': icon(
    'tl.net.laptop',
    rect(10, 8, 40, 28) +
      rect(13, 11, 34, 22) +
      poly(
        [
          [4, 38],
          [56, 38],
          [60, 46],
          [0, 46],
        ],
        'fillstroke',
        true,
      ),
    60,
    52,
  ),
  'tl.net.firewall': icon(
    'tl.net.firewall',
    rect(4, 8, 52, 42) +
      [18.5, 29, 39.5].map((y) => L(4, y, 56, y)).join('') +
      L(30, 8, 30, 18.5) +
      L(17, 18.5, 17, 29) +
      L(43, 18.5, 43, 29) +
      L(30, 29, 30, 39.5) +
      L(17, 39.5, 17, 50) +
      L(43, 39.5, 43, 50),
  ),
  'tl.net.ap': icon(
    'tl.net.ap',
    rrect(8, 32, 44, 14, 40) + circle(30, 39, 2) + waves(30, 30, [8, 15, 22], 35, 145),
  ),
  'tl.net.printer': icon(
    'tl.net.printer',
    rect(14, 6, 32, 16) + rect(4, 20, 52, 22) + rect(14, 34, 32, 18) + circle(48, 27, 2),
  ),
  'tl.net.cctv': icon(
    'tl.net.cctv',
    poly(
      [
        [6, 14],
        [44, 8],
        [48, 24],
        [10, 30],
      ],
      'fillstroke',
      true,
    ) +
      circle(44, 16, 3, 'stroke') +
      L(28, 26, 30, 44) +
      L(20, 46, 40, 46),
  ),
  'tl.net.modem': icon(
    'tl.net.modem',
    rrect(4, 24, 52, 20, 20) +
      L(44, 24, 48, 6) +
      [14, 22, 30].map((x) => circle(x, 34, 2)).join(''),
  ),
};

// --- UML dan ERD -------------------------------------------------------------------------------------
const UML_ERD: Record<string, string> = {
  'tl.uml.package': shape(
    'tl.uml.package',
    100,
    70,
    path(
      mv(0, 12) + ln(0, 0) + ln(38, 0) + ln(44, 12) + ln(100, 12) + ln(100, 70) + ln(0, 70),
      'fillstroke',
      true,
    ) + L(0, 12, 44, 12),
    BOX,
  ),
  'tl.uml.component': shape(
    'tl.uml.component',
    120,
    60,
    rect(0, 0, 120, 60) + rect(98, 6, 14, 18) + rect(94, 9, 8, 4) + rect(94, 17, 8, 4),
    BOX,
  ),
  'tl.uml.node': shape(
    'tl.uml.node',
    110,
    80,
    rect(0, 12, 98, 68) +
      poly(
        [
          [0, 12],
          [12, 0],
          [110, 0],
          [98, 12],
        ],
        'fillstroke',
        true,
      ) +
      poly(
        [
          [98, 12],
          [110, 0],
          [110, 68],
          [98, 80],
        ],
        'fillstroke',
        true,
      ),
    BOX,
  ),
  'tl.uml.lifeline': shape(
    'tl.uml.lifeline',
    100,
    200,
    rect(0, 0, 100, 40) + dashed(L(50, 40, 50, 200)),
    [
      [0, 0.1],
      [1, 0.1],
      [0.5, 0.3],
      [0.5, 0.5],
      [0.5, 0.7],
      [0.5, 0.9],
    ],
  ),
  'tl.uml.final': shape(
    'tl.uml.final',
    30,
    30,
    circle(15, 15, 14) + solid(circle(15, 15, 9, 'fill')),
    BOX,
    { aspect: 'fixed' },
  ),
  'tl.erd.weakEntity': shape(
    'tl.erd.weakEntity',
    120,
    50,
    rect(0, 0, 120, 50) + rect(4, 4, 112, 42, 'stroke'),
    BOX,
  ),
  'tl.erd.identRel': shape(
    'tl.erd.identRel',
    100,
    60,
    poly(
      [
        [50, 0],
        [100, 30],
        [50, 60],
        [0, 30],
      ],
      'fillstroke',
      true,
    ) +
      poly(
        [
          [50, 7],
          [88, 30],
          [50, 53],
          [12, 30],
        ],
        'stroke',
        true,
      ),
    [
      [0.5, 0],
      [0.5, 1],
      [0, 0.5],
      [1, 0.5],
    ],
  ),
};

export const TECH_STENCILS: Record<string, string> = {
  ...ELECTRONICS,
  ...LOGIC,
  ...IOT,
  ...NETWORK,
  ...UML_ERD,
};

/** Shape yang garis sambungnya otomatis berupa kabel (tanpa panah, sudut tajam). */
export function isWireShape(shape: unknown): boolean {
  return typeof shape === 'string' && (shape.startsWith('tl.el.') || shape.startsWith('tl.logic.'));
}
