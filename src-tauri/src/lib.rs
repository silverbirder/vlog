// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

static OUTPUT_PATHS: OnceCell<Mutex<HashMap<String, PathBuf>>> = OnceCell::new();

#[tauri::command]
async fn get_desktop_path(app: tauri::AppHandle) -> Result<String, String> {
    let desktop = app
        .path()
        .desktop_dir()
        .map_err(|e| format!("failed to get desktop dir: {}", e))?;
    Ok(desktop.to_string_lossy().to_string())
}

#[tauri::command]
fn append_chunk(data: Vec<u8>, id: Option<String>) -> Result<(), String> {
    let key = id.unwrap_or_else(|| "default".to_string());
    let map_cell = OUTPUT_PATHS.get_or_init(|| Mutex::new(HashMap::new()));
    let map = map_cell.lock();
    let path = map
        .get(&key)
        .cloned()
        .ok_or_else(|| "output path not initialized; call init_recording first".to_string())?;

    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("open file error: {}", e))?;
    f.write_all(&data)
        .map_err(|e| format!("write error: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn init_recording(
    path: String,
    mime: Option<String>,
    id: Option<String>,
    suffix: Option<String>,
) -> Result<String, String> {
    let output_dir = PathBuf::from(path);
    let key = id.unwrap_or_else(|| "default".to_string());
    let ext = if let Some(m) = mime {
        if m.contains("webm") {
            "webm"
        } else if key == "audio" {
            "m4a"
        } else {
            "mp4"
        }
    } else {
        "mp4"
    };
    let base = if key == "default" {
        "vlog_recording".to_string()
    } else {
        format!("vlog_recording_{}", key)
    };
    let filename = match suffix {
        Some(sfx) if !sfx.is_empty() => format!("{}_{}.{}", base, sfx, ext),
        _ => format!("{}.{}", base, ext),
    };
    let full_path = output_dir.join(filename);
    let _ = std::fs::remove_file(&full_path);

    let map_cell = OUTPUT_PATHS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = map_cell.lock();
    map.insert(key.clone(), full_path.clone());

    Ok(format!("initialized: {}", full_path.display()))
}

#[tauri::command]
fn finalize_recording(id: Option<String>) -> Result<String, String> {
    let key = id.unwrap_or_else(|| "default".to_string());
    if let Some(cell) = OUTPUT_PATHS.get() {
        let mut map = cell.lock();
        if let Some(path) = map.remove(&key) {
            Ok(format!("wrote file: {}", path.display()))
        } else {
            Err("no active recording".into())
        }
    } else {
        Err("no active recording".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_desktop_path,
            append_chunk,
            init_recording,
            finalize_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
