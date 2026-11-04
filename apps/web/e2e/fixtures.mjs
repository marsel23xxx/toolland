// Buat file uji yang tidak di-commit (PDF, JPG dengan EXIF rotasi, salinan untuk batch) di folder sementara.
import fs from 'node:fs';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Sisipkan segmen EXIF (Orientation) ke JPEG. */
function withOrientation(jpeg, orientation) {
  const exif = Buffer.alloc(34);
  exif.writeUInt16BE(0xffe1, 0);
  exif.writeUInt16BE(32, 2);
  exif.write('Exif\0\0', 4, 'latin1');
  exif.write('II', 10, 'latin1');
  exif.writeUInt16LE(42, 12);
  exif.writeUInt32LE(8, 14);
  exif.writeUInt16LE(1, 18);
  exif.writeUInt16LE(0x0112, 20);
  exif.writeUInt16LE(3, 22);
  exif.writeUInt32LE(1, 24);
  exif.writeUInt16LE(orientation, 28);
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

export async function makeFixtures() {
  // Folder sementara di dalam project (diabaikan git), bukan /tmp bersama.
  const base = path.join(HERE, '.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'run-'));
  for (const f of fs.readdirSync(path.join(HERE, 'fixtures')))
    fs.copyFileSync(path.join(HERE, 'fixtures', f), path.join(dir, f));
  const jpg = fs.readFileSync(path.join(dir, 'foto.jpg'));
  for (let i = 1; i <= 6; i++) fs.writeFileSync(path.join(dir, `batch-${i}.jpg`), jpg);
  fs.writeFileSync(
    path.join(dir, 'putar-90.jpg'),
    withOrientation(fs.readFileSync(path.join(dir, 'kecil.jpg')), 6),
  );

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 4; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Dokumen uji - halaman ${i}`, {
      x: 60,
      y: 760,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
    if (i === 3) p.setRotation(degrees(90));
  }
  fs.writeFileSync(path.join(dir, 'teks.pdf'), await doc.save());

  const doc2 = await PDFDocument.create();
  const img = await doc2.embedJpg(jpg);
  for (let i = 0; i < 2; i++)
    doc2.addPage([595, 842]).drawImage(img, { x: 20, y: 300, width: 555, height: 416 });
  fs.writeFileSync(path.join(dir, 'foto.pdf'), await doc2.save());

  fs.writeFileSync(path.join(dir, 'bukan.pdf'), 'ini bukan pdf');

  // DOCX minimal yang valid untuk LibreOffice (urutan entri seperti buatan Word).
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  fs.writeFileSync(
    path.join(dir, 'surat.docx'),
    zipSync({
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Surat uji Toolland</w:t></w:r></w:p></w:body></w:document>`,
      ),
      'word/_rels/document.xml.rels': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
      ),
    }),
  );

  // Foto wajah untuk uji AI: aset uji MediaPipe (Apache-2.0). Tidak di-commit; diunduh sekali ke cache.
  const cache = path.join(base, 'cache');
  fs.mkdirSync(cache, { recursive: true });
  const face = path.join(cache, 'wajah.jpg');
  if (!fs.existsSync(face)) {
    try {
      const res = await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');
      if (res.ok) fs.writeFileSync(face, Buffer.from(await res.arrayBuffer()));
    } catch {
      /* offline: uji yang butuh foto wajah dilewati */
    }
  }
  if (fs.existsSync(face)) fs.copyFileSync(face, path.join(dir, 'wajah.jpg'));
  return dir;
}
