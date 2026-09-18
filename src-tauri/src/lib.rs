mod database;
mod model;
use model::{CreateTaskInput, Task, UpdateTaskInput};

use rusqlite::{params, Connection};
use tauri::{Manager, State};

struct AppState {
    db_path: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]

fn update_task(input: UpdateTaskInput, state: State<AppState>) -> Result<(), String> {
    let connection = Connection::open(&state.db_path).map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            UPDATE tasks
            SET title = ?1,
                description = ?2,
                completed = ?3,
                updated_at = CURRENT_TIMESTAMP,
                completed_at = CASE WHEN ?3 THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE task_id = ?4
            ",
            params![input.title, input.description, input.completed, input.task_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}
#[tauri::command]
fn list_tasks(state: State<AppState>) -> Result<Vec<Task>, String> {
    let connection = Connection::open(&state.db_path)
        .map_err(|error| error.to_string())?;

    let mut statement = connection
        .prepare(
            "
            SELECT
                task_id,
                title,
                description,
                completed,
                created_at,
                updated_at,
                completed_at
            FROM tasks
            ORDER BY task_id DESC
            ",
        )
        .map_err(|error| error.to_string())?;

    let task_rows = statement
        .query_map([], |row| {
            Ok(Task {
                task_id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                completed: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                completed_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut tasks = Vec::new();

    for task in task_rows {
        tasks.push(task.map_err(|error| error.to_string())?);
    }

    Ok(tasks)
} 
#[tauri::command]
fn create_task(input: CreateTaskInput, state: State<AppState>) -> Result<(), String> {
    let connection = Connection::open(&state.db_path).map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT INTO tasks (
                title,
                description
            )
            VALUES (?1, ?2)
            ",
            params![input.title, input.description],
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
        .invoke_handler(tauri::generate_handler![greet, create_task, list_tasks, update_task])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}