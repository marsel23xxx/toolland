//! File sementara di tmpfs (RAM). Nama acak UUID, dihapus otomatis saat guard di-drop,
//! termasuk saat error atau saat pengguna memutus koneksi.

use std::path::{Path, PathBuf};

pub struct TempFile {
    path: PathBuf,
}

impl TempFile {
    pub fn new(dir: &Path, ext: &str) -> Self {
        Self {
            path: dir.join(format!("{}.{ext}", uuid::Uuid::new_v4())),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        // Sinkron dan aman dipanggil di mana saja; file mungkin memang belum dibuat.
        let _ = std::fs::remove_file(&self.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_dihapus_saat_drop() {
        let dir = std::env::temp_dir();
        let path;
        {
            let t = TempFile::new(&dir, "bin");
            std::fs::write(t.path(), b"x").unwrap();
            path = t.path().to_path_buf();
            assert!(path.exists());
        }
        assert!(!path.exists());
    }
}
