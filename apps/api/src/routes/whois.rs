//! POST /api/tools/v1/whois {"domain": "contoh.co.id"} : data pendaftaran domain lewat RDAP.
//! POST (bukan GET) supaya nama domain tidak masuk log akses atau cache CDN.

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
    services::rdap,
    state::AppState,
};

#[derive(Deserialize)]
pub struct Query {
    domain: String,
}

pub async fn handler(
    State(state): State<AppState>,
    body: Result<Json<Query>, JsonRejection>,
) -> Response {
    let started = Instant::now();
    let resp = run(&state, body)
        .await
        .unwrap_or_else(IntoResponse::into_response);
    super::record("whois", resp.status().as_u16(), started);
    resp
}

async fn run(state: &AppState, body: Result<Json<Query>, JsonRejection>) -> ApiResult<Response> {
    let Json(q) = body.map_err(|_| ApiError::BadRequest("body"))?;
    let domain = rdap::normalize(&q.domain).ok_or(ApiError::BadRequest("domain"))?;
    // Domain belum terdaftar adalah jawaban normal (bisa dibeli), bukan error.
    let body = match state.rdap.lookup(&domain).await {
        Ok(info) => {
            let mut v = serde_json::to_value(&*info).map_err(anyhow::Error::from)?;
            v["found"] = true.into();
            v
        }
        Err(ApiError::NotFound) => serde_json::json!({ "found": false, "domain": domain }),
        Err(e) => return Err(e),
    };
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(body)).into_response())
}
