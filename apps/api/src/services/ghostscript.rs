//! Kompres PDF maksimal dengan Ghostscript (-dSAFER), sebagai proses terpisah dengan timeout.
//! Proses dihentikan otomatis bila request dibatalkan (kill_on_drop).

use std::{path::Path, process::Stdio};

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Level {
    Low,
    Medium,
    High,
}

impl Level {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "low" => Some(Self::Low),
            "medium" => Some(Self::Medium),
            "high" => Some(Self::High),
            _ => None,
        }
    }

    /// Preset Ghostscript: /printer 300 dpi, /ebook 150 dpi, /screen 72 dpi.
    fn preset(self) -> &'static str {
        match self {
            Self::Low => "/printer",
            Self::Medium => "/ebook",
            Self::High => "/screen",
        }
    }
}

pub async fn compress(
    state: &AppState,
    input: &Path,
    output: &Path,
    level: Level,
) -> ApiResult<()> {
    let mut cmd = tokio::process::Command::new(&state.cfg.gs_bin);
    cmd.arg("-sDEVICE=pdfwrite")
        .arg("-dCompatibilityLevel=1.5")
        .arg(format!("-dPDFSETTINGS={}", level.preset()))
        .args(["-dSAFER", "-dBATCH", "-dNOPAUSE", "-dQUIET"])
        .args([
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            "-dAutoRotatePages=/None",
        ])
        .arg(format!("-sOutputFile={}", output.display()))
        .arg(input)
        // File sementara Ghostscript juga di tmpfs.
        .env("TMPDIR", &state.cfg.tmp_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true);

    let mut child = cmd
        .spawn()
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("gs gagal dijalankan: {e}")))?;
    let status = tokio::time::timeout(state.cfg.process_timeout, child.wait())
        .await
        .map_err(|_| ApiError::Timeout)?
        .map_err(anyhow::Error::from)?;
    if status.success() {
        Ok(())
    } else {
        Err(ApiError::Failed)
    }
}
