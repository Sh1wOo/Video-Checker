#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scanner;

use scanner::ScanResult;
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(AppScanState::default()))
        .invoke_handler(tauri::generate_handler![start_scan])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}