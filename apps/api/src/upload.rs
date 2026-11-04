//! Terima file dari multipart secara streaming ke tmpfs, dengan batas ukuran
//! dan validasi tipe dari magic bytes (bukan ekstensi).

use axum::extract::Multipart;
use tokio::io::AsyncWriteExt;

use crate::{
    error::{ApiError, ApiResult},
    temp::TempFile,
};

pub struct Upload {
    pub file: TempFile,
    /// Ekstensi sesuai isi file, misalnya "docx" atau "pdf".
    pub ext: &'static str,
    pub size: u64,
    /// Field teks lain (misalnya "level").
    pub fields: Vec<(String, String)>,
}

/// Baca field "file" (dan field teks kecil lain). `detect` memeriksa magic bytes di awal file
/// dan mengembalikan ekstensi yang sesuai isi, atau None bila tipe tidak diterima.
pub async fn receive(
    mut multipart: Multipart,
    tmp_dir: &std::path::Path,
    max: usize,
    detect: impl Fn(&[u8]) -> Option<&'static str>,
) -> ApiResult<Upload> {
    let mut fields = Vec::new();
    let mut upload: Option<Upload> = None;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::BadRequest("multipart"))?
    {
        let name = field.name().unwrap_or_default().to_owned();
        if name != "file" {
            let text = field
                .text()
                .await
                .map_err(|_| ApiError::BadRequest("field"))?;
            if text.len() <= 64 {
                fields.push((name, text));
            }
            continue;
        }
        if upload.is_some() {
            return Err(ApiError::BadRequest("satu file per request"));
        }

        let mut head: Vec<u8> = Vec::with_capacity(8192);
        let mut out: Option<(TempFile, tokio::fs::File, &'static str)> = None;
        let mut size: u64 = 0;

        while let Some(chunk) = field.chunk().await.map_err(|e| {
            if e.status() == axum::http::StatusCode::PAYLOAD_TOO_LARGE {
                ApiError::TooLarge
            } else {
                ApiError::BadRequest("upload terputus")
            }
        })? {
            size += chunk.len() as u64;
            if size > max as u64 {
                return Err(ApiError::TooLarge);
            }
            match out.as_mut() {
                Some((_, f, _)) => f.write_all(&chunk).await.map_err(anyhow::Error::from)?,
                None => {
                    head.extend_from_slice(&chunk);
                    // Cukup header awal untuk mengenali tipe file.
                    if head.len() >= 8192 {
                        out = Some(open(tmp_dir, &head, &detect).await?);
                    }
                }
            }
        }
        if out.is_none() {
            if head.is_empty() {
                return Err(ApiError::BadRequest("file kosong"));
            }
            out = Some(open(tmp_dir, &head, &detect).await?);
        }
        let (file, mut f, ext) = out.expect("file sudah dibuka");
        f.flush().await.map_err(anyhow::Error::from)?;
        upload = Some(Upload {
            file,
            ext,
            size,
            fields: Vec::new(),
        });
    }

    let mut upload = upload.ok_or(ApiError::BadRequest("field file tidak ada"))?;
    upload.fields = fields;
    Ok(upload)
}

async fn open(
    tmp_dir: &std::path::Path,
    head: &[u8],
    detect: &impl Fn(&[u8]) -> Option<&'static str>,
) -> ApiResult<(TempFile, tokio::fs::File, &'static str)> {
    let ext = detect(head).ok_or(ApiError::Unsupported)?;
    let file = TempFile::new(tmp_dir, ext);
    let mut f = tokio::fs::File::create(file.path())
        .await
        .map_err(anyhow::Error::from)?;
    f.write_all(head).await.map_err(anyhow::Error::from)?;
    Ok((file, f, ext))
}

/// Dokumen kantor: doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, rtf.
pub fn office_ext(head: &[u8]) -> Option<&'static str> {
    if let Some(kind) = infer::get(head)
        && kind.matcher_type() == infer::MatcherType::Doc
    {
        return Some(kind.extension());
    }
    // Zip OOXML dengan urutan entri tidak biasa: kenali dari nama folder di dalamnya.
    if head.starts_with(b"PK\x03\x04") {
        let has = |needle: &[u8]| head.windows(needle.len()).any(|w| w == needle);
        if has(b"word/") {
            return Some("docx");
        }
        if has(b"xl/") {
            return Some("xlsx");
        }
        if has(b"ppt/") {
            return Some("pptx");
        }
    }
    None
}

/// PDF dari header "%PDF-".
pub fn pdf_ext(head: &[u8]) -> Option<&'static str> {
    infer::get(head)
        .filter(|k| k.mime_type() == "application/pdf")
        .map(|_| "pdf")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deteksi_dokumen_dari_isi() {
        assert_eq!(office_ext(b"PK\x03\x04....xl/workbook.xml"), Some("xlsx"));
        assert_eq!(
            office_ext(b"PK\x03\x04....ppt/presentation.xml"),
            Some("pptx")
        );
        assert_eq!(office_ext(b"PK\x03\x04....random.txt"), None);
        assert_eq!(office_ext(b"%PDF-1.7"), None);
        assert_eq!(pdf_ext(b"%PDF-1.7\n"), Some("pdf"));
        assert_eq!(pdf_ext(b"PK\x03\x04"), None);
    }
}
