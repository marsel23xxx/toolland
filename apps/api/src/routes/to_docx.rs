//! POST /api/tools/v1/odt-to-docx : dokumen ODT ke DOCX (maks 15 MB).
//! POST /api/tools/v1/pdf-to-docx : PDF ke DOCX yang bisa diedit (maks 15 MB).

use std::time::Instant;

use axum::{
    body::Body,
    extract::{Multipart, State},
    http::header,
    response::{IntoResponse, Response},
};

use crate::{
    error::{ApiError, ApiResult},
    services::converter::{self, Source},
    state::AppState,
    upload,
};

const DOCX: &str = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

pub async fn odt(State(state): State<AppState>, multipart: Multipart) -> Response {
    handle(&state, multipart, Source::Odt, "odt_to_docx").await
}

pub async fn pdf(State(state): State<AppState>, multipart: Multipart) -> Response {
    handle(&state, multipart, Source::Pdf, "pdf_to_docx").await
}

async fn handle(
    state: &AppState,
    multipart: Multipart,
    src: Source,
    tool: &'static str,
) -> Response {
    let started = Instant::now();
    let resp = run(state, multipart, src)
        .await
        .unwrap_or_else(IntoResponse::into_response);
    super::record(tool, resp.status().as_u16(), started);
    resp
}

async fn run(state: &AppState, multipart: Multipart, src: Source) -> ApiResult<Response> {
    let detect = match src {
        Source::Odt => upload::odt_ext,
        Source::Pdf => upload::pdf_ext,
    };
    let up = upload::receive(multipart, &state.cfg.tmp_dir, state.cfg.max_upload, detect).await?;

    let _permit = state.permit(&state.docx).await?;
    let resp = converter::to_docx(state, up.file.path(), src).await?;
    // Konversi selesai: file input dihapus sekarang, hasil di-stream langsung.
    drop(up);

    let mut builder = Response::builder()
        .header(header::CONTENT_TYPE, DOCX)
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"dokumen.docx\"",
        )
        .header(header::CACHE_CONTROL, "no-store");
    if let Some(len) = resp.content_length() {
        builder = builder.header(header::CONTENT_LENGTH, len);
    }
    builder
        .body(Body::from_stream(resp.bytes_stream()))
        .map_err(|e| ApiError::Internal(e.into()))
}
