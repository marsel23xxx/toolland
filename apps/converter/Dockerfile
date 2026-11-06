# syntax=docker/dockerfile:1
# Konverter ke DOCX: ODT (LibreOffice Writer) dan PDF (pdf2docx). Hanya jaringan Docker internal.
# Build dari root repo: docker build -f apps/converter/Dockerfile .

FROM debian:bookworm-slim
# Writer saja (tanpa Calc/Impress/GUI) dan font yang ukurannya sama dengan font Microsoft
# (Carlito = Calibri, Caladea = Cambria, Liberation = Arial/Times/Courier) agar tata letak tidak bergeser.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui \
      python3 python3-venv \
      fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea fonts-dejavu-core fonts-noto-core \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 65532 --user-group --no-create-home --shell /usr/sbin/nologin nonroot

COPY apps/converter/requirements.txt /app/requirements.txt
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir --no-compile -r /app/requirements.txt \
 && find /opt/venv -name '__pycache__' -prune -exec rm -rf {} +

COPY apps/converter/server.py apps/converter/pdf_job.py /app/
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    TMPDIR=/tmp
USER 65532:65532
EXPOSE 8000
ENTRYPOINT ["python3", "-I", "/app/server.py"]
