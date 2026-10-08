use crate::model::{validate, Workspace};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loaded {
    pub data: Workspace,
    pub revision: i64,
    pub can_undo: bool,
    pub warning: Option<String>,
    pub data_path: String,
}
fn open(path: &Path) -> Result<Connection, String> {
    connect(path, false)
}
fn connect(path: &Path, create: bool) -> Result<Connection, String> {
    let mut flags = rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE;
    if create {
        flags |= rusqlite::OpenFlags::SQLITE_OPEN_CREATE;
    }
    let c = Connection::open_with_flags(path, flags).map_err(|e| e.to_string())?;
    c.busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| e.to_string())?;
    Ok(c)
}
pub fn init(path: &Path) -> Result<(), String> {
    let mut c = connect(path, true)?;
    c.execute_batch(include_str!("../migrations/0001_create_tasks.sql"))
        .map_err(|e| e.to_string())?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch("CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS undo_history (id INTEGER PRIMARY KEY AUTOINCREMENT, document TEXT NOT NULL); PRAGMA user_version=2;").map_err(|e| e.to_string())?;
    let exists: i64 = tx
        .query_row("SELECT count(*) FROM workspace", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        let mut data = serde_json::to_value(Workspace::default()).map_err(|e| e.to_string())?;
        let mut stmt = tx.prepare("SELECT task_id,title,description,completed,created_at,updated_at,completed_at FROM tasks ORDER BY task_id DESC").map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, bool>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, Option<String>>(5)?,
                    r.get::<_, Option<String>>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        fn stamp(s: Option<String>) -> String {
            s.and_then(|s| chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S").ok())
                .map(|d| d.and_utc().to_rfc3339())
                .unwrap_or_else(|| Utc::now().to_rfc3339())
        }
        for row in rows {
            let (id, title, notes, done, created, updated, completed) =
                row.map_err(|e| e.to_string())?;
            data["tasks"].as_array_mut().unwrap().push(serde_json::json!({"id":format!("legacy-{id}"),"title":if title.trim().is_empty() {"Tarefa sem título".to_string()} else {title},"notes":notes.unwrap_or_default(),"status":if done {"completed"} else {"inbox"},"priority":0,"projectId":null,"tags":[],"startDate":null,"dueDate":null,"reminderAt":null,"notifiedAt":null,"recurrence":null,"subtasks":[],"attachments":[],"createdAt":stamp(created),"updatedAt":stamp(updated),"completedAt":if done {Some(stamp(completed))} else {None},"archived":false,"seriesId":null}));
        }
        tx.execute("INSERT INTO workspace VALUES (1,0,?1)", [data.to_string()])
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
pub fn load(path: &Path) -> Result<Loaded, String> {
    let c = open(path)?;
    let (revision, document): (i64, String) = c
        .query_row(
            "SELECT revision,document FROM workspace WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let count: i64 = c
        .query_row("SELECT count(*) FROM undo_history", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let data: Workspace = serde_json::from_str(&document)
        .map_err(|e| format!("Dados inválidos: {e}. Restaure um backup."))?;
    Ok(Loaded {
        data,
        revision,
        can_undo: count > 0,
        warning: None,
        data_path: path.display().to_string(),
    })
}
#[cfg(test)]
pub fn backup(path: &Path, label: &str) -> Result<PathBuf, String> {
    let folder = path.parent().ok_or("Diretório inválido")?.join("backups");
    backup_in(path, &folder, label)
}
pub fn backup_in(path: &Path, folder: &Path, label: &str) -> Result<PathBuf, String> {
    let data = load(path)?.data;
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let name = if label == "daily" {
        format!("chrono-daily-{}.json", Utc::now().format("%Y-%m-%d"))
    } else {
        format!(
            "chrono-{label}-{}.json",
            Utc::now().format("%Y%m%dT%H%M%S%.9f")
        )
    };
    let dest = folder.join(name);
    if dest.exists() {
        return Ok(dest);
    }
    let tmp = dest.with_extension("tmp");
    let mut file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(&mut file, &data).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    let mut backups: Vec<_> = fs::read_dir(&folder)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter(|e| {
            e.file_name().to_string_lossy().starts_with("chrono-daily-")
                && e.path().extension().is_some_and(|x| x == "json")
        })
        .map(|e| e.path())
        .collect();
    backups.sort();
    let n = backups.len().saturating_sub(30);
    for old in backups.into_iter().take(n) {
        fs::remove_file(old).map_err(|e| e.to_string())?;
    }
    Ok(dest)
}
#[cfg(test)]
pub fn save(
    path: &Path,
    data: Workspace,
    revision: i64,
    importing: bool,
) -> Result<Loaded, String> {
    save_in(
        path,
        &path.parent().ok_or("Diretório inválido")?.join("backups"),
        data,
        revision,
        importing,
    )
}
pub fn save_in(
    path: &Path,
    backups: &Path,
    data: Workspace,
    revision: i64,
    importing: bool,
) -> Result<Loaded, String> {
    validate(&data)?;
    if importing {
        backup_in(path, backups, "before-import")?;
    }
    let warning = backup_in(path, backups, "daily")
        .err()
        .map(|e| format!("Backup automático falhou: {e}"));
    let mut c = open(path)?;
    let tx = c
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let (actual, previous): (i64, String) = tx
        .query_row(
            "SELECT revision,document FROM workspace WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    if actual != revision {
        return Err("Dados alterados em outra janela. Recarregue antes de salvar.".into());
    }
    tx.execute("INSERT INTO undo_history(document) VALUES (?1)", [previous])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM undo_history WHERE id NOT IN (SELECT id FROM undo_history ORDER BY id DESC LIMIT 30)", []).map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE workspace SET revision=revision+1, document=?1 WHERE id=1",
        [serde_json::to_string(&data).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    let mut result = load(path)?;
    result.warning = warning;
    Ok(result)
}
pub fn undo(path: &Path) -> Result<Loaded, String> {
    let mut c = open(path)?;
    let tx = c
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let (id, previous): (i64, String) = tx
        .query_row(
            "SELECT id,document FROM undo_history ORDER BY id DESC LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "Nada para desfazer.")?;
    tx.execute(
        "UPDATE workspace SET revision=revision+1,document=?1 WHERE id=1",
        [previous],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM undo_history WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    load(path)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> PathBuf {
        let p = std::env::temp_dir().join(format!("chrono-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&p).unwrap();
        p.join("todo.db")
    }
    #[test]
    fn persistence_conflict_undo_backup_roundtrip() {
        let p = db();
        init(&p).unwrap();
        let mut w = load(&p).unwrap().data;
        w.projects.push(crate::model::Project {
            id: "project-1".into(),
            name: "Estudos".into(),
            color: "#7c3aed".into(),
        });
        assert_eq!(save(&p, w.clone(), 0, false).unwrap().revision, 1);
        assert!(save(&p, w, 0, false).is_err());
        let exported = backup(&p, "manual").unwrap();
        let restored: Workspace = serde_json::from_slice(&fs::read(exported).unwrap()).unwrap();
        validate(&restored).unwrap();
        assert_eq!(load(&p).unwrap().data.projects.len(), 1);
        assert!(undo(&p).unwrap().data.projects.is_empty());
        save(&p, restored, 2, true).unwrap();
        assert_eq!(load(&p).unwrap().data.projects.len(), 1);
        fs::remove_dir_all(p.parent().unwrap()).unwrap();
    }
    #[test]
    fn task_lifecycle_and_invalid_import_are_atomic() {
        let p = db();
        init(&p).unwrap();
        let task = serde_json::json!({
            "id":"task-1", "title":"Planejar", "status":"inbox", "notes":"Notas", "priority":3,
            "projectId":null,"tags":[],"startDate":"2026-10-01","dueDate":"2026-10-06",
            "reminderAt":null,"notifiedAt":null,"recurrence":null,"subtasks":[],
            "attachments":[{"id":"a-1","name":"nota.txt","data":"YWJj","size":3}],
            "createdAt":"2026-10-06T12:00:00Z","updatedAt":"2026-10-06T12:00:00Z",
            "completedAt":null,"archived":false,"seriesId":null
        });
        let mut w = Workspace::default();
        w.tasks.push(serde_json::from_value(task).unwrap());
        save(&p, w, 0, false).unwrap();
        let mut completed = load(&p).unwrap().data;
        completed.tasks[0].status = "completed".into();
        completed.tasks[0].completed_at = Some("2026-10-06T13:00:00Z".into());
        save(&p, completed.clone(), 1, false).unwrap();
        assert_eq!(load(&p).unwrap().data.tasks[0].status, "completed");
        let mut invalid = completed.clone();
        invalid.tasks[0].attachments[0].data = "!invalid".into();
        assert!(save(&p, invalid, 2, true).is_err());
        assert_eq!(load(&p).unwrap().revision, 2);
        assert_eq!(undo(&p).unwrap().data.tasks[0].status, "inbox");
        let exported = backup(&p, "manual").unwrap();
        let imported: Workspace = serde_json::from_slice(&fs::read(exported).unwrap()).unwrap();
        assert_eq!(imported.tasks[0].attachments[0].data, "YWJj");
        save(&p, imported, 3, true).unwrap();
        assert_eq!(load(&p).unwrap().data.tasks[0].title, "Planejar");
        fs::remove_dir_all(p.parent().unwrap()).unwrap();
    }
    #[test]
    fn legacy_migration_is_idempotent() {
        let p = db();
        {
            let c = connect(&p, true).unwrap();
            c.execute_batch(include_str!("../migrations/0001_create_tasks.sql"))
                .unwrap();
            c.execute("INSERT INTO tasks(title,completed) VALUES ('Antiga',1)", [])
                .unwrap();
        }
        init(&p).unwrap();
        init(&p).unwrap();
        let w = load(&p).unwrap().data;
        assert_eq!(w.tasks.len(), 1);
        assert_eq!(w.tasks[0].status, "completed");
        validate(&w).unwrap();
        fs::remove_dir_all(p.parent().unwrap()).unwrap();
    }
    #[test]
    fn rejects_invalid_data_and_path_names() {
        let mut w = Workspace::default();
        w.version = 2;
        assert!(validate(&w).is_err());
        assert_eq!(crate::model::safe_name("../../bad.exe"), ".._.._bad.exe");
    }
    #[test]
    fn date_filters_preserve_legacy_defaults_and_validate_saved_ranges() {
        let p = db();
        init(&p).unwrap();
        let mut w = Workspace::default();
        w.filters.push(serde_json::from_value(serde_json::json!({"id":"date-filter", "name":"Período", "criteria":{"query":"","status":"","projectId":"","tagId":"","priority":""}})).unwrap());
        assert_eq!(w.filters[0].criteria.date_field, "dueDate");
        assert!(w.filters[0].criteria.date_from.is_empty());
        save(&p, w.clone(), 0, false).unwrap();
        w.filters[0].criteria.date_field = "startDate".into();
        w.filters[0].criteria.date_from = "2026-10-06".into();
        w.filters[0].criteria.date_to = "2026-10-10".into();
        save(&p, w.clone(), 1, false).unwrap();
        assert_eq!(
            load(&p).unwrap().data.filters[0].criteria.date_from,
            "2026-10-06"
        );
        w.filters[0].criteria.date_to = "2026-10-05".into();
        assert!(save(&p, w.clone(), 2, false).is_err());
        w.filters[0].criteria.date_to = "2026-02-30".into();
        assert!(save(&p, w, 2, false).is_err());
        assert_eq!(load(&p).unwrap().revision, 2);
        fs::remove_dir_all(p.parent().unwrap()).unwrap();
    }
}
