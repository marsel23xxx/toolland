import { describe, expect, it } from 'vitest';
import {
  SHIELDS,
  TypingGame,
  activeMs,
  gameGrade,
  WAVE_BREAK,
  isBossWave,
  multiplier,
  spawnInterval,
  waveCount,
} from './typing-game';
import { WORD_LISTS } from './typing-words';

/** RNG deterministik (mulberry32) agar simulasi bisa diulang. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const newGame = (seed = 1) =>
  new TypingGame({ W: 960, H: 600, words: WORD_LISTS.id, rnd: seeded(seed) });

/** Majukan waktu dalam langkah 16 ms. */
function run(g: TypingGame, ms: number) {
  for (let t = 0; t < ms; t += 16) g.update(16);
}

/** Tunggu sampai ada musuh yang terlihat, lalu kembalikan yang terdekat dengan pemain. */
function nextVisible(g: TypingGame) {
  for (let i = 0; i < 2000; i++) {
    const vis = g.enemies.filter((e) => !e.doomed && e.y > -20 && e.kind !== 'boss');
    if (vis.length) return vis.sort((a, b) => b.y - a.y)[0];
    g.update(16);
  }
  throw new Error('tidak ada musuh muncul');
}

function typeWord(g: TypingGame, word: string) {
  for (const c of word) g.input(c);
}

describe('kurva tingkat kesulitan', () => {
  it('makin banyak dan makin cepat, dengan batas', () => {
    expect(waveCount(1)).toBe(6);
    expect(waveCount(50)).toBe(26);
    expect(spawnInterval(1)).toBeGreaterThan(spawnInterval(8));
    expect(spawnInterval(100)).toBe(520);
    expect(isBossWave(5)).toBe(true);
    expect(isBossWave(4)).toBe(false);
    expect(multiplier(0)).toBe(1);
    expect(multiplier(45)).toBe(3);
    expect(multiplier(999)).toBe(5);
  });
});

describe('penilaian game', () => {
  it('waktu aktif membatasi jeda panjang antar ketukan', () => {
    expect(activeMs([])).toBe(0);
    const keys = [0, 200, 400, 9400, 9600].map((t) => ({ t, ok: true }));
    // 200 + 200 + 1500 (jeda 9 dtk dipotong) + 200 + 300 awal.
    expect(activeMs(keys)).toBe(2400);
  });
  it('nilai dari gelombang, dibatasi akurasi', () => {
    expect(gameGrade(12, 98)).toBe('S');
    expect(gameGrade(12, 90)).toBe('A');
    expect(gameGrade(7, 99)).toBe('A');
    expect(gameGrade(5, 99)).toBe('B');
    expect(gameGrade(3, 99)).toBe('C');
    expect(gameGrade(1, 99)).toBe('D');
    expect(gameGrade(12, 70)).toBe('C');
  });
});

describe('permainan', () => {
  it('mulai dengan jeda gelombang 1, lalu musuh muncul membawa kata', () => {
    const g = newGame();
    g.start();
    expect(g.phase).toBe('break');
    expect(g.events).toContainEqual({ type: 'wave', wave: 1, boss: false });
    run(g, WAVE_BREAK + 50);
    expect(g.phase).toBe('play');
    const e = nextVisible(g);
    expect(e.word).toMatch(/^[a-z]+$/);
  });

  it('mengetik kata mengunci target, menembak, lalu menghancurkan musuh', () => {
    const g = newGame(2);
    g.start();
    const e = nextVisible(g);
    const word = e.word;
    g.input(word[0]);
    expect(g.targetId).toBe(e.id);
    expect(g.events.some((x) => x.type === 'shot')).toBe(true);
    typeWord(g, word.slice(1));
    expect(e.doomed).toBe(true);
    expect(g.targetId).toBeNull();
    // Laser butuh ~0,35 dtk menempuh layar; musuh meledak saat laser terakhir sampai.
    run(g, 700);
    expect(g.enemies.find((x) => x.id === e.id)).toBeUndefined();
    expect(g.destroyed).toBe(1);
    expect(g.score).toBe(10 * word.length);
    expect(g.events.some((x) => x.type === 'explode')).toBe(true);
    expect(g.correctChars).toBe(word.length + 1);
    expect(g.keys.every((k) => k.ok)).toBe(true);
  });

  it('huruf salah memutus combo dan tercatat sebagai salah', () => {
    const g = newGame(3);
    g.start();
    const e = nextVisible(g);
    g.input(e.word[0]);
    expect(g.combo).toBe(1);
    const wrong = e.word[1] === 'q' ? 'z' : 'q';
    expect(g.input(wrong)).toBe(false);
    expect(g.combo).toBe(0);
    expect(g.keys.at(-1)?.ok).toBe(false);
    expect(g.events.at(-1)).toEqual({ type: 'miss' });
    // Target tetap terkunci setelah salah ketik.
    expect(g.targetId).toBe(e.id);
  });

  it('release melepas kunci tanpa menghapus huruf yang sudah tertembak', () => {
    const g = newGame(4);
    g.start();
    const e = nextVisible(g);
    g.input(e.word[0]);
    g.release();
    expect(g.targetId).toBeNull();
    expect(e.typed).toBe(1);
  });

  it('musuh yang dibiarkan menabrak mengurangi perisai sampai game selesai', () => {
    const g = newGame(5);
    g.start();
    run(g, 120_000);
    expect(g.shields).toBe(0);
    expect(g.phase).toBe('over');
    expect(g.events.filter((x) => x.type === 'damage')).toHaveLength(SHIELDS);
    expect(g.events.at(-1)).toEqual({ type: 'gameover' });
    // Setelah selesai, input diabaikan.
    expect(g.input('a')).toBe(false);
  });

  it('menghabisi semua musuh memulai gelombang berikutnya', () => {
    const g = newGame(6);
    g.start();
    for (let guard = 0; g.wave === 1 && guard < 50; guard++) {
      const e = nextVisible(g);
      typeWord(g, e.word.slice(e.typed));
      run(g, 300);
    }
    expect(g.wave).toBe(2);
    expect(g.shields).toBe(SHIELDS);
    expect(g.destroyed).toBe(waveCount(1));
  });

  it('gelombang 5 memunculkan bos dengan beberapa kata yang melepas ranjau', () => {
    const g = newGame(7);
    g.start();
    // Lompat ke gelombang bos.
    (g as unknown as { beginWave(n: number): void }).beginWave(5);
    run(g, WAVE_BREAK + 3000);
    const boss = g.enemies.find((e) => e.kind === 'boss');
    expect(boss).toBeDefined();
    expect(boss!.queue.length).toBe(2);
    run(g, 4000);
    expect(g.enemies.some((e) => e.kind === 'mine')).toBe(true);
    // Habisi ketiga kata bos.
    for (let i = 0; i < 3; i++) {
      g.release();
      g.targetId = boss!.id;
      typeWord(g, boss!.word.slice(boss!.typed));
    }
    run(g, 400);
    expect(g.enemies.find((e) => e.kind === 'boss')).toBeUndefined();
    expect(g.emps).toBe(2);
  });

  it('EMP menghancurkan semua musuh di layar dan hanya bisa dipakai bila tersedia', () => {
    const g = newGame(8);
    g.start();
    run(g, WAVE_BREAK + 9000);
    const before = g.enemies.filter((e) => e.y > -20).length;
    expect(before).toBeGreaterThan(1);
    expect(g.emp()).toBe(true);
    expect(g.enemies.filter((e) => e.y > -20 && e.kind !== 'boss')).toHaveLength(0);
    expect(g.emp()).toBe(false);
  });

  it('ringkasan menghitung KPM, akurasi, dan data game', () => {
    const g = newGame(9);
    g.start();
    for (let i = 0; i < 3; i++) {
      const e = nextVisible(g);
      typeWord(g, e.word.slice(e.typed));
      run(g, 700);
    }
    g.input('q');
    // Kata keempat tuntas tepat sebelum selesai: tetap dihitung walau lasernya belum sampai.
    const last = nextVisible(g);
    typeWord(g, last.word.slice(last.typed));
    g.quit();
    const s = g.summary();
    expect(g.phase).toBe('over');
    expect(s.destroyed).toBe(4);
    expect(s.wpm).toBeGreaterThan(0);
    expect(s.accuracy).toBeLessThan(100);
    expect(s.score).toBe(g.score);
    expect(s.wave).toBe(1);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(s.grade);
  });

  it('kata musuh yang muncul bersamaan sebisa mungkin beda huruf awal', () => {
    const g = newGame(10);
    g.start();
    run(g, WAVE_BREAK + 200);
    for (let i = 0; i < 6; i++) g.spawn('fighter', 100 + i * 120, 100);
    const firsts = g.enemies.map((e) => e.word[0]);
    expect(new Set(firsts).size).toBe(firsts.length);
  });
});
