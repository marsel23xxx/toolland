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
    // Converter tiruan: ODT selalu berhasil; PDF berisi "SCAN" dianggap tanpa teks.
    let docx = || {
        (
            StatusCode::OK,
            [("content-type", "application/octet-stream")],
            b"PK\x03\x04 docx tiruan".to_vec(),
        )
    };
    let mock = mock
        .route("/odt-to-docx", post(move || async move { docx() }))
        .route(
            "/pdf-to-docx",
            post(move |body: axum::body::Bytes| async move {
                if body.windows(4).any(|w| w == b"SCAN") {
                    (
                        StatusCode::UNPROCESSABLE_ENTITY,
                        [("content-type", "application/json")],
                        br#"{"error": "no_text"}"#.to_vec(),
                    )
                } else {
                    docx()
                }
            }),
        );
    // Registry RDAP tiruan: daftar IANA berisi .com dan .id, hanya contoh.com yang terdaftar.
    let mock = mock
        .route(
            "/rdap/dns.json",
            axum::routing::get(|headers: axum::http::HeaderMap| async move {
                let host = headers["host"].to_str().unwrap().to_owned();
                axum::Json(serde_json::json!({"services": [
                    [["com", "id"], [format!("http://{host}/rdap")]]
                ]}))
            }),
        )
        .route(
            "/rdap/domain/{name}",
            axum::routing::get(|axum::extract::Path(name): axum::extract::Path<String>| async move {
                if name == "contoh.com" {
                    (
                        StatusCode::OK,
                        axum::Json(serde_json::json!({
                            "ldhName": "CONTOH.COM",
                            "status": ["client transfer prohibited"],
                            "events": [
                                {"eventAction": "registration", "eventDate": "2010-05-01T00:00:00Z"},
                                {"eventAction": "expiration", "eventDate": "2030-05-01T00:00:00Z"}
                            ],
                            "nameservers": [{"ldhName": "NS1.CONTOH.COM"}],
                            "secureDNS": {"delegationSigned": false},
                            "entities": [{
                                "roles": ["registrar"],
                                "publicIds": [{"type": "IANA Registrar ID", "identifier": "1234"}],
                                "vcardArray": ["vcard", [["fn", {}, "text", "Registrar Contoh"]]],
                                "entities": [{
                                    "roles": ["abuse"],
                                    "vcardArray": ["vcard", [["email", {}, "text", "abuse@contoh.test"]]]
                                }]
                            }]
                        })),
                    )
                } else {
                    (StatusCode::NOT_FOUND, axum::Json(serde_json::json!({})))
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
        converter_url: format!("http://127.0.0.1:{port}"),
        tmp_dir: tmp.clone(),
        gs_bin: "gs".into(),
        max_upload,
        office_concurrency: 2,
        gs_concurrency: 2,
        docx_concurrency: 2,
        process_timeout: Duration::from_secs(30),
        queue_timeout: Duration::from_secs(5),
        rate_per_minute: rate,
        lookup_rate_per_minute: rate,
        rdap_bootstrap_url: format!("http://127.0.0.1:{port}/rdap/dns.json"),
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

/// ODT minimal: zip dengan entri pertama "mimetype" tanpa kompresi, seperti buatan LibreOffice.
fn tiny_odt() -> Vec<u8> {
    let mime = b"application/vnd.oasis.opendocument.text";
    let mut z = b"PK\x03\x04".to_vec();
    z.extend_from_slice(&[20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    z.extend_from_slice(&(mime.len() as u32).to_le_bytes());
    z.extend_from_slice(&(mime.len() as u32).to_le_bytes());
    z.extend_from_slice(&8u16.to_le_bytes());
    z.extend_from_slice(&0u16.to_le_bytes());
    z.extend_from_slice(b"mimetype");
    z.extend_from_slice(mime);
    z
}

#[tokio::test]
async fn odt_dan_pdf_ke_docx_lewat_converter() {
    let c = ctx(15 * 1024 * 1024, 20).await;
    for (path, file, name) in [
        ("/odt-to-docx", tiny_odt(), "surat.odt"),
        (
            "/pdf-to-docx",
            b"%PDF-1.7\nteks biasa\n".to_vec(),
            "surat.pdf",
        ),
    ] {
        let resp = c
            .app
            .clone()
            .oneshot(request(path, multipart(&file, name, &[])))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK, "{path}");
        assert!(
            resp.headers()["content-type"]
                .to_str()
                .unwrap()
                .contains("wordprocessingml")
        );
        let body = to_bytes(resp.into_body(), 1 << 20).await.unwrap();
        assert!(body.starts_with(b"PK"));
    }
    assert_eq!(c.leftover_files(), 0, "file sementara tersisa");
}

#[tokio::test]
async fn pdf_hasil_scan_diberi_kode_no_text() {
    let c = ctx(15 * 1024 * 1024, 20).await;
    let resp = c
        .app
        .clone()
        .oneshot(request(
            "/pdf-to-docx",
            multipart(b"%PDF-1.7\nSCAN\n", "scan.pdf", &[]),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = to_bytes(resp.into_body(), 1024).await.unwrap();
    assert!(String::from_utf8_lossy(&body).contains("\"no_text\""));
    assert_eq!(c.leftover_files(), 0);
}

#[tokio::test]
async fn odt_ke_docx_menolak_file_selain_odt() {
    let c = ctx(15 * 1024 * 1024, 20).await;
    // DOCX dan PDF yang diberi nama .odt ditolak
    for file in [tiny_docx(), b"%PDF-1.7\n".to_vec()] {
        let resp = c
            .app
            .clone()
            .oneshot(request("/odt-to-docx", multipart(&file, "palsu.odt", &[])))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }
    assert_eq!(c.leftover_files(), 0);
}

fn whois(domain: &str) -> Request<Body> {
    Request::post("/api/tools/v1/whois")
        .header("content-type", "application/json")
        .header("x-real-ip", "203.0.113.9")
        .body(Body::from(
            serde_json::json!({ "domain": domain }).to_string(),
        ))
        .unwrap()
}

async fn whois_status(app: &Router, domain: &str) -> (StatusCode, String) {
    let resp = app.clone().oneshot(whois(domain)).await.unwrap();
    let status = resp.status();
    let body = to_bytes(resp.into_body(), 1 << 20).await.unwrap();
    (status, String::from_utf8_lossy(&body).into_owned())
}

#[tokio::test]
async fn whois_lewat_rdap_termasuk_subdomain() {
    let c = ctx(1024, 20).await;
    let (status, body) = whois_status(&c.app, "WWW.Contoh.com").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let json: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(json["found"], true);
    assert_eq!(json["domain"], "contoh.com");
    assert_eq!(json["registered"], "2010-05-01T00:00:00Z");
    assert_eq!(json["nameservers"][0], "ns1.contoh.com");
    assert_eq!(json["registrar"]["name"], "Registrar Contoh");
    assert_eq!(json["registrar"]["iana_id"], "1234");
    assert_eq!(json["registrar"]["abuse_email"], "abuse@contoh.test");
    assert_eq!(json["dnssec"], false);
}

#[tokio::test]
async fn whois_kode_error() {
    let c = ctx(1024, 20).await;
    let (status, body) = whois_status(&c.app, "belum-ada.com").await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#""found":false"#), "{body}");
    let (status, body) = whois_status(&c.app, "contoh.xyz").await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body.contains("no_rdap"));
    let (status, body) = whois_status(&c.app, "127.0.0.1").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body.contains("bad_request"));
}

#[tokio::test]
async fn whois_dibatasi_per_ip() {
    let c = ctx(1024, 2).await;
    for _ in 0..2 {
        assert_eq!(whois_status(&c.app, "contoh.com").await.0, StatusCode::OK);
    }
    assert_eq!(
        whois_status(&c.app, "contoh.com").await.0,
        StatusCode::TOO_MANY_REQUESTS
    );
}
