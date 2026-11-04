//! POST /api/tools/v1/pdf/compress : kompres PDF dengan Ghostscript, level low/medium/high (maks 15 MB).

use std::time::Instant;

use axum::{
    body::Body,
    extract::{Multipart, State},
    http::header,
    response::{IntoResponse, Response},
};
use tokio_util::io::ReaderStream;

use crate::{
    error::{ApiError, ApiResult},
    services::ghostscript::{self, Level},
    state::AppState,
    temp::TempFile,
    upload,
};

pub async fn handler(State(state): State<AppState>, multipart: Multipart) -> Response {
    let started = Instant::now();
    let res = run(&state, multipart).await;
    let resp = res.unwrap_or_else(IntoResponse::into_response);
    super::record("pdf_compress", resp.status().as_u16(), started);
    resp
}

async fn run(state: &AppState, multipart: Multipart) -> ApiResult<Response> {
    let up = upload::receive(
        multipart,
        &state.cfg.tmp_dir,
        state.cfg.max_upload,
        upload::pdf_ext,
    )
    .await?;
    let level = match up.fields.iter().find(|(k, _)| k == "level") {
        Some((_, v)) => Level::parse(v).ok_or(ApiError::BadRequest("level"))?,
        None => Level::Medium,
    };

    let out = TempFile::new(&state.cfg.tmp_dir, "pdf");
    {
        let _permit = state.permit(&state.gs).await?;
        ghostscript::compress(state, up.file.path(), out.path(), level).await?;
    }

    // Bila hasil tidak lebih kecil, kirim file asli (ukuran tidak pernah bertambah).
    let out_len = tokio::fs::metadata(out.path())
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    let unchanged = out_len == 0 || out_len >= up.size;
    let send = if unchanged {
        up.file.path()
    } else {
        out.path()
    };
    let file = tokio::fs::File::open(send)
        .await
        .map_err(anyhow::Error::from)?;
    let len = file.metadata().await.map_err(anyhow::Error::from)?.len();

    // Nama file dihapus dari tmpfs sekarang; isinya tetap terbaca lewat file yang sudah dibuka
    // sampai pengiriman selesai, lalu hilang dari RAM.
    drop(up);
    drop(out);

    Response::builder()
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(header::CONTENT_LENGTH, len)
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"dokumen.pdf\"",
        )
        .header(header::CACHE_CONTROL, "no-store")
        .header("x-toolland-unchanged", if unchanged { "1" } else { "0" })
        .body(Body::from_stream(ReaderStream::new(file)))
        .map_err(|e| ApiError::Internal(e.into()))
}
