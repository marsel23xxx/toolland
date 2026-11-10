import { describe, expect, it } from 'vitest';
import { pickStoredFiles } from './autosave';

const MB = 1024 ** 2;

describe('simpan otomatis', () => {
  it('rekaman selalu disimpan, lalu file terkecil sampai batas', () => {
    const media = [
      { id: 'besar', size: 400 * MB },
      { id: 'a', size: 200 * MB },
      { id: 'b', size: 250 * MB },
      { id: 'narasi', size: 2 * MB, recorded: true },
      { id: 'c', size: 290 * MB },
    ];
    const keep = pickStoredFiles(media, 600 * MB, 300 * MB);
    expect([...keep]).toEqual(['narasi', 'a', 'b']);
  });

  it('rekaman tetap disimpan walau melebihi batas', () => {
    expect([...pickStoredFiles([{ id: 'r', size: 2000 * MB, recorded: true }], MB, MB)]).toEqual([
      'r',
    ]);
  });
});
