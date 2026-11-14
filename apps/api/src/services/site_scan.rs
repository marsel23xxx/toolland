//! Cek Website: buka halaman depan sebuah situs seperti pengunjung biasa, lalu kumpulkan fakta
//! mentah (rantai redirect, sertifikat TLS, header, cookie, awal HTML, catatan DNS email).
//! Penilaian keamanan dan deteksi teknologi dikerjakan di browser dari fakta ini.
//!
//! Pengaman SSRF: hanya http/https di port 80/443, host harus nama domain (bukan IP), dan setiap
//! nama domain diresolusi sendiri lalu alamat privat/internal ditolak sebelum koneksi dibuat,
//! termasuk di setiap redirect. Tidak ada pemindaian aktif: hanya GET biasa ke beberapa alamat.

use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use reqwest::{
    Url,
    dns::{Addrs, Name, Resolve, Resolving},
    header::{HeaderMap, LOCATION, SET_COOKIE},
    redirect::Policy,
    tls::{TlsInfo, Version},
};
use serde::Serialize;
use serde_json::Value;
use tokio::sync::Semaphore;

use crate::error::{ApiError, ApiResult};

const CACHE_TTL: Duration = Duration::from_secs(10 * 60);
const CACHE_MAX: usize = 500;
/// Batas waktu seluruh pengecekan satu situs.
const SCAN_TIMEOUT: Duration = Duration::from_secs(25);
const MAX_REDIRECTS: usize = 6;
/// HTML yang dibaca (cukup untuk head dan awal body tempat penanda teknologi berada).
const MAX_HTML: usize = 400 * 1024;
const MAX_HEADERS: usize = 120;
const MAX_HEADER_VALUE: usize = 2000;
const UA: &str = concat!(
    "Mozilla/5.0 (compatible; Toolland-SiteCheck/",
    env!("CARGO_PKG_VERSION"),
    "; +https://julian-marcell.com/tools/cek-website)"
);

#[derive(Clone, Debug, Serialize)]
pub struct Hop {
    pub url: String,
    pub status: u16,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct Cert {
    pub subject: Option<String>,
    pub issuer: Option<String>,
    pub sans: Vec<String>,
    /// Detik Unix.
    pub not_before: Option<i64>,
    pub not_after: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Tls {
    /// TLS 1.3, TLS 1.2, ...
    pub version: Option<&'static str>,
    /// Sertifikat lolos verifikasi browser (rantai, nama, tanggal).
    pub valid: bool,
    /// Alasan tidak valid: expired, name, issuer, other.
    pub error: Option<&'static str>,
    pub cert: Option<Cert>,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct Cookie {
    pub name: String,
    pub secure: bool,
    pub http_only: bool,
    pub same_site: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct Dns {
    /// false bila server DNS tidak bisa ditanya (hasil lain tidak bisa dipercaya).
    pub ok: bool,
    pub spf: Option<String>,
    pub dmarc: Option<String>,
    pub caa: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ScanResult {
    pub host: String,
    pub final_url: String,
    pub status: u16,
    pub ip: Option<String>,
    pub redirects: Vec<Hop>,
    /// Apakah http://host/ dialihkan ke https. `None` bila http tidak bisa dibuka.
    pub http_to_https: Option<bool>,
    pub tls: Option<Tls>,
    /// Header respons terakhir (nama huruf kecil), tanpa Set-Cookie.
    pub headers: Vec<(String, String)>,
    /// Hanya nama dan atribut cookie; nilainya tidak pernah dikirim balik.
    pub cookies: Vec<Cookie>,
    pub html: String,
    pub html_truncated: bool,
    pub security_txt: bool,
    pub dns: Dns,
}

#[derive(Debug, thiserror::Error)]
#[error("alamat tujuan bukan alamat publik")]
struct Blocked;

/// Resolver DNS yang membuang alamat privat/internal sebelum reqwest membuka koneksi.
struct PublicOnly;

impl Resolve for PublicOnly {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_owned();
        Box::pin(async move {
            let all: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), 0)).await?.collect();
            let public: Vec<SocketAddr> = all.into_iter().filter(|a| is_public(a.ip())).collect();
            if public.is_empty() {
                return Err(Box::new(Blocked) as _);
            }
            Ok(Box::new(public.into_iter()) as Addrs)
        })
    }
}

type Cached = (Instant, Result<Arc<ScanResult>, &'static str>);

pub struct Scanner {
    /// Verifikasi sertifikat normal, tanpa redirect otomatis (redirect diikuti manual).
    strict: reqwest::Client,
    /// Untuk situs dengan sertifikat bermasalah: tetap dibaca supaya hasil lain bisa ditampilkan.
    lenient: reqwest::Client,
    /// DNS-over-HTTPS (JSON) untuk TXT/CAA.
    doh: reqwest::Client,
    doh_url: String,
    slots: Semaphore,
    cache: Mutex<HashMap<String, Cached>>,
}

impl Scanner {
    pub fn new(doh_url: String, concurrency: usize) -> anyhow::Result<Self> {
        let build = |lenient: bool| {
            reqwest::Client::builder()
                .user_agent(UA)
                .timeout(Duration::from_secs(12))
                .connect_timeout(Duration::from_secs(8))
                .redirect(Policy::none())
                .no_proxy()
                .dns_resolver(PublicOnly)
                .tls_info(true)
                .tls_danger_accept_invalid_certs(lenient)
                .build()
        };
        Ok(Self {
            strict: build(false)?,
            lenient: build(true)?,
            doh: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .user_agent(UA)
                .build()?,
            doh_url,
            slots: Semaphore::new(concurrency.max(1)),
            cache: Mutex::new(HashMap::new()),
        })
    }

    pub async fn scan(&self, host: &str, queue_timeout: Duration) -> ApiResult<Arc<ScanResult>> {
        if let Some(hit) = self.cached(host) {
            return hit;
        }
        let _slot = tokio::time::timeout(queue_timeout, self.slots.acquire())
            .await
            .map_err(|_| ApiError::Busy)?
            .map_err(|_| ApiError::Busy)?;
        let result = tokio::time::timeout(SCAN_TIMEOUT, self.run(host))
            .await
            .unwrap_or(Err(ApiError::Timeout))
            .map(Arc::new);
        // Situs yang tidak bisa dibuka juga disimpan sebentar, supaya tidak diulang-ulang.
        let to_cache = match &result {
            Ok(r) => Some(Ok(r.clone())),
            Err(ApiError::Blocked) => Some(Err("blocked")),
            Err(ApiError::Unreachable) => Some(Err("unreachable")),
            Err(_) => None,
        };
        if let Some(v) = to_cache {
            let mut cache = self.cache.lock().unwrap();
            if cache.len() >= CACHE_MAX {
                cache.retain(|_, (t, _)| t.elapsed() < CACHE_TTL);
                if cache.len() >= CACHE_MAX {
                    cache.clear();
                }
            }
            cache.insert(host.to_owned(), (Instant::now(), v));
        }
        result
    }

    fn cached(&self, host: &str) -> Option<ApiResult<Arc<ScanResult>>> {
        let cache = self.cache.lock().unwrap();
        let (at, v) = cache.get(host)?;
        if at.elapsed() >= CACHE_TTL {
            return None;
        }
        Some(match v {
            Ok(r) => Ok(r.clone()),
            Err("blocked") => Err(ApiError::Blocked),
            Err(_) => Err(ApiError::Unreachable),
        })
    }

    async fn run(&self, host: &str) -> ApiResult<ScanResult> {
        let https =
            Url::parse(&format!("https://{host}/")).map_err(|_| ApiError::BadRequest("url"))?;
        let http =
            Url::parse(&format!("http://{host}/")).map_err(|_| ApiError::BadRequest("url"))?;
        let apex = host.strip_prefix("www.").unwrap_or(host).to_owned();

        let (page, http_to_https, dns) = tokio::join!(
            self.open_https(https),
            self.http_to_https(http.clone()),
            self.dns(&apex, host),
        );

        // https gagal dibuka: pakai jalur http sebagai halaman utama. Tanpa verifikasi sertifikat,
        // karena http bisa saja dialihkan ke https yang sertifikatnya bermasalah.
        let (page, tls_error) = match page {
            Ok(p) => p,
            Err(e @ ApiError::Blocked) => return Err(e),
            Err(e) => {
                let bad_cert = match e {
                    ApiError::BadCert(kind) => Some(kind),
                    _ => None,
                };
                match self.follow(&self.lenient, http, MAX_REDIRECTS).await {
                    Ok(p) if p.url.scheme() == "http" => (p, None),
                    // Berakhir di https: hanya sah bila alasan sertifikat ditolak sudah diketahui;
                    // bila https tadi gagal karena hal lain (timeout), laporkan error aslinya.
                    Ok(p) => match bad_cert {
                        Some(kind) => (p, Some(kind)),
                        None => return Err(e),
                    },
                    Err(ApiError::Blocked) => return Err(ApiError::Blocked),
                    Err(_) if bad_cert.is_some() => return Err(ApiError::Unreachable),
                    Err(_) => return Err(e),
                }
            }
        };
        let final_https = page.url.scheme() == "https";
        let tls = final_https.then(|| Tls {
            version: page.tls_version,
            valid: tls_error.is_none(),
            error: tls_error,
            cert: page.cert_der.as_deref().and_then(parse_cert),
        });

        // Tambahan saja: dibatasi singkat supaya tidak menghabiskan waktu seluruh pengecekan.
        let security_txt = match page.url.join("/.well-known/security.txt") {
            Ok(u) => tokio::time::timeout(Duration::from_secs(5), self.security_txt(u))
                .await
                .unwrap_or(false),
            Err(_) => false,
        };

        let (html, html_truncated) = page.html;
        Ok(ScanResult {
            host: host.to_owned(),
            final_url: page.url.to_string(),
            status: page.status,
            ip: page.ip,
            redirects: page.hops,
            http_to_https,
            tls,
            headers: header_list(&page.headers),
            cookies: page
                .headers
                .get_all(SET_COOKIE)
                .iter()
                .filter_map(|v| v.to_str().ok())
                .filter_map(parse_cookie)
                .collect(),
            html,
            html_truncated,
            security_txt,
            dns,
        })
    }

    /// Buka https; bila sertifikat ditolak, ulangi tanpa verifikasi dan catat alasannya.
    async fn open_https(&self, url: Url) -> ApiResult<(Page, Option<&'static str>)> {
        match self.follow(&self.strict, url.clone(), MAX_REDIRECTS).await {
            Ok(p) => Ok((p, None)),
            Err(ApiError::BadCert(kind)) => {
                let p = self.follow(&self.lenient, url, MAX_REDIRECTS).await?;
                Ok((p, Some(kind)))
            }
            Err(e) => Err(e),
        }
    }

    /// GET dengan redirect diikuti manual (rantai dicatat, setiap tujuan diperiksa).
    async fn follow(&self, client: &reqwest::Client, start: Url, max: usize) -> ApiResult<Page> {
        let mut url = start;
        let mut hops = Vec::new();
        loop {
            check_url(&url)?;
            let mut resp = client
                .get(url.clone())
                .header("accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
                .header("accept-language", "id,en;q=0.8")
                .send()
                .await
                .map_err(classify)?;
            let status = resp.status().as_u16();
            if resp.status().is_redirection()
                && let Some(next) = resp
                    .headers()
                    .get(LOCATION)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|l| url.join(l).ok())
            {
                hops.push(Hop {
                    url: url.to_string(),
                    status,
                });
                if hops.len() > max {
                    return Err(ApiError::Unreachable);
                }
                url = next;
                continue;
            }
            let tls = resp.extensions().get::<TlsInfo>().cloned();
            let headers = resp.headers().clone();
            let ip = resp.remote_addr().map(|a| a.ip().to_string());
            // Hanya teks (HTML atau security.txt) yang dibaca; file biner dilewati.
            let is_text = headers
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .is_none_or(|t| t.contains("html") || t.starts_with("text/"));
            let mut body = Vec::new();
            let mut truncated = false;
            if is_text {
                while let Ok(Some(chunk)) = resp.chunk().await {
                    body.extend_from_slice(&chunk);
                    if body.len() >= MAX_HTML {
                        body.truncate(MAX_HTML);
                        truncated = true;
                        break;
                    }
                }
            }
            return Ok(Page {
                url,
                status,
                ip,
                hops,
                headers,
                tls_version: tls.as_ref().and_then(|t| t.version()).map(version_name),
                cert_der: tls.and_then(|t| t.peer_certificate().map(<[u8]>::to_vec)),
                html: (String::from_utf8_lossy(&body).into_owned(), truncated),
            });
        }
    }

    async fn security_txt(&self, url: Url) -> bool {
        let Ok(p) = self.follow(&self.strict, url, 2).await else {
            return false;
        };
        // Banyak situs menjawab 200 dengan halaman HTML biasa untuk alamat apa pun.
        p.status == 200 && is_security_txt(&p.html.0)
    }

    /// Apakah http://host/ dialihkan ke https (paling banyak 3 langkah). `None` bila http mati.
    async fn http_to_https(&self, start: Url) -> Option<bool> {
        let mut url = start;
        for _ in 0..3 {
            check_url(&url).ok()?;
            let resp = self.strict.get(url.clone()).send().await.ok()?;
            if !resp.status().is_redirection() {
                return Some(false);
            }
            let next = resp
                .headers()
                .get(LOCATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|l| url.join(l).ok())?;
            if next.scheme() == "https" {
                return Some(true);
            }
            url = next;
        }
        Some(false)
    }

    async fn dns(&self, apex: &str, host: &str) -> Dns {
        let dmarc_name = format!("_dmarc.{apex}");
        let (txt, dmarc, caa) = tokio::join!(
            self.doh_query(apex, "TXT"),
            self.doh_query(&dmarc_name, "TXT"),
            self.caa(host),
        );
        let ok = txt.is_some() && dmarc.is_some();
        let pick = |records: Option<Vec<String>>, prefix: &str| {
            records?
                .into_iter()
                .map(|r| txt_value(&r))
                .find(|t| t.to_ascii_lowercase().starts_with(prefix))
        };
        Dns {
            ok,
            spf: pick(txt, "v=spf1"),
            dmarc: pick(dmarc, "v=dmarc1"),
            caa,
        }
    }

    /// CAA berlaku dari nama yang paling dekat ke atas (www.contoh.co.id -> contoh.co.id).
    async fn caa(&self, host: &str) -> Vec<String> {
        let labels: Vec<&str> = host.split('.').collect();
        for start in 0..labels.len().saturating_sub(1).min(3) {
            let name = labels[start..].join(".");
            if let Some(records) = self.doh_query(&name, "CAA").await
                && !records.is_empty()
            {
                return records.iter().filter_map(|r| caa_value(r)).collect();
            }
        }
        Vec::new()
    }

    /// Jawaban DNS (kolom `data`) dengan tipe yang diminta; `None` bila DoH gagal.
    async fn doh_query(&self, name: &str, kind: &str) -> Option<Vec<String>> {
        let resp = self
            .doh
            .get(Url::parse_with_params(&self.doh_url, [("name", name), ("type", kind)]).ok()?)
            .header("accept", "application/dns-json")
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let json: Value = resp.json().await.ok()?;
        let code = match kind {
            "TXT" => 16,
            "CAA" => 257,
            _ => return None,
        };
        Some(
            json["Answer"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter(|r| r["type"].as_u64() == Some(code))
                        .filter_map(|r| r["data"].as_str().map(str::to_owned))
                        .collect()
                })
                .unwrap_or_default(),
        )
    }
}

struct Page {
    url: Url,
    status: u16,
    ip: Option<String>,
    hops: Vec<Hop>,
    headers: HeaderMap,
    tls_version: Option<&'static str>,
    cert_der: Option<Vec<u8>>,
    html: (String, bool),
}

/// Hanya http/https, port standar, dan host berupa nama domain (bukan IP langsung).
fn check_url(url: &Url) -> ApiResult<()> {
    let scheme_ok = matches!(url.scheme(), "http" | "https");
    let port_ok = url.port().is_none();
    // host_str memberi IPv6 dalam kurung siku dan IPv4 apa adanya; keduanya ditolak normalize.
    let host_ok = url.host_str().and_then(normalize).is_some();
    if scheme_ok && port_ok && host_ok && url.username().is_empty() && url.password().is_none() {
        Ok(())
    } else {
        Err(ApiError::Blocked)
    }
}

/// Kelompokkan error reqwest: alamat diblokir, sertifikat ditolak, timeout, atau tidak terjangkau.
fn classify(e: reqwest::Error) -> ApiError {
    let mut chain = String::new();
    let mut src: Option<&dyn std::error::Error> = Some(&e);
    while let Some(err) = src {
        if err.downcast_ref::<Blocked>().is_some() {
            return ApiError::Blocked;
        }
        chain.push_str(&err.to_string().to_ascii_lowercase());
        chain.push(' ');
        src = err.source();
    }
    if e.is_timeout() {
        return ApiError::Timeout;
    }
    if chain.contains("certificate") || chain.contains("unknownissuer") {
        return ApiError::BadCert(cert_error_kind(&chain));
    }
    ApiError::Unreachable
}

fn cert_error_kind(msg: &str) -> &'static str {
    if msg.contains("expired") || msg.contains("notvalidyet") || msg.contains("not valid yet") {
        "expired"
    } else if msg.contains("notvalidforname") || msg.contains("not valid for name") {
        "name"
    } else if msg.contains("unknownissuer") || msg.contains("unknown issuer") {
        "issuer"
    } else {
        "other"
    }
}

fn version_name(v: Version) -> &'static str {
    match v {
        Version::TLS_1_3 => "TLS 1.3",
        Version::TLS_1_2 => "TLS 1.2",
        Version::TLS_1_1 => "TLS 1.1",
        Version::TLS_1_0 => "TLS 1.0",
        _ => "?",
    }
}

/// Alamat yang boleh dihubungi: hanya unicast publik. Jaringan lokal, loopback, link-local,
/// CGNAT, dokumentasi, multicast, dan alamat IPv6 yang membungkus IPv4 ditolak.
pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v) => {
            let [a, b, c, _] = v.octets();
            !(v.is_private()
                || v.is_loopback()
                || v.is_link_local()
                || v.is_broadcast()
                || v.is_documentation()
                || v.is_unspecified()
                || v.is_multicast()
                || a == 0
                || a >= 240
                || (a == 100 && (b & 0xc0) == 64)
                || (a == 192 && b == 0 && c == 0)
                || (a == 198 && (b & 0xfe) == 18))
        }
        IpAddr::V6(v) => {
            if let Some(v4) = v.to_ipv4_mapped() {
                return is_public(IpAddr::V4(v4));
            }
            let s = v.segments();
            // Hanya 2000::/3 (unicast global), minus dokumentasi, Teredo, 6to4, dan NAT64.
            (s[0] & 0xe000) == 0x2000
                && !(s[0] == 0x2001 && (s[1] == 0x0db8 || s[1] == 0))
                && s[0] != 0x2002
                && !(s[0] == 0x0064 && s[1] == 0xff9b)
        }
    }
}

/// Rapikan input jadi nama host ASCII huruf kecil. IP, localhost, dan nama tanpa titik ditolak.
pub fn normalize(input: &str) -> Option<String> {
    let h = input.trim().trim_end_matches('.').to_ascii_lowercase();
    if h.len() > 253 || !h.contains('.') || h.parse::<IpAddr>().is_ok() {
        return None;
    }
    let labels_ok = h.split('.').all(|l| {
        !l.is_empty()
            && l.len() <= 63
            && !l.starts_with('-')
            && !l.ends_with('-')
            && l.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    });
    let tld = h.rsplit('.').next().unwrap_or_default();
    let blocked_tld = matches!(
        tld,
        "localhost"
            | "local"
            | "internal"
            | "lan"
            | "home"
            | "test"
            | "invalid"
            | "example"
            | "arpa"
    );
    // TLD tidak pernah berupa angka saja (mencegah 127.1 dan sejenisnya).
    let tld_ok = tld.len() >= 2 && !tld.bytes().all(|b| b.is_ascii_digit());
    (labels_ok && tld_ok && !blocked_tld).then_some(h)
}

fn header_list(h: &HeaderMap) -> Vec<(String, String)> {
    h.iter()
        .filter(|(k, _)| *k != SET_COOKIE)
        .take(MAX_HEADERS)
        .map(|(k, v)| {
            let mut s = String::from_utf8_lossy(v.as_bytes()).into_owned();
            if s.len() > MAX_HEADER_VALUE {
                let mut cut = MAX_HEADER_VALUE;
                while !s.is_char_boundary(cut) {
                    cut -= 1;
                }
                s.truncate(cut);
            }
            (k.as_str().to_owned(), s)
        })
        .collect()
}

/// Ambil nama dan atribut keamanan dari satu header Set-Cookie (nilai cookie dibuang).
pub fn parse_cookie(raw: &str) -> Option<Cookie> {
    let mut parts = raw.split(';');
    let name = parts.next()?.split('=').next()?.trim();
    if name.is_empty() || name.len() > 128 {
        return None;
    }
    let mut c = Cookie {
        name: name.to_owned(),
        ..Default::default()
    };
    for attr in parts {
        let (k, v) = attr.split_once('=').unwrap_or((attr, ""));
        match k.trim().to_ascii_lowercase().as_str() {
            "secure" => c.secure = true,
            "httponly" => c.http_only = true,
            "samesite" => c.same_site = Some(v.trim().to_ascii_lowercase()),
            _ => {}
        }
    }
    Some(c)
}

/// Data TXT dari DoH berbentuk "bagian1" "bagian2"; gabungkan tanpa tanda kutip.
pub fn txt_value(data: &str) -> String {
    let d = data.trim();
    if !d.starts_with('"') {
        return d.to_owned();
    }
    d.split('"')
        .enumerate()
        .filter(|(i, _)| i % 2 == 1)
        .map(|(_, s)| s)
        .collect()
}

/// CAA bisa berbentuk teks (`0 issue "letsencrypt.org"`) atau heksadesimal RFC 3597
/// (`\# 22 00 05 69 73 73 75 65 ...`). Hasil: `issue letsencrypt.org`.
pub fn caa_value(data: &str) -> Option<String> {
    let d = data.trim();
    if let Some(hex) = d.strip_prefix("\\#") {
        let bytes: Vec<u8> = hex
            .split_whitespace()
            .skip(1)
            .flat_map(|chunk| {
                (0..chunk.len() / 2)
                    .filter_map(move |i| u8::from_str_radix(&chunk[i * 2..i * 2 + 2], 16).ok())
            })
            .collect();
        let tag_len = *bytes.get(1)? as usize;
        let tag = std::str::from_utf8(bytes.get(2..2 + tag_len)?).ok()?;
        let value = String::from_utf8_lossy(bytes.get(2 + tag_len..)?);
        return Some(format!("{tag} {value}"));
    }
    let mut it = d.splitn(3, ' ');
    let _flags = it.next()?;
    let tag = it.next()?;
    let value = it.next()?.trim_matches('"');
    Some(format!("{tag} {value}"))
}

/// Isi security.txt sungguhan (RFC 9116) memuat kolom Contact.
fn is_security_txt(body: &str) -> bool {
    let head = body.get(..body.len().min(512)).unwrap_or(body).trim_start();
    !head.starts_with('<')
        && body
            .lines()
            .any(|l| l.trim().to_ascii_lowercase().starts_with("contact:"))
}

fn parse_cert(der: &[u8]) -> Option<Cert> {
    use x509_parser::prelude::*;
    let (_, cert) = X509Certificate::from_der(der).ok()?;
    let name = |n: &X509Name| {
        n.iter_common_name()
            .next()
            .and_then(|cn| cn.as_str().ok().map(str::to_owned))
            .or_else(|| {
                n.iter_organization()
                    .next()
                    .and_then(|o| o.as_str().ok().map(str::to_owned))
            })
    };
    let issuer_org = cert
        .issuer()
        .iter_organization()
        .next()
        .and_then(|o| o.as_str().ok().map(str::to_owned));
    let issuer_cn = name(cert.issuer());
    let issuer = match (issuer_org, issuer_cn) {
        (Some(o), Some(cn)) if o != cn => Some(format!("{o} ({cn})")),
        (o, cn) => o.or(cn),
    };
    let sans = cert
        .subject_alternative_name()
        .ok()
        .flatten()
        .map(|ext| {
            ext.value
                .general_names
                .iter()
                .filter_map(|g| match g {
                    GeneralName::DNSName(d) => Some((*d).to_owned()),
                    _ => None,
                })
                .take(50)
                .collect()
        })
        .unwrap_or_default();
    Some(Cert {
        subject: name(cert.subject()),
        issuer,
        sans,
        not_before: Some(cert.validity().not_before.timestamp()),
        not_after: Some(cert.validity().not_after.timestamp()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hanya_alamat_publik() {
        for ip in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "198.18.0.1",
            "::1",
            "::",
            "fe80::1",
            "fd00::1",
            "::ffff:10.0.0.1",
            "::ffff:127.0.0.1",
            "64:ff9b::a00:1",
            "2001:db8::1",
            "2002:a00:1::1",
        ] {
            assert!(!is_public(ip.parse().unwrap()), "{ip} harus ditolak");
        }
        for ip in ["8.8.8.8", "104.16.1.1", "2606:4700::1111", "::ffff:1.1.1.1"] {
            assert!(is_public(ip.parse().unwrap()), "{ip} harus diterima");
        }
    }

    #[test]
    fn normalisasi_host() {
        assert_eq!(
            normalize(" WWW.Contoh.co.ID. ").as_deref(),
            Some("www.contoh.co.id")
        );
        for bad in [
            "localhost",
            "contoh",
            "127.0.0.1",
            "127.1",
            "::1",
            "api.internal",
            "printer.local",
            "a..b.com",
            "-a.com",
            "contoh.com:8080",
            "user@contoh.com",
            "contoh.com/x",
        ] {
            assert!(normalize(bad).is_none(), "{bad} harus ditolak");
        }
    }

    #[test]
    fn url_tujuan_redirect_diperiksa() {
        let ok = |u: &str| check_url(&Url::parse(u).unwrap()).is_ok();
        assert!(ok("https://contoh.com/halaman?a=1"));
        assert!(ok("http://www.contoh.com/"));
        assert!(!ok("http://127.0.0.1/"));
        assert!(!ok("http://[::1]/"));
        assert!(!ok("http://contoh.com:8080/"));
        assert!(!ok("ftp://contoh.com/"));
        assert!(!ok("http://metadata.internal/"));
        assert!(!ok("http://user:pw@contoh.com/"));
    }

    #[test]
    fn cookie_tanpa_nilai() {
        let c = parse_cookie("sesi=RAHASIA; Path=/; Secure; HttpOnly; SameSite=Lax").unwrap();
        assert_eq!(
            c,
            Cookie {
                name: "sesi".into(),
                secure: true,
                http_only: true,
                same_site: Some("lax".into()),
            }
        );
        assert!(!format!("{c:?}").contains("RAHASIA"));
        assert!(!parse_cookie("_ga=1").unwrap().secure);
    }

    #[test]
    fn txt_dan_caa() {
        assert_eq!(
            txt_value(r#""v=spf1 include:_spf.google.com " "~all""#),
            "v=spf1 include:_spf.google.com ~all"
        );
        assert_eq!(
            caa_value(r#"0 issue "letsencrypt.org""#).as_deref(),
            Some("issue letsencrypt.org")
        );
        // 0, panjang tag 5, "issue", "pki.goog"
        assert_eq!(
            caa_value(r"\# 15 00 05 69 73 73 75 65 70 6b 69 2e 67 6f 6f 67").as_deref(),
            Some("issue pki.goog")
        );
    }

    #[test]
    fn security_txt_bukan_halaman_html() {
        assert!(is_security_txt(
            "Contact: mailto:security@contoh.com\nExpires: 2030-01-01T00:00:00Z"
        ));
        assert!(!is_security_txt("<!doctype html><p>Contact: kami</p>"));
    }

    #[test]
    fn jenis_error_sertifikat() {
        assert_eq!(
            cert_error_kind("invalid peer certificate: expired"),
            "expired"
        );
        assert_eq!(
            cert_error_kind("invalid peer certificate: notvalidforname"),
            "name"
        );
        assert_eq!(
            cert_error_kind("invalid peer certificate: unknownissuer"),
            "issuer"
        );
    }
}
