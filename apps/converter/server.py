"""Konverter dokumen ke DOCX untuk API Toolland (hanya jaringan Docker internal).

POST /odt-to-docx  : body = isi file ODT, hasil = DOCX (LibreOffice).
POST /pdf-to-docx  : body = isi file PDF, hasil = DOCX (pdf2docx).
GET  /health       : 200 bila siap.

Validasi tipe file, batas ukuran, dan rate limit sudah dilakukan API Rust. Di sini tiap konversi
berjalan sebagai proses terpisah dengan batas waktu dan memori, di folder sementara (tmpfs) yang
langsung dihapus. Tidak ada log nama atau isi file.
"""

import json
import os
import resource
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAX_BYTES = int(os.environ.get('CONVERTER_MAX_BYTES', 16 * 1024 * 1024))
TIMEOUT = int(os.environ.get('CONVERTER_TIMEOUT_SECS', 55))
# Batas memori per proses konversi (byte). LibreOffice dan PyMuPDF memakai cukup banyak.
MEM_LIMIT = int(os.environ.get('CONVERTER_MEM_LIMIT', 1536 * 1024 * 1024))
SLOTS = threading.BoundedSemaphore(int(os.environ.get('CONVERTER_CONCURRENCY', 2)))

# Kode keluar pdf_job.py
NO_TEXT = 3


def limit_resources():
    resource.setrlimit(resource.RLIMIT_AS, (MEM_LIMIT, MEM_LIMIT))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.setsid()  # supaya seluruh grup proses bisa dihentikan saat timeout


class Failed(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def run(cmd: list[str], cwd: Path) -> int:
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=limit_resources,
        env={'HOME': str(cwd), 'PATH': os.environ['PATH'], 'TMPDIR': str(cwd), 'LANG': 'C.UTF-8'},
    )
    try:
        return proc.wait(timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, 9)
        proc.wait()
        raise Failed(504, 'timeout') from None


def odt_to_docx(work: Path) -> Path:
    src = work / 'dokumen.odt'
    code = run(
        [
            'soffice',
            '--headless',
            '--norestore',
            '--nolockcheck',
            '--nodefault',
            f'-env:UserInstallation=file://{work}/profile',
            '--convert-to',
            'docx:MS Word 2007 XML',
            '--outdir',
            str(work / 'out'),
            str(src),
        ],
        work,
    )
    out = work / 'out' / 'dokumen.docx'
    if code != 0 or not out.is_file() or out.stat().st_size == 0:
        raise Failed(422, 'failed')
    return out


def pdf_to_docx(work: Path) -> Path:
    out = work / 'dokumen.docx'
    code = run([sys.executable, '-I', str(HERE / 'pdf_job.py'), str(work / 'dokumen.pdf'), str(out)], work)
    if code == NO_TEXT:
        raise Failed(422, 'no_text')
    if code != 0 or not out.is_file() or out.stat().st_size == 0:
        raise Failed(422, 'failed')
    return out


ROUTES = {
    '/odt-to-docx': ('odt', odt_to_docx),
    '/pdf-to-docx': ('pdf', pdf_to_docx),
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'toolland-converter'
    sys_version = ''

    def log_message(self, *args):  # tanpa log akses (privasi)
        pass

    def reply(self, status: int, body: bytes, ctype: str):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error(self, status: int, code: str):
        self.reply(status, json.dumps({'error': code}).encode(), 'application/json')

    def do_GET(self):
        if self.path == '/health':
            self.reply(200, b'ok', 'text/plain')
        else:
            self.error(404, 'not_found')

    def do_POST(self):
        route = ROUTES.get(self.path)
        if not route:
            self.error(404, 'not_found')
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = -1
        if length <= 0:
            self.error(400, 'bad_request')
            return
        if length > MAX_BYTES:
            self.error(413, 'too_large')
            self.close_connection = True
            return
        data = self.rfile.read(length)

        # API Rust sudah mengantre; ini hanya pengaman bila dipanggil berlebihan.
        if not SLOTS.acquire(timeout=5):
            self.error(503, 'busy')
            return
        try:
            ext, convert = route
            with tempfile.TemporaryDirectory(prefix='job-') as tmp:
                work = Path(tmp)
                (work / f'dokumen.{ext}').write_bytes(data)
                del data
                result = convert(work).read_bytes()
            self.reply(
                200,
                result,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            )
        except Failed as e:
            self.error(e.status, e.code)
        except Exception as e:  # noqa: BLE001 - jangan bocorkan detail ke klien
            print(f'konversi gagal: {type(e).__name__}', file=sys.stderr, flush=True)
            self.error(500, 'internal')
        finally:
            SLOTS.release()


def main():
    addr = os.environ.get('CONVERTER_ADDR', '0.0.0.0')
    port = int(os.environ.get('CONVERTER_PORT', 8000))
    if len(sys.argv) > 1 and sys.argv[1] == 'healthcheck':
        import urllib.request

        with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=3) as r:
            sys.exit(0 if r.status == 200 else 1)
    server = ThreadingHTTPServer((addr, port), Handler)
    server.daemon_threads = True
    print(f'converter siap di {addr}:{port}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
