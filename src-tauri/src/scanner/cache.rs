use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::Path;

#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub duration_sec: f64,
}

pub struct ScanCache {
    conn: Connection,
}

impl ScanCache {
    pub fn open(base_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(base_dir)?;
        let db_path = base_dir.join("scan_cache.sqlite3");
        let conn = Connection::open(db_path)?;

        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            CREATE TABLE IF NOT EXISTS file_cache (
                path TEXT PRIMARY KEY,
                size INTEGER NOT NULL,
                modified INTEGER NOT NULL,
                duration_sec REAL NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_file_cache_size_modified ON file_cache(size, modified);
            "#,
        )?;

        Ok(Self { conn })
    }

    pub fn get(&self, path: &str, size: u64, modified: i64) -> Result<Option<CacheEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT duration_sec FROM file_cache WHERE path = ?1 AND size = ?2 AND modified = ?3",
        )?;

        let mut rows = stmt.query(params![path, size as i64, modified])?;
        if let Some(row) = rows.next()? {
            Ok(Some(CacheEntry {
                duration_sec: row.get(0)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn upsert(&self, path: &str, size: u64, modified: i64, duration_sec: f64) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO file_cache(path, size, modified, duration_sec, updated_at)
            VALUES(?1, ?2, ?3, ?4, unixepoch())
            ON CONFLICT(path) DO UPDATE SET
                size = excluded.size,
                modified = excluded.modified,
                duration_sec = excluded.duration_sec,
                updated_at = excluded.updated_at
            "#,
            params![path, size as i64, modified, duration_sec],
        )?;
        Ok(())
    }
}