//! ODT/PDF ke DOCX lewat service converter (LibreOffice Writer + pdf2docx) di jaringan internal.
//! File dikirim dan hasil diterima secara streaming, tanpa ditampung utuh di memori.

use std::path::Path;

use tokio_util::io::ReaderStream;

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Clone, Copy, Debug)]
pub enum Source {
    Odt,
    Pdf,
}

impl Source {
    fn path(self) -> &'static str {
        match self {
            Self::Odt => "/odt-to-docx",
            Self::Pdf => "/pdf-to-docx",
        }
    }
}

pub async fn to_docx(state: &AppState, input: &Path, src: Source) -> ApiResult<reqwest::Response> {
    let file = tokio::fs::File::open(input)
        .await
        .map_err(anyhow::Error::from)?;
    let len = file.metadata().await.map_err(anyhow::Error::from)?.len();

    let resp = state
        .http
        .post(format!("{}{}", state.cfg.converter_url, src.path()))
        .header(reqwest::header::CONTENT_LENGTH, len)
        .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
        .body(reqwest::Body::wrap_stream(ReaderStream::new(file)))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                ApiError::Timeout
            } else {
                ApiError::Internal(anyhow::anyhow!("converter tidak bisa dihubungi: {e}"))
            }
        })?;

    match resp.status().as_u16() {
        200 => Ok(resp),
        503 => Err(ApiError::Busy),
        504 => Err(ApiError::Timeout),
        413 => Err(ApiError::TooLarge),
        422 => {
            // Bedakan PDF hasil scan (tanpa teks) dari file yang memang rusak.
            let body = resp.text().await.unwrap_or_default();
            Err(if body.contains("\"no_text\"") {
                ApiError::NoText
            } else {
                ApiError::Failed
            })
        }
        _ => Err(ApiError::Failed),
    }
}
