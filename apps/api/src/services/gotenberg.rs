//! Word/Excel/PowerPoint ke PDF lewat Gotenberg (LibreOffice) di jaringan Docker internal.
//! File dikirim dan hasil diterima secara streaming, tanpa ditampung utuh di memori.

use std::path::Path;

use tokio_util::io::ReaderStream;

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

pub async fn convert(state: &AppState, input: &Path, ext: &str) -> ApiResult<reqwest::Response> {
    let file = tokio::fs::File::open(input)
        .await
        .map_err(anyhow::Error::from)?;
    let len = file.metadata().await.map_err(anyhow::Error::from)?.len();
    let part = reqwest::multipart::Part::stream_with_length(
        reqwest::Body::wrap_stream(ReaderStream::new(file)),
        len,
    )
    // LibreOffice memakai ekstensi untuk memilih filter impor; nama asli tidak dikirim.
    .file_name(format!("dokumen.{ext}"))
    .mime_str("application/octet-stream")
    .map_err(anyhow::Error::from)?;

    let resp = state
        .http
        .post(format!(
            "{}/forms/libreoffice/convert",
            state.cfg.gotenberg_url
        ))
        .multipart(reqwest::multipart::Form::new().part("files", part))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                ApiError::Timeout
            } else {
                ApiError::Internal(anyhow::anyhow!("gotenberg tidak bisa dihubungi: {e}"))
            }
        })?;

    match resp.status().as_u16() {
        200 => Ok(resp),
        429 | 503 => Err(ApiError::Busy),
        504 => Err(ApiError::Timeout),
        // 400: dokumen rusak atau tidak bisa dibaca LibreOffice
        _ => Err(ApiError::Failed),
    }
}
