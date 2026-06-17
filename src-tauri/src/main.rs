#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod android;
mod scanner;

use android::{AndroidDevice, AndroidEntry, AndroidStorageInfo};
use scanner::{ai::AiAnalysisResult, ScanResult};
use std::sync::Arc;
use tauri::{Emitter, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;

const APP_NAME: &str = "Raduga Dataset Video Community";
const APP_VERSION: &str = "0.3.5";

#[derive(Default)]
struct AppScanState {
    running: Mutex<bool>,
}

// ─── LOCAL SCAN ──────────────────────────────────────────────────────────────

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
                .title(APP_NAME)
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

#[tauri::command]
async fn recover_broken_video(path: String, output_folder: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        scanner::recover::recover_broken_video(&path, &output_folder, None)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn recover_broken_video_with_reference(
    path: String,
    output_folder: String,
    reference_path: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        scanner::recover::recover_broken_video(&path, &output_folder, Some(reference_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── ANDROID / VR COMMANDS ───────────────────────────────────────────────────

#[tauri::command]
async fn android_list_devices() -> Result<Vec<AndroidDevice>, String> {
    tokio::task::spawn_blocking(android::list_devices)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_get_storage_info(serial: String) -> Result<AndroidStorageInfo, String> {
    tokio::task::spawn_blocking(move || android::get_storage_info(&serial))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_list_files(serial: String, path: String) -> Result<Vec<AndroidEntry>, String> {
    tokio::task::spawn_blocking(move || android::list_files(&serial, &path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_create_dir(serial: String, path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || android::create_dir(&serial, &path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_delete(serial: String, path: String, is_dir: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || android::delete_entry(&serial, &path, is_dir))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_rename(serial: String, path: String, new_name: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || android::rename_entry(&serial, &path, &new_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_move(serial: String, src: String, dst: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || android::move_entry(&serial, &src, &dst))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_pull_file(serial: String, remote: String, local: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || android::pull_file(&serial, &remote, &local))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_push_file(serial: String, local: String, remote: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || android::push_file(&serial, &local, &remote))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_import_folder(serial: String, local_root: String, remote_root: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || android::import_local_folder(&serial, &local_root, &remote_root))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn android_scan_path(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppScanState>>,
    serial: String,
    remote_path: String,
) -> Result<ScanResult, String> {
    {
        let mut running = state.running.lock().await;
        if *running {
            return Err("Сканирование уже выполняется".into());
        }
        *running = true;
    }

    let result = tokio::task::spawn_blocking(move || {
        let tmp_dir = android::scan_path_to_temp(&serial, &remote_path)?;
        let local_path = tmp_dir
            .to_str()
            .ok_or_else(|| "Invalid tmp path".to_string())?
            .to_string();

        let scan_app = app.clone();
        let emit_app = app.clone();

        scanner::scan_path(&scan_app, &local_path, move |event| {
            let _ = emit_app.emit("scan://event", event);
        })
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    {
        let mut running = state.running.lock().await;
        *running = false;
    }

    result
}

#[tauri::command]
fn get_app_version() -> String {
    APP_VERSION.to_string()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .manage(Arc::new(AppScanState::default()))
        .invoke_handler(tauri::generate_handler![
            // Local
            start_scan,
            run_ai_analysis,
            delete_video_file,
            save_report,
            recover_broken_video,
            recover_broken_video_with_reference,
            get_app_version,
            // Android / VR
            android_list_devices,
            android_get_storage_info,
            android_list_files,
            android_create_dir,
            android_delete,
            android_rename,
            android_move,
            android_pull_file,
            android_push_file,
            android_import_folder,
            android_scan_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Raduga Dataset Video Community")
}
