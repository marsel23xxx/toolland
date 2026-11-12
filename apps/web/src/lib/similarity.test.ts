import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { compareTexts, similarityLevel, tokenize } from './similarity';
import { docxXmlToText, extractText, odtXmlToText, TextExtractError } from './text-extract';

const A =
  'Pendidikan karakter adalah usaha sadar untuk menanamkan nilai kebaikan kepada peserta didik. ' +
  'Sekolah memegang peran penting dalam proses ini. Guru menjadi teladan sehari-hari bagi siswa.';

describe('tokenize', () => {
  it('mengabaikan huruf besar, tanda baca, dan aksen', () => {
    expect(tokenize('Café, KOPI! jum’at').map((t) => t.norm)).toEqual(['cafe', 'kopi', 'jumat']);
  });
  it('menyimpan posisi karakter asli', () => {
    const t = tokenize('  halo dunia');
    expect(t[1]).toMatchObject({ start: 7, end: 12 });
  });
});

describe('compareTexts', () => {
  it('teks identik 100%', () => {
    const r = compareTexts(A, A);
    expect(r.overall).toBe(100);
    expect(r.passages).toHaveLength(1);
    expect(r.segA.map((s) => s.text).join('')).toBe(A);
  });

  it('teks berbeda total 0%', () => {
    const r = compareTexts(A, 'Cuaca hari ini cerah dan angin bertiup pelan dari arah laut utara.');
    expect(r.overall).toBe(0);
    expect(r.passages).toHaveLength(0);
  });

  it('kalimat yang dipindah urutannya tetap terdeteksi, tanpa terpengaruh tanda baca', () => {
    const b =
      'GURU MENJADI TELADAN SEHARI-HARI BAGI SISWA!!! Lalu hal lain yang tidak berhubungan sama ' +
      'sekali dengan topik. pendidikan karakter adalah usaha sadar untuk menanamkan nilai kebaikan';
    const r = compareTexts(A, b);
    expect(r.passages.length).toBe(2);
    expect(r.coverA).toBeGreaterThan(50);
    expect(r.coverA).toBeLessThan(100);
    // Bagian yang cocok di B ditandai dengan nomor passage yang sama dengan di A.
    const idsA = new Set(r.segA.filter((s) => s.id !== null).map((s) => s.id));
    const idsB = new Set(r.segB.filter((s) => s.id !== null).map((s) => s.id));
    expect([...idsB].every((id) => idsA.has(id))).toBe(true);
    expect(r.segB.map((s) => s.text).join('')).toBe(b);
  });

  it('k menentukan kepekaan: rangkaian 4 kata terdeteksi di k=3, tidak di k=5', () => {
    const a = 'satu dua tiga empat lima enam tujuh delapan';
    const b = 'nol dua tiga empat lima sembilan sepuluh sebelas';
    expect(compareTexts(a, b, 3).passages).toHaveLength(1);
    expect(compareTexts(a, b, 5).passages).toHaveLength(0);
  });

  it('teks kosong tidak error', () => {
    expect(compareTexts('', A).overall).toBe(0);
  });

  it('kategori', () => {
    expect(similarityLevel(5)).toBe('low');
    expect(similarityLevel(20)).toBe('medium');
    expect(similarityLevel(60)).toBe('high');
  });
});

describe('text-extract', () => {
  const docXml =
    '<w:document><w:body><w:p><w:r><w:t>Halo</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve"> dunia &amp; semua</w:t></w:r></w:p>' +
    '<w:p><w:del><w:r><w:t>dihapus</w:t></w:r></w:del><w:r><w:t>Baris dua</w:t></w:r></w:p></w:body></w:document>';

  it('docx: paragraf, tab, entitas; teks yang dihapus (track changes) diabaikan', () => {
    expect(docxXmlToText(docXml)).toBe('Halo\t dunia & semua\nBaris dua');
  });

  it('odt: paragraf dan spasi berulang', () => {
    const xml =
      '<office:text><text:h>Judul</text:h><text:p>Satu<text:s text:c="2"/>dua</text:p></office:text>';
    expect(odtXmlToText(xml)).toBe('Judul\nSatu  dua');
  });

  it('membaca file .docx utuh dan menolak .doc lama', async () => {
    const zip = zipSync({ 'word/document.xml': strToU8(docXml) });
    const file = new File([zip], 'tugas.docx');
    expect(await extractText(file)).toContain('Baris dua');
    await expect(extractText(new File(['x'], 'lama.doc'))).rejects.toMatchObject({
      code: 'legacyDoc',
    });
    await expect(extractText(new File(['  '], 'kosong.txt'))).rejects.toBeInstanceOf(
      TextExtractError,
    );
  });
});
