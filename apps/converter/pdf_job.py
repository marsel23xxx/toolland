"""Satu konversi PDF ke DOCX (dijalankan server.py sebagai proses terpisah).

Keluar dengan kode 3 bila PDF tidak punya teks (hasil scan/foto), karena hasilnya hanya gambar
dan tidak bisa diedit; pengguna diberi tahu, bukan diberi DOCX yang menyesatkan.
"""

import logging
import re
import shutil
import sys
import zipfile

import fitz  # PyMuPDF
from pdf2docx import Converter

NO_TEXT = 3

DOC_XML = 'word/document.xml'


def loosen_rows(path: str) -> None:
    """Tinggi baris tabel "exact" jadi "atLeast": teks tidak terpotong bila font di
    komputer pengguna sedikit lebih besar dari font di PDF."""
    tmp = path + '.tmp'
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item)
            if item.filename == DOC_XML:
                data = re.sub(
                    rb'(<w:trHeight\b[^>]*?)w:hRule="exact"', rb'\1w:hRule="atLeast"', data
                )
            dst.writestr(item, data)
    shutil.move(tmp, path)


def main(src: str, dst: str) -> int:
    logging.disable(logging.CRITICAL)
    with fitz.open(src) as doc:
        if doc.needs_pass:
            return 1
        if not any(page.get_text('text').strip() for page in doc):
            return NO_TEXT
    cv = Converter(src)
    try:
        # Tanpa "stream table": teks berkolom/daftar tanpa garis tidak dijadikan tabel tak terlihat
        # (yang sering memotong baris). Tabel bergaris tetap dikenali.
        cv.convert(dst, multi_processing=False, parse_stream_table=False)
    finally:
        cv.close()
    loosen_rows(dst)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
