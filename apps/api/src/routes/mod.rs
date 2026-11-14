pub mod health;
pub mod meet;
pub mod office_to_pdf;
pub mod pdf_compress;
pub mod site_check;
pub mod to_docx;
pub mod whois;

use std::time::Instant;

/// Catat jumlah request dan durasi per tool untuk Prometheus.
pub fn record(tool: &'static str, status: u16, started: Instant) {
    metrics::counter!("toolland_requests_total", "tool" => tool, "status" => status.to_string())
        .increment(1);
    metrics::histogram!("toolland_request_seconds", "tool" => tool)
        .record(started.elapsed().as_secs_f64());
}
