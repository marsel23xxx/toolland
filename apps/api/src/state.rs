use std::sync::Arc;

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use crate::{
    config::Config,
    error::{ApiError, ApiResult},
    services::rdap::Rdap,
};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub http: reqwest::Client,
    /// Batas konversi Office paralel (PRD: 2).
    pub office: Arc<Semaphore>,
    /// Batas Ghostscript paralel (PRD: 2).
    pub gs: Arc<Semaphore>,
    /// Batas konversi ke DOCX paralel.
    pub docx: Arc<Semaphore>,
    /// Pencarian WHOIS (RDAP) dengan cache di memori.
    pub rdap: Arc<Rdap>,
}

impl AppState {
    pub fn new(cfg: Config) -> anyhow::Result<Self> {
        Ok(Self {
            http: reqwest::Client::builder()
                .timeout(cfg.process_timeout + std::time::Duration::from_secs(5))
                .build()?,
            office: Arc::new(Semaphore::new(cfg.office_concurrency)),
            gs: Arc::new(Semaphore::new(cfg.gs_concurrency)),
            docx: Arc::new(Semaphore::new(cfg.docx_concurrency)),
            rdap: Arc::new(Rdap::new(cfg.rdap_bootstrap_url.clone())?),
            cfg: Arc::new(cfg),
        })
    }

    /// Ambil izin antrean; bila terlalu lama menunggu, jawab "server sibuk".
    pub async fn permit(&self, sem: &Arc<Semaphore>) -> ApiResult<OwnedSemaphorePermit> {
        tokio::time::timeout(self.cfg.queue_timeout, sem.clone().acquire_owned())
            .await
            .map_err(|_| ApiError::Busy)?
            .map_err(|_| ApiError::Busy)
    }
}
