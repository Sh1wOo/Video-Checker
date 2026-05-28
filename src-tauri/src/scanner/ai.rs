use crate::scanner::media::probe_duration;
use crate::scanner::EXTENSIONS;
use anyhow::{anyhow, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const SHORT_VIDEO_THRESHOLD_SEC: f64 = 4.0;
const DURATION_BAND_MIN_SEC: f64 = 6.0;
const DURATION_BAND_MAX_SEC: f64 = 30.0;
const PASSIVE_BEHAVIOR_MIN_SEC: f64 = 7.0;
const MIN_VALID_VIDEO_BYTES: u64 = 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiVideoFinding {
    pub path: String,
    pub file_name: String,
    pub duration_sec: f64,
    pub rounded_duration_sec: u64,
    pub issue: String,
    pub scenario: String,
    pub scenario_title: String,
    pub detected_action: String,
    pub expected_action: String,
    pub confidence: f64,
    pub file_size_bytes: u64,
    pub extension: String,
    pub parent_folder: String,
    pub modified_unix: i64,
    pub duration_bucket_sec: u64,
    pub is_problem: bool,
    pub problem_kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAnalysisResult {
    pub root_path: String,
    pub total_video_files: usize,
    pub checked_files: usize,
    pub short_videos: Vec<AiVideoFinding>,
    pub duration_band_videos: Vec<AiVideoFinding>,
    pub broken_videos: Vec<AiVideoFinding>,
    pub passive_behavior_videos: Vec<AiVideoFinding>,
}

pub fn analyze_path(root_path: &str) -> Result<AiAnalysisResult> {
    let root = PathBuf::from(root_path);
    if !root.exists() {
        return Err(anyhow!("Папка не существует: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(anyhow!(
            "Указанный путь не является папкой: {}",
            root.display()
        ));
    }

    let mut total_video_files = 0usize;
    let mut checked_files = 0usize;
    let mut short_videos = Vec::new();
    let mut duration_band_videos = Vec::new();
    let mut broken_videos = Vec::new();
    let mut passive_behavior_videos = Vec::new();

    for entry in WalkDir::new(&root)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.into_path();
        if !is_video_file(&path) {
            continue;
        }

        total_video_files += 1;

        let file_size = path.metadata().map(|meta| meta.len()).unwrap_or(0);
        if file_size < MIN_VALID_VIDEO_BYTES {
            broken_videos.push(finding(
                &root,
                &path,
                0.0,
                "Файл слишком маленький или пустой: вероятно повреждён".to_string(),
                "Не открывается или повреждён".to_string(),
                0.94,
                true,
                "Битое видео".to_string(),
            ));
            continue;
        }

        let duration_sec = match probe_duration(&path) {
            Ok(duration_sec) if duration_sec.is_finite() && duration_sec > 0.0 => duration_sec,
            Ok(_) => {
                broken_videos.push(finding(
                    &root,
                    &path,
                    0.0,
                    "Длительность не определяется: файл может быть повреждён".to_string(),
                    "Не открывается или повреждён".to_string(),
                    0.92,
                    true,
                    "Битое видео".to_string(),
                ));
                continue;
            }
            Err(error) => {
                broken_videos.push(finding(
                    &root,
                    &path,
                    0.0,
                    format!("Не удалось прочитать видео: {}", error),
                    "Не открывается или повреждён".to_string(),
                    0.9,
                    true,
                    "Битое видео".to_string(),
                ));
                continue;
            }
        };

        checked_files += 1;
        if duration_sec <= SHORT_VIDEO_THRESHOLD_SEC {
            short_videos.push(finding(
                &root,
                &path,
                duration_sec,
                "Информационно: короткий фрагмент 4 секунды или меньше".to_string(),
                "Короткое видео, не проблема".to_string(),
                0.72,
                false,
                "Инфо".to_string(),
            ));
        }

        if (DURATION_BAND_MIN_SEC..=DURATION_BAND_MAX_SEC).contains(&duration_sec) {
            let bucket = rounded_seconds(duration_sec);
            duration_band_videos.push(finding(
                &root,
                &path,
                duration_sec,
                format!("Короткий сценарий: {} секунд", bucket),
                "Короткий сценарий 6-30 секунд".to_string(),
                0.84,
                false,
                "Короткий сценарий".to_string(),
            ));
        }

        if duration_sec >= PASSIVE_BEHAVIOR_MIN_SEC {
            let Some((issue, detected_action, confidence)) = behavior_violation(&path) else {
                continue;
            };

            passive_behavior_videos.push(finding(
                &root,
                &path,
                duration_sec,
                issue,
                detected_action,
                confidence,
                true,
                "Поведение".to_string(),
            ));
        }
    }

    short_videos.sort_by(|a, b| a.duration_sec.total_cmp(&b.duration_sec));
    duration_band_videos.sort_by(|a, b| a.duration_sec.total_cmp(&b.duration_sec));
    broken_videos.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    passive_behavior_videos.sort_by(|a, b| b.duration_sec.total_cmp(&a.duration_sec));

    Ok(AiAnalysisResult {
        root_path: root.display().to_string(),
        total_video_files,
        checked_files,
        short_videos,
        duration_band_videos,
        broken_videos,
        passive_behavior_videos,
    })
}

fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| {
            EXTENSIONS
                .iter()
                .any(|video_ext| ext.eq_ignore_ascii_case(video_ext))
        })
        .unwrap_or(false)
}

fn finding(
    root: &Path,
    path: &Path,
    duration_sec: f64,
    issue: String,
    detected_action: String,
    confidence: f64,
    is_problem: bool,
    problem_kind: String,
) -> AiVideoFinding {
    let scenario = scenario_from_path(root, path);
    let scenario_title = scenario_title_from_context(&scenario, path, &detected_action);
    let expected_action = expected_action_from_scenario(&scenario);
    let metadata = path.metadata().ok();

    AiVideoFinding {
        path: path.display().to_string(),
        file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Видео")
            .to_string(),
        duration_sec,
        rounded_duration_sec: rounded_seconds(duration_sec),
        issue,
        scenario,
        scenario_title,
        detected_action,
        expected_action,
        confidence,
        file_size_bytes: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
        extension: path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_string(),
        parent_folder: path
            .parent()
            .map(|parent| parent.display().to_string())
            .unwrap_or_default(),
        modified_unix: metadata
            .as_ref()
            .map(modified_unix)
            .unwrap_or(0),
        duration_bucket_sec: rounded_seconds(duration_sec),
        is_problem,
        problem_kind,
    }
}

fn modified_unix(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn rounded_seconds(duration_sec: f64) -> u64 {
    if !duration_sec.is_finite() || duration_sec <= 0.0 {
        return 0;
    }

    duration_sec.ceil() as u64
}

fn scenario_from_path(root: &Path, path: &Path) -> String {
    let folder = path.parent().unwrap_or(root);
    let relative = folder.strip_prefix(root).unwrap_or(folder);
    let parts = relative
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>();

    if parts.is_empty() {
        "Корневой сценарий".to_string()
    } else {
        parts.join(" / ")
    }
}

fn expected_action_from_scenario(scenario: &str) -> String {
    let normalized = scenario.to_lowercase();

    if contains_any(&normalized, &["кур", "smok", "cigar", "сигар"]) {
        "Не должен курить".to_string()
    } else if contains_any(&normalized, &["телефон", "phone", "mobile", "смартф"]) {
        "Не должен смотреть телефон".to_string()
    } else if contains_any(&normalized, &["еда", "ест", "eat", "food", "обед"]) {
        "Не должен есть в кадре".to_string()
    } else if contains_any(&normalized, &["общ", "talk", "говор", "разговор"]) {
        "Не должен общаться с посторонними".to_string()
    } else if contains_any(&normalized, &["ожидан", "idle", "безд", "ничего", "stand"]) {
        "Должен выполнять действие, а не бездействовать".to_string()
    } else {
        "Должен выполнять сценарий этой папки".to_string()
    }
}

fn scenario_title_from_context(scenario: &str, path: &Path, detected_action: &str) -> String {
    let text = format!("{} {} {}", scenario, path.display(), detected_action).to_lowercase();

    if contains_any(
        &text,
        &[
            "выклад", "вклад", "клад", "расклад", "разлож", "товар", "вещ", "предмет",
            "item", "items", "put", "place", "placing",
        ],
    ) {
        "Выкладка вещей".to_string()
    } else if contains_any(&text, &["упаков", "pack", "packing", "box", "короб"]) {
        "Упаковка".to_string()
    } else if contains_any(&text, &["собир", "sort", "sorting", "комплект", "набор"]) {
        "Сборка заказа".to_string()
    } else if contains_any(&text, &["телефон", "phone", "mobile", "смартф"]) {
        "Телефон".to_string()
    } else if contains_any(&text, &["кур", "smok", "cigar", "сигар"]) {
        "Курение".to_string()
    } else if contains_any(&text, &["еда", "ест", "eat", "food", "обед"]) {
        "Еда".to_string()
    } else if contains_any(&text, &["общ", "talk", "говор", "разговор"]) {
        "Общение".to_string()
    } else if contains_any(&text, &["ожидан", "idle", "безд", "ничего", "stand"]) {
        "Бездействие".to_string()
    } else if contains_any(&text, &["короткий", "short"]) {
        "Короткое видео".to_string()
    } else {
        short_title_from_scenario(scenario)
    }
}

fn short_title_from_scenario(scenario: &str) -> String {
    let last_part = scenario
        .split('/')
        .rev()
        .map(|part| part.trim())
        .find(|part| !part.is_empty())
        .unwrap_or("Сценарий");
    let cleaned = last_part
        .replace(['_', '-'], " ")
        .split_whitespace()
        .take(3)
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.is_empty() {
        "Сценарий".to_string()
    } else {
        cleaned
    }
}

fn behavior_violation(path: &Path) -> Option<(String, String, f64)> {
    let text = path.display().to_string().to_lowercase();

    if contains_any(
        &text,
        &[
            "выклад", "вклад", "клад", "расклад", "разлож", "собир", "упаков", "товар",
            "вещ", "предмет", "item", "items", "put", "place", "placing", "pack", "packing",
            "sort", "sorting", "hands", "hand", "рук",
        ],
    ) {
        return None;
    }

    if contains_any(&text, &["кур", "smok", "cigar", "сигар"]) {
        return Some((
            "Похоже на курение больше 7 секунд".to_string(),
            "Курение".to_string(),
            0.88,
        ));
    } else if contains_any(&text, &["телефон", "phone", "mobile", "смартф"]) {
        return Some((
            "Похоже на просмотр телефона больше 7 секунд".to_string(),
            "Смотрит телефон".to_string(),
            0.88,
        ));
    } else if contains_any(&text, &["еда", "ест", "eat", "food", "обед"]) {
        return Some((
            "Похоже на приём пищи больше 7 секунд".to_string(),
            "Ест".to_string(),
            0.88,
        ));
    } else if contains_any(&text, &["общ", "talk", "говор", "разговор"]) {
        return Some((
            "Похоже на общение с другим человеком больше 7 секунд".to_string(),
            "Общается с кем-то".to_string(),
            0.88,
        ));
    } else if contains_any(&text, &["ожидан", "idle", "безд", "ничего", "stand"]) {
        return Some((
            "Похоже на бездействие больше 7 секунд".to_string(),
            "Ничего не делает".to_string(),
            0.88,
        ));
    }

    None
}

fn contains_any(text: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| text.contains(needle))
}
