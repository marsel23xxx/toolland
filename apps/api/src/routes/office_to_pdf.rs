//! POST /api/tools/v1/office-to-pdf : Word/Excel/PowerPoint ke PDF (maks 15 MB).

use std::time::Instant;

use axum::{
    body::Body,
    extract::{Multipart, State},
    http::header,
    response::{IntoResponse, Response},
};

use crate::{
    error::{ApiError, ApiResult},
    services::gotenberg,
    state::AppState,
    upload,
};

pub async fn handler(State(state): State<AppState>, multipart: Multipart) -> Response {
    let started = Instant::now();
    let res = run(&state, multipart).await;
    let resp = res.unwrap_or_else(IntoResponse::into_response);
    super::record("office_to_pdf", resp.status().as_u16(), started);
    resp
}

async fn run(state: &AppState, multipart: Multipart) -> ApiResult<Response> {
    // Hanya dokumen kantor (doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, rtf).
    let up = upload::receive(
        multipart,
        &state.cfg.tmp_dir,
        state.cfg.max_upload,
        upload::office_ext,
    )
    .await?;

    let _permit = state.permit(&state.office).await?;
    let resp = gotenberg::convert(state, up.file.path(), up.ext).await?;
    // Gotenberg sudah selesai mengonversi: file input dihapus sekarang, hasil di-stream langsung.
    drop(up);

    let mut builder = Response::builder()
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"dokumen.pdf\"",
        )
        .header(header::CACHE_CONTROL, "no-store");
    if let Some(len) = resp.content_length() {
        builder = builder.header(header::CONTENT_LENGTH, len);
    }
    builder
        .body(Body::from_stream(resp.bytes_stream()))
        .map_err(|e| ApiError::Internal(e.into()))
}
