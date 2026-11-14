//! Konfigurasi dari environment variable (satu sumber per environment).

use std::{env, net::SocketAddr, path::PathBuf, time::Duration};

use anyhow::Context;

/// STUN publik bawaan: hanya membantu peserta mengetahui alamat publiknya sendiri,
/// tidak meneruskan video.
const DEFAULT_ICE: &str =
    r#"[{"urls":["stun:stun.cloudflare.com:3478","stun:stun.l.google.com:19302"]}]"#;

#[derive(Clone, Debug)]
pub struct Config {
    pub addr: SocketAddr,
    /// URL Gotenberg di jaringan Docker internal.
    pub gotenberg_url: String,
    /// URL konverter DOCX (LibreOffice Writer + pdf2docx) di jaringan Docker internal.
    pub converter_url: String,
    /// Folder tmpfs (RAM) untuk file sementara.
    pub tmp_dir: PathBuf,
    /// Program Ghostscript.
    pub gs_bin: String,
    /// Batas ukuran file per request (PRD: 15 MB).
    pub max_upload: usize,
    pub office_concurrency: usize,
    pub gs_concurrency: usize,
    pub docx_concurrency: usize,
    /// Batas waktu proses (PRD: 60 detik).
    pub process_timeout: Duration,
    /// Lama menunggu antrean sebelum menjawab "server sibuk".
    pub queue_timeout: Duration,
    /// Batas request berat per IP per menit.
    pub rate_per_minute: u32,
    /// Batas cek WHOIS per IP per menit (terpisah dari tool berat).
    pub lookup_rate_per_minute: u32,
    /// Batas Cek Website per IP per menit (tiap cek membuka beberapa alamat di situs tujuan).
    pub scan_rate_per_minute: u32,
    /// Cek Website yang berjalan bersamaan.
    pub scan_concurrency: usize,
    /// DNS-over-HTTPS (format JSON) untuk catatan SPF, DMARC, dan CAA.
    pub doh_url: String,
    /// Daftar server RDAP per TLD dari IANA.
    pub rdap_bootstrap_url: String,
    /// Port Prometheus metrics (hanya jaringan internal), 0 = mati.
    pub metrics_port: u16,
    /// Rapat Video: koneksi signaling baru per IP per menit.
    pub meet_rate_per_minute: u32,
    /// Rapat Video: room aktif maksimal di seluruh server.
    pub meet_max_rooms: usize,
    /// Rapat Video: koneksi bersamaan maksimal per IP.
    pub meet_per_ip: usize,
    /// Server ICE untuk WebRTC dalam JSON (STUN; TURN menyusul setelah hardening server).
    pub ice_servers: serde_json::Value,
    /// Origin tambahan yang boleh membuka signaling (selain origin yang sama dengan Host).
    pub meet_origins: Vec<String>,
}

fn var<T: std::str::FromStr>(name: &str, default: T) -> anyhow::Result<T>
where
    T::Err: std::fmt::Display,
{
    match env::var(name) {
        Ok(v) => v
            .parse()
            .map_err(|e| anyhow::anyhow!("{name} tidak valid: {e}")),
        Err(_) => Ok(default),
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            addr: env::var("TOOLLAND_API_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:8082".into())
                .parse()
                .context("TOOLLAND_API_ADDR tidak valid")?,
            gotenberg_url: env::var("GOTENBERG_URL")
                .unwrap_or_else(|_| "http://gotenberg:3000".into()),
            converter_url: env::var("CONVERTER_URL")
                .unwrap_or_else(|_| "http://converter:8000".into()),
            tmp_dir: env::var("TOOLLAND_TMP")
                .unwrap_or_else(|_| "/run/tools".into())
                .into(),
            gs_bin: env::var("GS_BIN").unwrap_or_else(|_| "gs".into()),
            max_upload: var("TOOLLAND_MAX_UPLOAD", 15 * 1024 * 1024)?,
            office_concurrency: var("TOOLLAND_OFFICE_CONCURRENCY", 2)?,
            gs_concurrency: var("TOOLLAND_GS_CONCURRENCY", 2)?,
            docx_concurrency: var("TOOLLAND_DOCX_CONCURRENCY", 2)?,
            process_timeout: Duration::from_secs(var("TOOLLAND_PROCESS_TIMEOUT_SECS", 60)?),
            queue_timeout: Duration::from_secs(var("TOOLLAND_QUEUE_TIMEOUT_SECS", 20)?),
            rate_per_minute: var("TOOLLAND_RATE_PER_MINUTE", 20)?,
            lookup_rate_per_minute: var("TOOLLAND_LOOKUP_RATE_PER_MINUTE", 15)?,
            scan_rate_per_minute: var("TOOLLAND_SCAN_RATE_PER_MINUTE", 6)?,
            scan_concurrency: var("TOOLLAND_SCAN_CONCURRENCY", 6)?,
            doh_url: env::var("DOH_URL")
                .unwrap_or_else(|_| "https://cloudflare-dns.com/dns-query".into()),
            rdap_bootstrap_url: env::var("RDAP_BOOTSTRAP_URL")
                .unwrap_or_else(|_| "https://data.iana.org/rdap/dns.json".into()),
            metrics_port: var("TOOLLAND_METRICS_PORT", 9091)?,
            meet_rate_per_minute: var("TOOLLAND_MEET_RATE_PER_MINUTE", 30)?,
            meet_max_rooms: var("TOOLLAND_MEET_MAX_ROOMS", 200)?,
            meet_per_ip: var("TOOLLAND_MEET_PER_IP", 8)?,
            ice_servers: serde_json::from_str(
                &env::var("TOOLLAND_ICE_SERVERS").unwrap_or_else(|_| DEFAULT_ICE.into()),
            )
            .context("TOOLLAND_ICE_SERVERS harus JSON")?,
            meet_origins: env::var("TOOLLAND_MEET_ORIGINS")
                .unwrap_or_default()
                .split(',')
                .map(|s| s.trim().trim_end_matches('/').to_owned())
                .filter(|s| !s.is_empty())
                .collect(),
        })
    }
}
