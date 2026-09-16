mod database;
mod model;

use model::CreateTaskInput;
use rusqlite::{Connection, params};
use tauri::{Manager, State};

struct AppState {
    db_path: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}


#[tauri::command]
fn create_task(
    input: CreateTaskInput,
    state: State<AppState>,
) -> Result<(), String> {
    let connection = Connection::open(&state.db_path)
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT INTO tasks (
                title,
                description
            )
            VALUES (?1, ?2)
            ",
            params![
                input.title,
                input.description
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Não foi possível localizar o diretório de dados da aplicação");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Não foi possível criar o diretório de dados da aplicação");

            let db_path = app_data_dir.join("todo.db");

            let db_path_str = db_path
                .to_str()
                .expect("O caminho do banco de dados não é válido")
                .to_string();

            database::init_database(&db_path_str)
                .expect("Não foi possível inicializar o banco de dados");

            app.manage(AppState {
                db_path: db_path_str,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, create_task])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}