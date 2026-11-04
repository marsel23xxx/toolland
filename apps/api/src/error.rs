//! Error API: kode singkat yang diterjemahkan di frontend, tanpa detail file pengguna.

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("file terlalu besar")]
    TooLarge,
    #[error("tipe file tidak didukung")]
    Unsupported,
    #[error("permintaan tidak valid: {0}")]
    BadRequest(&'static str),
    #[error("server sibuk")]
    Busy,
    #[error("waktu proses habis")]
    Timeout,
    #[error("gagal memproses")]
    Failed,
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

#[derive(Serialize)]
struct Body {
    error: &'static str,
}

impl ApiError {
    fn parts(&self) -> (StatusCode, &'static str) {
        match self {
            Self::TooLarge => (StatusCode::PAYLOAD_TOO_LARGE, "too_large"),
            Self::Unsupported => (StatusCode::UNSUPPORTED_MEDIA_TYPE, "unsupported"),
            Self::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            Self::Busy => (StatusCode::SERVICE_UNAVAILABLE, "busy"),
            Self::Timeout => (StatusCode::GATEWAY_TIMEOUT, "timeout"),
            Self::Failed => (StatusCode::UNPROCESSABLE_ENTITY, "failed"),
            Self::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = self.parts();
        if status.is_server_error() {
            tracing::error!(error = %self, code, "request gagal");
        }
        (status, Json(Body { error: code })).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
