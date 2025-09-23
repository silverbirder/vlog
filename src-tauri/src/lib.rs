// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

static OUTPUT_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();
static LAST_OUTPUT_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn append_chunk(data: Vec<u8>) -> Result<(), String> {
    // On first call, initialize output file in app's data directory
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
fn init_recording(mime: Option<String>) -> Result<String, String> {
    let mut tmp = std::env::temp_dir();
    let ext = if let Some(m) = mime {
        if m.contains("webm") { "webm" } else { "mp4" }
    } else {
        "mp4"
    };
    tmp.push(format!("vlog_recording.{}", ext));
    let _ = std::fs::remove_file(&tmp);

    let cell = OUTPUT_PATH.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock();
    *guard = Some(tmp.clone());

    let last = LAST_OUTPUT_PATH.get_or_init(|| Mutex::new(None));
    let mut last_guard = last.lock();
    *last_guard = Some(tmp.clone());

    Ok(format!("initialized: {}", tmp.display()))
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

#[tauri::command]
fn read_recording() -> Result<Vec<u8>, String> {
    // Try to use last known output path, fallback to default mp4
    let mut candidate: Option<PathBuf> = None;
    if let Some(last) = LAST_OUTPUT_PATH.get() {
        let last_guard = last.lock();
        if let Some(ref p) = *last_guard {
            candidate = Some(p.clone());
        }
    }

    let tmp = if let Some(p) = candidate { p } else {
        let mut t = std::env::temp_dir();
        t.push("vlog_recording.mp4");
        t
    };

    if !tmp.exists() {
        return Err("no recording found".into());
    }

    std::fs::read(&tmp).map_err(|e| format!("read error: {}", e))
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
            read_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
