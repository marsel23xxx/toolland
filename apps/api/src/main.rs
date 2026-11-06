//! Toolland API: service stateless untuk proses yang tidak bisa di browser.
//! File hanya ada di tmpfs (RAM) selama diproses, lalu dihapus. Tanpa database.

use std::{net::SocketAddr, sync::Arc, time::Duration};

use anyhow::Context;
use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use tokio::net::TcpListener;
use tower_governor::{
    GovernorLayer, governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor,
};
use tower_http::{
    timeout::TimeoutLayer,
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
};
use tracing::Level;
use tracing_subscriber::EnvFilter;

mod config;
mod error;
mod routes;
mod services;
mod state;
mod temp;
mod upload;

#[cfg(test)]
mod tests;

use config::Config;
use state::AppState;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// Semua route API di bawah /api/tools/v1.
pub fn app(state: AppState) -> Router {
    let cfg = state.cfg.clone();

    // Rate limit per IP untuk endpoint berat (PRD: misalnya 20 per menit).
    // IP dibaca dari X-Real-IP / X-Forwarded-For yang diisi Nginx host dari CF-Connecting-IP.
    let governor = GovernorConfigBuilder::default()
        .period(Duration::from_secs(60) / cfg.rate_per_minute.max(1))
        .burst_size(cfg.rate_per_minute.max(1))
        .key_extractor(SmartIpKeyExtractor)
        .finish()
        .expect("konfigurasi rate limit valid");
    // Cek WHOIS ringan, tapi memanggil registry luar: batasnya terpisah dan lebih ketat.
    let lookup_governor = GovernorConfigBuilder::default()
        .period(Duration::from_secs(60) / cfg.lookup_rate_per_minute.max(1))
        .burst_size(cfg.lookup_rate_per_minute.max(1))
        .key_extractor(SmartIpKeyExtractor)
        .finish()
        .expect("konfigurasi rate limit valid");
    let limiters = [
        governor.limiter().clone(),
        lookup_governor.limiter().clone(),
    ];
    // Bersihkan catatan IP lama agar memori tidak tumbuh.
    if tokio::runtime::Handle::try_current().is_ok() {
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(60));
            loop {
                tick.tick().await;
                for l in &limiters {
                    l.retain_recent();
                }
            }
        });
    }

    let heavy = Router::new()
        .route("/office-to-pdf", post(routes::office_to_pdf::handler))
        .route("/pdf/compress", post(routes::pdf_compress::handler))
        .route("/odt-to-docx", post(routes::to_docx::odt))
        .route("/pdf-to-docx", post(routes::to_docx::pdf))
        // Batas body sedikit di atas 15 MB untuk overhead multipart; batas file pasti dicek saat upload.
        .layer(DefaultBodyLimit::max(cfg.max_upload + 64 * 1024))
        .layer(GovernorLayer::new(Arc::new(governor)));

    let lookup = Router::new()
        .route("/whois", post(routes::whois::handler))
        .layer(DefaultBodyLimit::max(1024))
        .layer(GovernorLayer::new(Arc::new(lookup_governor)));

    let v1 = Router::new()
        .route("/health", get(routes::health::health))
        .merge(heavy)
        .merge(lookup)
        .with_state(state);

    Router::new()
        .nest("/api/tools/v1", v1)
        // Log hanya metode, path, status, durasi; tanpa isi file, nama file, atau IP.
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            cfg.process_timeout + cfg.queue_timeout + Duration::from_secs(30),
        ))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = Config::from_env()?;

    // Image runtime tanpa curl, jadi healthcheck Docker memakai binary ini sendiri.
    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        return routes::health::probe(cfg.addr.port()).await;
    }

    tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    if cfg.metrics_port != 0 {
        metrics_exporter_prometheus::PrometheusBuilder::new()
            .with_http_listener(SocketAddr::from(([0, 0, 0, 0], cfg.metrics_port)))
            .install()
            .context("gagal memasang exporter Prometheus")?;
    }

    tokio::fs::create_dir_all(&cfg.tmp_dir)
        .await
        .with_context(|| {
            format!(
                "folder sementara {} tidak bisa dibuat",
                cfg.tmp_dir.display()
            )
        })?;

    let addr = cfg.addr;
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("gagal bind ke {addr}"))?;
    tracing::info!(%addr, "toolland-api berjalan");

    axum::serve(
        listener,
        app(AppState::new(cfg)?).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

/// Berhenti dengan rapi saat Ctrl+C atau SIGTERM (docker stop).
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            sig.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
    tracing::info!("menerima sinyal berhenti");
}
