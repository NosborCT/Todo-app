mod database;

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
                .expect("O caminho do banco de dados não é válido");

            database::init_database(db_path_str)
                .expect("Não foi possível inicializar o banco de dados");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}