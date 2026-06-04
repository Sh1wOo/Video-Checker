#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scanner;

use scanner::{ai::AiAnalysisResult, ScanResult};
use std::sync::Arc;
use tauri::{Emitter, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;

#[derive(Default)]
struct AppScanState {
    running: Mutex<bool>,
}

#[tauri::command]
async fn start_scan(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppScanState>>,
    root_path: String,
) -> Result<ScanResult, String> {
    {
        let mut running = state.running.lock().await;
        if *running {
            return Err("Сканирование уже выполняется".into());
        }
        *running = true;
    }

    let task_app = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        let scan_app = task_app.clone();
        let emit_app = task_app.clone();

        scanner::scan_path(&scan_app, &root_path, move |event| {
            let _ = emit_app.emit("scan://event", event);
        })
    })
    .await
    .map_err(|e| e.to_string());

    {
        let mut running = state.running.lock().await;
        *running = false;
    }

    let result = result?;
    match result {
        Ok(scan) => {
            let _ = app
                .notification()
                .builder()
                .title("Сканирование завершено")
                .body(format!(
                    "Найдено {} видео, длительность {}",
                    scan.summary.total_video_files,
                    scanner::format_duration(scan.summary.total_duration_sec)
                ))
                .show();

            Ok(scan)
        }
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
async fn run_ai_analysis(root_path: String) -> Result<AiAnalysisResult, String> {
    tokio::task::spawn_blocking(move || scanner::ai::analyze_path(&root_path))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_video_file(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = std::path::PathBuf::from(path);
        if !path.exists() {
            return Err("Файл уже удалён или не найден".to_string());
        }
        if !path.is_file() {
            return Err("Удалять можно только файл видео".to_string());
        }

        std::fs::remove_file(&path)
            .map_err(|error| format!("Не удалось удалить видео: {}", error))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_report(path: String, content: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = std::path::PathBuf::from(path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Не удалось создать папку для файла: {}", error))?;
        }
        std::fs::write(&path, content)
            .map_err(|error| format!("Не удалось сохранить отчёт: {}", error))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(AppScanState::default()))
        .invoke_handler(tauri::generate_handler![start_scan, run_ai_analysis, delete_video_file, save_report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}