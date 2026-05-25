pub mod cache;
pub mod media;

use crate::scanner::cache::ScanCache;
use crate::scanner::media::probe_duration;
use anyhow::{anyhow, Result};
use parking_lot::Mutex;
use rayon::prelude::*;
use rayon::ThreadPoolBuilder;
use serde::Serialize;
use std::borrow::Cow;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicU64, AtomicUsize, Ordering},
    Arc,
};
use std::time::{Duration, UNIX_EPOCH};
use tauri::{Manager, Runtime};
use walkdir::WalkDir;

const EXTENSIONS: &[&str] = &[
    "mp4", "avi", "mov", "mkv", "wmv", "flv", "webm", "m4v", "mpg", "mpeg",
];

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScanEvent {
    Progress(ScanProgress),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub scanned_files: usize,
    pub total_files: usize,
    pub scanned_bytes: u64,
    pub total_bytes: u64,
    pub speed_mib_per_sec: f64,
    pub elapsed_sec: f64,
    pub current_path: Option<String>,
    pub tree_built_folders: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub root_path: String,
    pub total_video_files: usize,
    pub total_duration_sec: f64,
    pub total_bytes: u64,
    pub elapsed_sec: f64,
    pub failed_files: usize,
    pub cache_hits: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    pub path: String,
    pub name: String,
    pub depth: usize,
    pub direct_video_files: usize,
    pub total_video_files: usize,
    pub direct_duration_sec: f64,
    pub total_duration_sec: f64,
    pub direct_bytes: u64,
    pub total_bytes: u64,
    pub children: Vec<FolderNode>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub summary: ScanSummary,
    pub tree: FolderNode,
}

#[derive(Debug, Clone)]
struct FileCandidate {
    path: PathBuf,
    size: u64,
    modified: i64,
}

#[derive(Debug, Clone)]
struct VideoFileInfo {
    path: PathBuf,
    size: u64,
    duration_sec: f64,
}

#[derive(Debug, Clone, Default)]
struct FolderAgg {
    direct_video_files: usize,
    total_video_files: usize,
    direct_duration_sec: f64,
    total_duration_sec: f64,
    direct_bytes: u64,
    total_bytes: u64,
}

pub fn format_duration(seconds: f64) -> String {
    let total = seconds.round() as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    let secs = total % 60;
    if hours > 0 {
        format!("{} ч {} мин {} с", hours, minutes, secs)
    } else if minutes > 0 {
        format!("{} мин {} с", minutes, secs)
    } else {
        format!("{} с", secs)
    }
}

fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| EXTENSIONS.iter().any(|e| ext.eq_ignore_ascii_case(e)))
        .unwrap_or(false)
}

fn modified_unix(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn scan_path<R, F>(app: &tauri::AppHandle<R>, root_path: &str, emit: F) -> Result<ScanResult>
where
    R: Runtime,
    F: Fn(ScanEvent) + Send + Sync + 'static,
{
    let root = PathBuf::from(root_path);
    if !root.exists() {
        return Err(anyhow!("Папка не существует: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(anyhow!("Указанный путь не является папкой: {}", root.display()));
    }

    let started = std::time::Instant::now();
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().max(2))
        .unwrap_or(4);

    let _ = ThreadPoolBuilder::new().num_threads(threads).build_global();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow!("Не удалось получить app data dir: {}", e))?;
    let cache = ScanCache::open(&app_data_dir)?;
    let cache = Arc::new(Mutex::new(cache));

    let candidates = collect_candidates(&root)?;
    let total_files = candidates.len();
    let total_bytes: u64 = candidates.iter().map(|c| c.size).sum();

    let scanned_files = Arc::new(AtomicUsize::new(0));
    let scanned_bytes = Arc::new(AtomicU64::new(0));
    let failed_files = Arc::new(AtomicUsize::new(0));
    let cache_hits = Arc::new(AtomicUsize::new(0));
    let tree_built_folders = Arc::new(AtomicUsize::new(0));
    let current_path = Arc::new(Mutex::new(None::<String>));
    let last_emit_ms = Arc::new(AtomicU64::new(0));
    let emit = Arc::new(emit);

    let files: Vec<VideoFileInfo> = candidates
        .par_iter()
        .filter_map(|candidate| {
            {
                let mut cur = current_path.lock();
                *cur = Some(candidate.path.display().to_string());
            }

            let path_str = candidate.path.display().to_string();

            let duration_result: Result<f64> = {
                let cache_guard = cache.lock();
                match cache_guard.get(&path_str, candidate.size, candidate.modified) {
                    Ok(Some(entry)) => {
                        cache_hits.fetch_add(1, Ordering::Relaxed);
                        Ok(entry.duration_sec)
                    }
                    Ok(None) | Err(_) => {
                        drop(cache_guard);
                        let parsed = probe_duration(&candidate.path);
                        if let Ok(d) = parsed {
                            if let Some(cache_guard) = cache.try_lock() {
                                let _ = cache_guard.upsert(
                                    &path_str,
                                    candidate.size,
                                    candidate.modified,
                                    d,
                                );
                            }
                        }
                        parsed
                    }
                }
            };

            scanned_files.fetch_add(1, Ordering::Relaxed);
            scanned_bytes.fetch_add(candidate.size, Ordering::Relaxed);

            maybe_emit_progress(
                &emit,
                &scanned_files,
                total_files,
                &scanned_bytes,
                total_bytes,
                started.elapsed(),
                &current_path,
                &tree_built_folders,
                &last_emit_ms,
            );

            match duration_result {
                Ok(duration_sec) if duration_sec.is_finite() && duration_sec >= 0.0 => {
                    Some(VideoFileInfo {
                        path: candidate.path.clone(),
                        size: candidate.size,
                        duration_sec,
                    })
                }
                _ => {
                    failed_files.fetch_add(1, Ordering::Relaxed);
                    None
                }
            }
        })
        .collect();

    let tree = build_tree(&root, &files, &tree_built_folders);

    maybe_emit_progress(
        &emit,
        &scanned_files,
        total_files,
        &scanned_bytes,
        total_bytes,
        started.elapsed(),
        &current_path,
        &tree_built_folders,
        &last_emit_ms,
    );

    let total_duration_sec: f64 = files.iter().map(|f| f.duration_sec).sum();

    Ok(ScanResult {
        summary: ScanSummary {
            root_path: root.display().to_string(),
            total_video_files: files.len(),
            total_duration_sec,
            total_bytes,
            elapsed_sec: started.elapsed().as_secs_f64(),
            failed_files: failed_files.load(Ordering::Relaxed),
            cache_hits: cache_hits.load(Ordering::Relaxed),
        },
        tree,
    })
}

fn collect_candidates(root: &Path) -> Result<Vec<FileCandidate>> {
    let mut out = Vec::new();

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.into_path();
        if !is_video_file(&path) {
            continue;
        }

        let meta = match path.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        out.push(FileCandidate {
            path,
            size: meta.len(),
            modified: modified_unix(&meta),
        });
    }

    Ok(out)
}

fn maybe_emit_progress<F>(
    emit: &Arc<F>,
    scanned_files: &AtomicUsize,
    total_files: usize,
    scanned_bytes: &AtomicU64,
    total_bytes: u64,
    elapsed: Duration,
    current_path: &Mutex<Option<String>>,
    tree_built_folders: &AtomicUsize,
    last_emit_ms: &AtomicU64,
) where
    F: Fn(ScanEvent) + Send + Sync + 'static,
{
    let elapsed_ms = elapsed.as_millis() as u64;
    let prev = last_emit_ms.load(Ordering::Relaxed);

    if elapsed_ms.saturating_sub(prev) < 120 && scanned_files.load(Ordering::Relaxed) < total_files {
        return;
    }

    if last_emit_ms
        .compare_exchange(prev, elapsed_ms, Ordering::Relaxed, Ordering::Relaxed)
        .is_err()
        && scanned_files.load(Ordering::Relaxed) < total_files
    {
        return;
    }

    let elapsed_sec = elapsed.as_secs_f64().max(0.001);
    emit(ScanEvent::Progress(ScanProgress {
        scanned_files: scanned_files.load(Ordering::Relaxed),
        total_files,
        scanned_bytes: scanned_bytes.load(Ordering::Relaxed),
        total_bytes,
        speed_mib_per_sec: scanned_bytes.load(Ordering::Relaxed) as f64
            / 1024.0
            / 1024.0
            / elapsed_sec,
        elapsed_sec,
        current_path: current_path.lock().clone(),
        tree_built_folders: tree_built_folders.load(Ordering::Relaxed),
    }));
}

fn build_tree(root: &Path, files: &[VideoFileInfo], tree_built_folders: &AtomicUsize) -> FolderNode {
    let mut agg: BTreeMap<PathBuf, FolderAgg> = BTreeMap::new();
    let mut children: HashMap<PathBuf, Vec<PathBuf>> = HashMap::new();
    agg.entry(root.to_path_buf()).or_default();

    for file in files {
        let Some(parent) = file.path.parent() else {
            continue;
        };

        let entry = agg.entry(parent.to_path_buf()).or_default();
        entry.direct_video_files += 1;
        entry.direct_duration_sec += file.duration_sec;
        entry.direct_bytes += file.size;

        let mut current = Some(parent);
        while let Some(dir) = current {
            if !dir.starts_with(root) {
                break;
            }
            let e = agg.entry(dir.to_path_buf()).or_default();
            e.total_video_files += 1;
            e.total_duration_sec += file.duration_sec;
            e.total_bytes += file.size;

            if dir == root {
                break;
            }
            current = dir.parent();
        }
    }

    for entry in WalkDir::new(root)
        .min_depth(0)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        let dir = entry.into_path();
        agg.entry(dir.clone()).or_default();
        if let Some(parent) = dir.parent() {
            if dir != root && dir.starts_with(root) {
                children.entry(parent.to_path_buf()).or_default().push(dir.clone());
            }
        }
    }

    fn node_of(
        path: &Path,
        root: &Path,
        agg: &BTreeMap<PathBuf, FolderAgg>,
        children: &HashMap<PathBuf, Vec<PathBuf>>,
        tree_built_folders: &AtomicUsize,
    ) -> FolderNode {
        tree_built_folders.fetch_add(1, Ordering::Relaxed);

        let a = agg.get(path).cloned().unwrap_or_default();
        let mut kids = children
            .get(path)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|child| node_of(&child, root, agg, children, tree_built_folders))
            .collect::<Vec<_>>();

        kids.sort_by(|a, b| {
            b.total_duration_sec
                .partial_cmp(&a.total_duration_sec)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let depth = path
            .strip_prefix(root)
            .ok()
            .map(|p| p.components().count())
            .unwrap_or(0);

        let name: Cow<'_, str> = path
            .file_name()
            .and_then(|n| n.to_str())
            .map(Cow::Borrowed)
            .unwrap_or_else(|| Cow::Owned(path.display().to_string()));

        FolderNode {
            path: path.display().to_string(),
            name: name.into_owned(),
            depth,
            direct_video_files: a.direct_video_files,
            total_video_files: a.total_video_files,
            direct_duration_sec: a.direct_duration_sec,
            total_duration_sec: a.total_duration_sec,
            direct_bytes: a.direct_bytes,
            total_bytes: a.total_bytes,
            children: kids,
        }
    }

    node_of(root, root, &agg, &children, tree_built_folders)
}