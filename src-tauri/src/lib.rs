// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

static OUTPUT_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

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
    if guard.is_none() {
        let mut p = std::env::temp_dir();
        p.push("vlog_recording.mp4");
        let _ = std::fs::remove_file(&p);
        *guard = Some(p);
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
fn save_recording(dest: String) -> Result<String, String> {
    // copy from temp output path to destination
    if let Some(cell) = OUTPUT_PATH.get() {
        // if recording still active, refuse
        let guard = cell.lock();
        if guard.is_some() {
            return Err("recording still in progress".into());
        }
    }

    // Try to find the temp file path used earlier
    let mut tmp = std::env::temp_dir();
    tmp.push("vlog_recording.mp4");
    if !tmp.exists() {
        return Err("no recording found".into());
    }

    std::fs::copy(&tmp, &dest).map_err(|e| format!("copy error: {}", e))?;
    Ok(format!("saved to {}", dest))
}

#[tauri::command]
fn read_recording() -> Result<Vec<u8>, String> {
    let mut tmp = std::env::temp_dir();
    tmp.push("vlog_recording.mp4");
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
            finalize_recording,
            save_recording,
            read_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
