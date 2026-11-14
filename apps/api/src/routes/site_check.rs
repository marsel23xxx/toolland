//! POST /api/tools/v1/site-check {"host": "contoh.co.id"} : fakta keamanan dan teknologi situs.
//! POST supaya nama situs tidak masuk log akses atau cache CDN. Hanya halaman depan yang dibuka.

use std::time::Instant;

use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::header,
    response::{IntoResponse, Response},
};
use serde::Deserialize;

use crate::{
    error::{ApiError, ApiResult},
    services::site_scan,
    state::AppState,
};

#[derive(Deserialize)]
pub struct Query {
    host: String,
}

pub async fn handler(
    State(state): State<AppState>,
    body: Result<Json<Query>, JsonRejection>,
) -> Response {
    let started = Instant::now();
    let resp = run(&state, body)
        .await
        .unwrap_or_else(IntoResponse::into_response);
    super::record("site_check", resp.status().as_u16(), started);
    resp
}

async fn run(state: &AppState, body: Result<Json<Query>, JsonRejection>) -> ApiResult<Response> {
    let Json(q) = body.map_err(|_| ApiError::BadRequest("body"))?;
    let host = site_scan::normalize(&q.host).ok_or(ApiError::BadRequest("host"))?;
    let result = state.scanner.scan(&host, state.cfg.queue_timeout).await?;
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(&*result)).into_response())
}
