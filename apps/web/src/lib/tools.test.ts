import { describe, expect, it } from 'vitest';
import { convertCase } from './case';
import { base64Decode, base64Encode, urlDecode, urlEncode } from './encoding';
import { csvToJson, jsonToCsv } from './json-csv';
import { formatJson, parseJson } from './json';
import { textStats } from './text-stats';

describe('textStats', () => {
  it('menghitung kata, karakter, kalimat, paragraf', () => {
    const s = textStats('Halo dunia! Apa kabar?\n\nBaik-baik saja 👍🏽.');
    expect(s.words).toBe(7);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(s.readingMinutes).toBe(1);
  });
  it('emoji dengan modifier dihitung satu karakter', () => {
    expect(textStats('👍🏽').characters).toBe(1);
  });
  it('teks kosong', () => {
    expect(textStats('')).toMatchObject({
      words: 0,
      characters: 0,
      sentences: 0,
      paragraphs: 0,
      readingMinutes: 0,
    });
  });
});

describe('convertCase', () => {
  it('title dan sentence case', () => {
    expect(convertCase('halo DUNIA indah', 'title')).toBe('Halo Dunia Indah');
    expect(convertCase('HALO. apa kabar? baik', 'sentence')).toBe('Halo. Apa kabar? Baik');
  });
  it('gaya pemrograman', () => {
    expect(convertCase('nama pengguna baru', 'camel')).toBe('namaPenggunaBaru');
    expect(convertCase('namaPenggunaBaru', 'snake')).toBe('nama_pengguna_baru');
    expect(convertCase('HTMLParser v2', 'kebab')).toBe('html-parser-v2');
    expect(convertCase('user-id', 'constant')).toBe('USER_ID');
    expect(convertCase('user id', 'pascal')).toBe('UserId');
  });
  it('gaya pemrograman per baris', () => {
    expect(convertCase('satu dua\ntiga empat', 'snake')).toBe('satu_dua\ntiga_empat');
  });
});

describe('encoding', () => {
  it('base64 UTF-8 bolak-balik', () => {
    const text = 'Halo, dunia! ✓ 日本 😀';
    expect(base64Decode(base64Encode(text))).toBe(text);
    expect(base64Encode('hi?>')).toBe('aGk/Pg==');
    expect(base64Encode('hi?>', true)).toBe('aGk_Pg');
    expect(base64Decode('aGk_Pg')).toBe('hi?>');
  });
  it('base64 tidak valid melempar error', () => {
    expect(() => base64Decode('a@b')).toThrow();
    expect(() => base64Decode('/w==')).toThrow(); // bukan UTF-8 valid
  });
  it('url encode/decode', () => {
    expect(urlEncode('a b&c=d/é')).toBe('a%20b%26c%3Dd%2F%C3%A9');
    expect(urlEncode('https://x.id/a b?q=1', 'full')).toBe('https://x.id/a%20b?q=1');
    expect(urlDecode('a+b%20c')).toBe('a b c');
    expect(() => urlDecode('%E0%A4%A')).toThrow();
  });
});

describe('json', () => {
  it('format, minify, dan urut kunci', () => {
    const r = parseJson('{"b":1,"a":[1,2]}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(formatJson(r.value, 0)).toBe('{"b":1,"a":[1,2]}');
    expect(formatJson(r.value, 2, true)).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}');
  });
  it('error dengan baris dan kolom', () => {
    const r = parseJson('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.line).toBe(3);
  });
});

describe('json-csv', () => {
  it('JSON bertingkat ke CSV', () => {
    const csv = jsonToCsv([
      { nama: 'Ani', alamat: { kota: 'Bandung' } },
      { nama: 'Budi', umur: 20 },
    ]);
    expect(csv.split('\r\n')).toEqual(['nama,alamat.kota,umur', 'Ani,Bandung,', 'Budi,,20']);
  });
  it('CSV titik koma ke JSON dengan tipe', () => {
    const r = csvToJson('nama;umur;aktif\nAni;20;true', ';');
    expect(r.rows).toEqual([{ nama: 'Ani', umur: 20, aktif: true }]);
    expect(r.errors).toEqual([]);
  });
});

describe('hash', async () => {
  const { hashText, findMatch } = await import('./hash');
  it('MD5 dan SHA untuk teks', async () => {
    const r = await hashText('abc');
    expect(r.MD5).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(r['SHA-256']).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(findMatch(r, ' 900150983CD24FB0D6963F7D28E17F72 ')).toBe('MD5');
    expect(findMatch(r, 'abc')).toBeUndefined();
  });
});

describe('ffmpeg thread limit', async () => {
  const { withThreadLimit, FFMPEG_THREADS: T } = await import('./media/ffmpeg');
  it('membatasi thread decoder, filter, dan encoder', () => {
    expect(
      withThreadLimit(['-ss', '1', '-i', '/in/a.mp4', '-c:v', 'libx264', '/out/b.mp4']),
    ).toEqual([
      '-filter_threads',
      T,
      '-ss',
      '1',
      '-threads',
      T,
      '-i',
      '/in/a.mp4',
      '-c:v',
      'libx264',
      '-threads',
      T,
      '/out/b.mp4',
    ]);
  });
});
