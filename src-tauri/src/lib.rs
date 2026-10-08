mod database;
mod locations;
mod model;
mod voice;
use base64::{engine::general_purpose::STANDARD, Engine};
use std::{path::PathBuf, sync::Mutex};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
struct AppState {
    root: PathBuf,
    lock: Mutex<()>,
}
#[tauri::command]
fn load_workspace(state: State<AppState>) -> Result<database::Loaded, String> {
    let _guard = state.lock.lock().map_err(|_| "Banco ocupado")?;
    let locations = locations::initialize(&state.root)?;
    database::init(&locations.database()?)?;
    let mut result = database::load(&locations.database()?)?;
    result.warning = database::backup_in(&locations.database()?, &locations.backup_dir, "daily")
        .err()
        .map(|e| format!("Backup automático falhou: {e}"));
    Ok(result)
}
#[tauri::command]
fn save_workspace(
    data: model::Workspace,
    revision: i64,
    importing: bool,
    state: State<AppState>,
) -> Result<database::Loaded, String> {
    let _guard = state.lock.lock().map_err(|_| "Banco ocupado")?;
    let locations = locations::initialize(&state.root)?;
    database::save_in(
        &locations.database()?,
        &locations.backup_dir,
        data,
        revision,
        importing,
    )
}
#[tauri::command]
fn undo_workspace(state: State<AppState>) -> Result<database::Loaded, String> {
    let _guard = state.lock.lock().map_err(|_| "Banco ocupado")?;
    let locations = locations::initialize(&state.root)?;
    database::undo(&locations.database()?)
}
#[tauri::command]
fn backup_workspace(state: State<AppState>) -> Result<String, String> {
    let _guard = state.lock.lock().map_err(|_| "Banco ocupado")?;
    let locations = locations::initialize(&state.root)?;
    database::backup_in(&locations.database()?, &locations.backup_dir, "manual")
        .map(|p| p.display().to_string())
}
#[tauri::command]
async fn export_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let data = {
            let state = app.state::<AppState>();
            let _g = state.lock.lock().map_err(|_| "Banco ocupado")?;
            let locations = locations::initialize(&state.root)?;
            database::load(&locations.database()?)?.data
        };
        let file = app
            .dialog()
            .file()
            .set_file_name("chrono-export.json")
            .add_filter("Chrono JSON", &["json"])
            .blocking_save_file();
        if let Some(file) = file {
            let path = file.into_path().map_err(|e| e.to_string())?;
            std::fs::write(
                &path,
                serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            Ok(Some(path.display().to_string()))
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn open_attachment(
    task_id: String,
    attachment_id: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Banco ocupado")?;
    let locations = locations::initialize(&state.root)?;
    let w = database::load(&locations.database()?)?.data;
    let a = w
        .tasks
        .iter()
        .find(|t| t.id == task_id)
        .and_then(|t| t.attachments.iter().find(|a| a.id == attachment_id))
        .ok_or("Anexo não encontrado")?;
    // Save to an app-owned directory with a random prefix, never accept a frontend path.
    let folder = locations.data_dir.join("opened-attachments");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let path = folder.join(format!(
        "{}-{}",
        uuid::Uuid::new_v4(),
        model::safe_name(&a.name)
    ));
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ![
        "pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "md", "csv", "docx", "xlsx", "pptx",
    ]
    .contains(&extension.as_str())
    {
        return Err("Abertura não permitida para este tipo de arquivo. Use a exportação JSON para preservar o anexo.".into());
    }
    std::fs::write(&path, STANDARD.decode(&a.data).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn storage_locations(state: State<AppState>) -> Result<locations::Locations, String> {
    let _guard = state.lock.lock().map_err(|_| "Armazenamento ocupado")?;
    locations::initialize(&state.root)
}
#[tauri::command]
async fn pick_storage_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Escolha a pasta de armazenamento do Chrono")
            .blocking_pick_folder()
            .map(|file| {
                file.into_path()
                    .map(|p| p.display().to_string())
                    .map_err(|e| e.to_string())
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn change_storage_location(
    kind: String,
    folder: String,
    app: tauri::AppHandle,
) -> Result<database::Loaded, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let _guard = state.lock.lock().map_err(|_| "Armazenamento ocupado")?;
        let locations = locations::change(&state.root, &kind, &PathBuf::from(folder))?;
        database::load(&locations.database()?)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| {
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) {
                if let Some(state) = window.try_state::<voice::VoiceState>() {
                    state.cancel();
                }
            }
        })
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            // Isolate manual desktop QA without touching a user's real database.
            #[cfg(debug_assertions)]
            let dir = std::env::var_os("CHRONO_TEST_DATA_DIR")
                .map(PathBuf::from)
                .filter(|p| p.is_absolute())
                .unwrap_or(dir);
            app.manage(AppState {
                root: dir.clone(),
                lock: Mutex::new(()),
            });
            app.manage(voice::VoiceState::new(dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            undo_workspace,
            export_workspace,
            backup_workspace,
            open_attachment,
            storage_locations,
            pick_storage_folder,
            change_storage_location,
            voice::voice_status,
            voice::voice_begin,
            voice::voice_stop,
            voice::voice_cancel
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o Chrono");
}
