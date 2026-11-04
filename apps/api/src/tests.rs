//! Test integrasi router: upload, validasi tipe, batas ukuran, rate limit, Gotenberg tiruan,
//! dan memastikan tidak ada file tersisa di folder sementara.

use std::{path::PathBuf, time::Duration};

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
    routing::post,
};
use tower::ServiceExt;

use crate::{app, config::Config, state::AppState};

const BOUNDARY: &str = "----toolland-test";

fn multipart(file: &[u8], name: &str, fields: &[(&str, &str)]) -> Body {
    let mut body = Vec::new();
    for (k, v) in fields {
        body.extend_from_slice(
            format!("--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n")
                .as_bytes(),
        );
    }
    body.extend_from_slice(
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(file);
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    Body::from(body)
}

fn request(path: &str, body: Body) -> Request<Body> {
    Request::post(format!("/api/tools/v1{path}"))
        .header(
            "content-type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        )
        .header("x-real-ip", "203.0.113.7")
        .body(body)
        .unwrap()
}

/// DOCX minimal dengan urutan entri seperti buatan Word, cukup untuk dikenali dari isinya.
fn tiny_docx() -> Vec<u8> {
    fn entry(name: &str, data: &[u8]) -> (Vec<u8>, Vec<u8>) {
        // zip "stored" tanpa kompresi; CRC tidak diperiksa oleh deteksi tipe
        let mut local = Vec::new();
        local.extend_from_slice(&[0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        local.extend_from_slice(&0u32.to_le_bytes());
        local.extend_from_slice(&(data.len() as u32).to_le_bytes());
        local.extend_from_slice(&(data.len() as u32).to_le_bytes());
        local.extend_from_slice(&(name.len() as u16).to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(name.as_bytes());
        local.extend_from_slice(data);
        (local, name.as_bytes().to_vec())
    }
    let mut out = Vec::new();
    for (name, data) in [
        ("[Content_Types].xml", &b"<Types/>"[..]),
        ("_rels/.rels", &b"<Relationships/>"[..]),
        ("word/document.xml", &b"<w:document/>"[..]),
        ("word/_rels/document.xml.rels", &b"<Relationships/>"[..]),
    ] {
        out.extend(entry(name, data).0);
    }
    out
}

struct Ctx {
    app: Router,
    tmp: PathBuf,
}

impl Drop for Ctx {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.tmp);
    }
}

impl Ctx {
    fn leftover_files(&self) -> usize {
        std::fs::read_dir(&self.tmp).map(|d| d.count()).unwrap_or(0)
    }
}

async fn ctx(max_upload: usize, rate: u32) -> Ctx {
    // Gotenberg tiruan: menerima multipart "files" dan mengembalikan PDF kecil.
    let mock = Router::new().route(
        "/forms/libreoffice/convert",
        post(|body: axum::body::Bytes| async move {
            let text = String::from_utf8_lossy(&body);
            if text.contains("name=\"files\"; filename=\"dokumen.docx\"") {
                (
                    StatusCode::OK,
                    [("content-type", "application/pdf")],
                    b"%PDF-1.7 tiruan".to_vec(),
                )
            } else {
                (
                    StatusCode::BAD_REQUEST,
                    [("content-type", "text/plain")],
                    b"bad".to_vec(),
                )
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move { axum::serve(listener, mock).await.unwrap() });

    let tmp = std::env::temp_dir().join(format!("toolland-api-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp).unwrap();
    let cfg = Config {
        addr: "127.0.0.1:0".parse().unwrap(),
        gotenberg_url: format!("http://127.0.0.1:{port}"),
        tmp_dir: tmp.clone(),
        gs_bin: "gs".into(),
        max_upload,
        office_concurrency: 2,
        gs_concurrency: 2,
        process_timeout: Duration::from_secs(30),
        queue_timeout: Duration::from_secs(5),
        rate_per_minute: rate,
        metrics_port: 0,
    };
    Ctx {
        app: app(AppState::new(cfg).unwrap()),
        tmp,
    }
}

#[tokio::test]
async fn health_ok() {
    let c = ctx(1024, 20).await;
    let resp = c
        .app
        .clone()
        .oneshot(
            Request::get("/api/tools/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = to_bytes(resp.into_body(), 1024).await.unwrap();
    assert!(String::from_utf8_lossy(&body).contains("\"ok\""));
}

#[tokio::test]
async fn office_to_pdf_lewat_gotenberg_dan_tidak_meninggalkan_file() {
    let c = ctx(15 * 1024 * 1024, 20).await;
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/office-to-pdf",
            multipart(&tiny_docx(), "laporan rahasia.docx", &[]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(resp.headers()["content-type"], "application/pdf");
    let body = to_bytes(resp.into_body(), 1 << 20).await.unwrap();
    assert!(body.starts_with(b"%PDF"));
    assert_eq!(c.leftover_files(), 0, "file sementara tersisa");
}

#[tokio::test]
async fn tipe_file_divalidasi_dari_isi_bukan_ekstensi() {
    let c = ctx(15 * 1024 * 1024, 20).await;
    // PNG yang diberi nama .docx tetap ditolak
    let png = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/office-to-pdf",
            multipart(&png, "palsu.docx", &[]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/pdf/compress",
            multipart(&tiny_docx(), "a.pdf", &[]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(c.leftover_files(), 0);
}

#[tokio::test]
async fn file_terlalu_besar_ditolak() {
    let c = ctx(1000, 20).await;
    let mut big = tiny_docx();
    big.resize(5000, b' ');
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/office-to-pdf",
            multipart(&big, "besar.docx", &[]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(c.leftover_files(), 0);
}

#[tokio::test]
async fn level_kompres_tidak_valid_ditolak() {
    let c = ctx(15 * 1024 * 1024, 20).await;
    let pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/pdf/compress",
            multipart(pdf, "a.pdf", &[("level", "ultra")]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    assert_eq!(c.leftover_files(), 0);
}

#[tokio::test]
async fn rate_limit_per_ip() {
    let c = ctx(15 * 1024 * 1024, 2).await;
    let mut statuses = Vec::new();
    for _ in 0..3 {
        let png = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
        let resp = c
            .app
            .clone()
            .oneshot(request("/office-to-pdf", multipart(&png, "x.png", &[])))
            .await
            .unwrap();
        statuses.push(resp.status().as_u16());
    }
    assert_eq!(statuses, vec![415, 415, 429]);
}

#[tokio::test]
async fn kompres_pdf_dengan_ghostscript_bila_tersedia() {
    if std::process::Command::new("gs")
        .arg("--version")
        .output()
        .is_err()
    {
        eprintln!("gs tidak terpasang, test dilewati");
        return;
    }
    let c = ctx(15 * 1024 * 1024, 20).await;
    let pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/pdf/compress",
            multipart(pdf, "a.pdf", &[("level", "high")]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = to_bytes(resp.into_body(), 1 << 20).await.unwrap();
    assert!(body.starts_with(b"%PDF"));
    assert_eq!(c.leftover_files(), 0, "file sementara tersisa");
}
