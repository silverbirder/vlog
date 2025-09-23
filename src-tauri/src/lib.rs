// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

static OUTPUT_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();
static LAST_OUTPUT_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn append_chunk(data: Vec<u8>) -> Result<(), String> {
    // On first call, initialize output file in desktop directory
    // initialize the cell if needed
    let cell = OUTPUT_PATH.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock();

    // Require explicit initialization via `init_recording` to avoid
    // creating an incorrect default file (prevents container/extension mismatch).
    if guard.is_none() {
        return Err("output path not initialized; call init_recording first".into());
    }

    if let Some(ref path) = *guard {
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| format!("open file error: {}", e))?;
        f.write_all(&data)
            .map_err(|e| format!("write error: {}", e))?;
        Ok(())
    } else {
        Err("output path not set".into())
    }
}

#[tauri::command]
async fn init_recording(app: tauri::AppHandle, mime: Option<String>) -> Result<String, String> {
    let app_data_dir = app.path().desktop_dir().map_err(|e| format!("failed to get desktop dir: {}", e))?;
    let ext = if let Some(m) = mime {
        if m.contains("webm") { "webm" } else { "mp4" }
    } else {
        "mp4"
    };
    let filename = format!("vlog_recording.{}", ext);
    let path = app_data_dir.join(filename);
    let _ = std::fs::remove_file(&path);

    let cell = OUTPUT_PATH.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock();
    *guard = Some(path.clone());

    let last = LAST_OUTPUT_PATH.get_or_init(|| Mutex::new(None));
    let mut last_guard = last.lock();
    *last_guard = Some(path.clone());

    Ok(format!("initialized: {}", path.display()))
}

#[tauri::command]
fn finalize_recording() -> Result<String, String> {
    if let Some(cell) = OUTPUT_PATH.get() {
        let mut guard = cell.lock();
        if let Some(path) = guard.take() {
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
            greet,
            append_chunk,
            init_recording,
            finalize_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
