//! IP pengguna untuk rate limit.
//!
//! Hanya X-Real-IP yang dipercaya: Nginx host selalu menimpanya dengan IP asli dari
//! CF-Connecting-IP (setelah memastikan koneksi datang dari Cloudflare). Header lain seperti
//! X-Forwarded-For dan Forwarded bisa diisi sendiri oleh pengguna dan diteruskan Cloudflare,
//! jadi tidak dipakai; kalau dipakai, penyerang bisa mengganti "IP" tiap request dan lolos
//! dari rate limit. Tanpa X-Real-IP (pemanggilan langsung dari dalam VPS), IP koneksi yang dipakai.

use std::net::{IpAddr, SocketAddr};

use axum::{extract::ConnectInfo, http::Request};
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

#[derive(Clone, Copy, Debug)]
pub struct RealIp;

impl KeyExtractor for RealIp {
    type Key = IpAddr;

    fn extract<T>(&self, req: &Request<T>) -> Result<Self::Key, GovernorError> {
        req.headers()
            .get("x-real-ip")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.trim().parse::<IpAddr>().ok())
            .or_else(|| {
                req.extensions()
                    .get::<ConnectInfo<SocketAddr>>()
                    .map(|c| c.0.ip())
            })
            .ok_or(GovernorError::UnableToExtractKey)
    }
}
