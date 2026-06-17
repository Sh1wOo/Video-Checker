use serde::{Deserialize, Serialize};
use std::process::Command;

fn adb() -> String {
    which::which("adb")
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "adb".to_string())
}

fn run_adb(args: &[&str]) -> Result<String, String> {
    let output = Command::new(adb())
        .args(args)
        .output()
        .map_err(|e| format!("adb error: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "adb command failed".to_string()
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidDevice {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub display_name: String,
    pub product: Option<String>,
    pub device: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidStorageInfo {
    pub label: String,
    pub mount_path: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub total_human: String,
    pub used_human: String,
    pub free_human: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

fn getprop(serial: &str, key: &str) -> String {
    run_adb(&["-s", serial, "shell", "getprop", key]).unwrap_or_default()
}

fn parse_human_size(s: &str) -> u64 {
    let s = s.trim();
    if s.is_empty() {
        return 0;
    }
    let (num_str, unit) = s.split_at(s.len().saturating_sub(1));
    let base: f64 = num_str.parse().unwrap_or(0.0);
    match unit.to_uppercase().as_str() {
        "T" => (base * 1024.0 * 1024.0 * 1024.0 * 1024.0) as u64,
        "G" => (base * 1024.0 * 1024.0 * 1024.0) as u64,
        "M" => (base * 1024.0 * 1024.0) as u64,
        "K" => (base * 1024.0) as u64,
        _ => base as u64,
    }
}

pub fn resolve_storage_root(serial: &str) -> Result<String, String> {
    let resolved = run_adb(&["-s", serial, "shell", "readlink", "-f", "/sdcard"])?;
    let resolved = resolved.trim();
    if resolved.is_empty() {
        Ok("/storage/emulated/0".to_string())
    } else {
        Ok(resolved.to_string())
    }
}

pub fn list_devices() -> Result<Vec<AndroidDevice>, String> {
    let out = run_adb(&["devices", "-l"])?;
    let mut result = Vec::new();

    for line in out.lines().skip(1).filter(|l| !l.trim().is_empty()) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        if state == "offline" {
            continue;
        }

        let model = getprop(&serial, "ro.product.model");
        let product = {
            let v = getprop(&serial, "ro.product.name");
            if v.is_empty() { None } else { Some(v) }
        };
        let device = {
            let v = getprop(&serial, "ro.product.device");
            if v.is_empty() { None } else { Some(v) }
        };

        let display_name = if model.trim().is_empty() {
            parts.iter()
                .find(|p| p.starts_with("model:"))
                .map(|p| p.replace("model:", "").replace("_", " "))
                .unwrap_or_else(|| serial.clone())
        } else {
            model.trim().to_string()
        };

        result.push(AndroidDevice {
            serial,
            state,
            model: display_name.clone(),
            display_name,
            product,
            device,
        });
    }

    Ok(result)
}

pub fn get_storage_info(serial: &str) -> Result<AndroidStorageInfo, String> {
    let root = resolve_storage_root(serial)?;
    let out = run_adb(&["-s", serial, "shell", "df", "-h", &root])?;

    let data_line = out
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty() && !l.contains("Filesystem"))
        .ok_or_else(|| "df output is empty".to_string())?;

    let cols: Vec<&str> = data_line.split_whitespace().collect();
    if cols.len() < 6 {
        return Err(format!("unexpected df output: {data_line}"));
    }

    let total_human = cols[1].to_string();
    let used_human = cols[2].to_string();
    let free_human = cols[3].to_string();
    let mount_path = cols[5].to_string();

    Ok(AndroidStorageInfo {
        label: "Внутренний общий накопитель".to_string(),
        mount_path,
        total_bytes: parse_human_size(&total_human),
        used_bytes: parse_human_size(&used_human),
        free_bytes: parse_human_size(&free_human),
        total_human,
        used_human,
        free_human,
    })
}

pub fn list_files(serial: &str, path: &str) -> Result<Vec<AndroidEntry>, String> {
    let resolved = if path.trim().is_empty() || path == "/storage" || path == "/" {
        resolve_storage_root(serial)?
    } else {
        path.trim().to_string()
    };

    let listing = run_adb(&[
        "-s",
        serial,
        "shell",
        "sh",
        "-c",
        &format!("ls -1a \"{}\"", resolved.replace('"', "\\\"")),
    ])?;

    let mut items = Vec::new();

    for name in listing.lines().map(str::trim) {
        if name.is_empty() || name == "." || name == ".." {
            continue;
        }

        let full_path = format!("{}/{}", resolved.trim_end_matches('/'), name);

        let kind = run_adb(&[
            "-s",
            serial,
            "shell",
            "sh",
            "-c",
            &format!(
                "[ -d \"{}\" ] && echo dir || echo file",
                full_path.replace('"', "\\\"")
            ),
        ])?;

        let is_dir = kind.trim() == "dir";

        let size = if is_dir {
            0
        } else {
            run_adb(&[
                "-s",
                serial,
                "shell",
                "sh",
                "-c",
                &format!(
                    "wc -c < \"{}\" 2>/dev/null || echo 0",
                    full_path.replace('"', "\\\"")
                ),
            ])?
            .trim()
            .parse::<u64>()
            .unwrap_or(0)
        };

        items.push(AndroidEntry {
            name: name.to_string(),
            path: full_path,
            is_dir,
            size,
        });
    }

    items.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(items)
}

pub fn create_dir(serial: &str, path: &str) -> Result<(), String> {
    let status = Command::new(adb())
        .args(["-s", serial, "shell", "mkdir", "-p", path])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("mkdir failed".into()) }
}

pub fn delete_entry(serial: &str, path: &str, is_dir: bool) -> Result<(), String> {
    let args: Vec<&str> = if is_dir {
        vec!["-s", serial, "shell", "rm", "-rf", path]
    } else {
        vec!["-s", serial, "shell", "rm", "-f", path]
    };
    let status = Command::new(adb()).args(args).status().map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("rm failed".into()) }
}

pub fn rename_entry(serial: &str, path: &str, new_name: &str) -> Result<String, String> {
    let parent = path.rfind('/').map(|i| &path[..i]).unwrap_or("/sdcard");
    let new_path = format!("{}/{}", parent, new_name);
    let status = Command::new(adb())
        .args(["-s", serial, "shell", "mv", path, &new_path])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(new_path) } else { Err("mv failed".into()) }
}

pub fn move_entry(serial: &str, source_path: &str, target_path: &str) -> Result<(), String> {
    let status = Command::new(adb())
        .args(["-s", serial, "shell", "mv", source_path, target_path])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("mv failed".into()) }
}

pub fn pull_file(serial: &str, remote_path: &str, local_path: &str) -> Result<(), String> {
    let status = Command::new(adb())
        .args(["-s", serial, "pull", remote_path, local_path])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("adb pull failed".into()) }
}

pub fn push_file(serial: &str, local_path: &str, remote_path: &str) -> Result<(), String> {
    let status = Command::new(adb())
        .args(["-s", serial, "push", local_path, remote_path])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("adb push failed".into()) }
}

pub fn import_local_folder(serial: &str, local_root: &str, remote_root: &str) -> Result<(), String> {
    let status = Command::new(adb())
        .args(["-s", serial, "push", local_root, remote_root])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("adb push folder failed".into()) }
}

pub fn scan_path_to_temp(serial: &str, remote_path: &str) -> Result<std::path::PathBuf, String> {
    let tmp_dir = std::env::temp_dir()
        .join(format!("video_checker_android_{}", &serial[..serial.len().min(12)]));
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    pull_file(serial, remote_path, tmp_dir.to_str().unwrap())?;
    Ok(tmp_dir)
}