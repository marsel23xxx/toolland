//! Toolland API: service stateless untuk proses yang tidak bisa di browser.
//! Fase 0 hanya berisi health check; endpoint Office/PDF menyusul di Fase 3.

use std::{env, net::SocketAddr, time::Duration};

use anyhow::Context;
use axum::{Router, routing::get};
use tokio::net::TcpListener;
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

mod routes;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

const DEFAULT_ADDR: &str = "0.0.0.0:8082";

/// Semua route API di bawah /api/tools/v1.
pub fn app() -> Router {
    let v1 = Router::new().route("/health", get(routes::health::health));

    Router::new()
        .nest("/api/tools/v1", v1)
        // Log hanya metode, path, status, durasi; tanpa isi file atau IP.
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(90),
        ))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let addr: SocketAddr = env::var("TOOLLAND_API_ADDR")
        .unwrap_or_else(|_| DEFAULT_ADDR.to_owned())
        .parse()
        .context("TOOLLAND_API_ADDR tidak valid")?;

    // Image distroless tidak punya curl/shell, jadi healthcheck Docker memakai binary ini sendiri.
    if env::args().nth(1).as_deref() == Some("healthcheck") {
        return routes::health::probe(addr.port()).await;
    }

    tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("gagal bind ke {addr}"))?;
    tracing::info!(%addr, "toolland-api berjalan");

    axum::serve(listener, app())
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
