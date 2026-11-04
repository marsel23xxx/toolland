//! GET /api/tools/v1/health untuk Uptime Kuma dan healthcheck Docker.

use std::time::Duration;

use anyhow::{Context, bail};
use axum::Json;
use serde::Serialize;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    time::timeout,
};

#[derive(Serialize)]
pub struct Health {
    status: &'static str,
    version: &'static str,
}

pub async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

/// Cek health ke server lokal; exit code 0 bila HTTP 200.
pub async fn probe(port: u16) -> anyhow::Result<()> {
    let request =
        "GET /api/tools/v1/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    let response = timeout(Duration::from_secs(3), async {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).await?;
        stream.write_all(request.as_bytes()).await?;
        let mut buf = Vec::new();
        stream.read_to_end(&mut buf).await?;
        anyhow::Ok(buf)
    })
    .await
    .context("healthcheck timeout")??;

    if response.starts_with(b"HTTP/1.1 200") {
        Ok(())
    } else {
        bail!("healthcheck gagal")
    }
}
