use crate::database;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Locations {
    pub data_dir: PathBuf,
    pub backup_dir: PathBuf,
}
impl Locations {
    pub fn database(&self) -> Result<PathBuf, String> {
        let path = self.data_dir.join("todo.db");
        if !path.is_file() {
            return Err(format!("Banco indisponível em {}. Reconecte a unidade/pasta e tente novamente. Nenhum banco vazio foi criado.", path.display()));
        }
        Ok(path)
    }
}
pub fn load(root: &Path) -> Result<Locations, String> {
    let config = root.join("storage-locations.json");
    match fs::read(&config) {
        Ok(bytes) => {
            let locations: Locations = serde_json::from_slice(&bytes).map_err(|_| format!("Configuração de armazenamento inválida: {}. Restaure esse arquivo antes de continuar.",config.display()))?;
            if !locations.data_dir.is_absolute() || !locations.backup_dir.is_absolute() {
                return Err("As pastas de armazenamento devem ser absolutas.".into());
            }
            Ok(locations)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Locations {
            data_dir: root.to_path_buf(),
            backup_dir: root.join("backups"),
        }),
        Err(e) => Err(format!(
            "Não foi possível ler a configuração de armazenamento: {e}"
        )),
    }
}
pub fn initialize(root: &Path) -> Result<Locations, String> {
    let locations = load(root)?;
    if !root.join("storage-locations.json").exists() {
        fs::create_dir_all(root).map_err(|e| e.to_string())?;
        database::init(&locations.data_dir.join("todo.db"))?;
        persist(root, &locations)?;
    }
    locations.database()?;
    Ok(locations)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("chrono-locations-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            Self(root)
        }
        fn folder(&self, name: &str) -> PathBuf {
            let path = self.0.join(name);
            fs::create_dir_all(&path).unwrap();
            path
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn migration_preserves_content_revision_undo_and_independent_backups() {
        let f = Fixture::new();
        let root = f.folder("original");
        let original = initialize(&root).unwrap();
        let source = original.database().unwrap();
        let mut data = database::load(&source).unwrap().data;
        data.projects.push(crate::model::Project {
            id: "project-1".into(),
            name: "Estudos".into(),
            color: "#7c3aed".into(),
        });
        database::save_in(&source, &original.backup_dir, data, 0, false).unwrap();
        let target = f.folder("Meus dados ação");
        let moved = change(&root, "data", &target).unwrap();
        assert_eq!(moved.backup_dir, original.backup_dir);
        assert_eq!(
            initialize(&root).unwrap().data_dir,
            fs::canonicalize(&target).unwrap()
        );
        let copied = database::load(&moved.database().unwrap()).unwrap();
        assert_eq!(copied.revision, 1);
        assert_eq!(copied.data.projects[0].name, "Estudos");
        assert!(copied.can_undo);
        assert!(database::undo(&moved.database().unwrap())
            .unwrap()
            .data
            .projects
            .is_empty());
        assert_eq!(database::load(&source).unwrap().data.projects.len(), 1);
        assert_eq!(
            change(&root, "data", &target).unwrap().data_dir,
            moved.data_dir
        );
    }
    #[test]
    fn all_backup_types_use_selected_folder() {
        let f = Fixture::new();
        let root = f.folder("original");
        let original = initialize(&root).unwrap();
        let old_backup = database::backup_in(
            &original.database().unwrap(),
            &original.backup_dir,
            "manual",
        )
        .unwrap();
        let destination = f.folder("backups");
        let selected = change(&root, "backup", &destination).unwrap();
        assert_eq!(selected.data_dir, original.data_dir);
        assert_eq!(
            initialize(&root).unwrap().backup_dir,
            fs::canonicalize(&destination).unwrap()
        );
        let path = selected.database().unwrap();
        database::save_in(
            &path,
            &selected.backup_dir,
            database::load(&path).unwrap().data,
            0,
            true,
        )
        .unwrap();
        database::backup_in(&path, &selected.backup_dir, "manual").unwrap();
        let files: Vec<_> = fs::read_dir(&destination)
            .unwrap()
            .map(|f| f.unwrap().path())
            .collect();
        for label in ["location-change", "before-import", "daily", "manual"] {
            assert!(files.iter().any(|f| f
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with(&format!("chrono-{label}-"))));
        }
        for file in files {
            crate::model::validate(&serde_json::from_slice(&fs::read(file).unwrap()).unwrap())
                .unwrap();
        }
        assert!(old_backup.exists());
    }
    #[test]
    fn refuses_existing_files_invalid_paths_and_missing_selected_database() {
        let f = Fixture::new();
        let root = f.folder("original");
        let original = initialize(&root).unwrap();
        let target = f.folder("target");
        fs::write(target.join("todo.db"), b"preserve me").unwrap();
        assert!(change(&root, "data", &target).is_err());
        assert_eq!(fs::read(target.join("todo.db")).unwrap(), b"preserve me");
        assert!(change(&root, "data", Path::new("relative")).is_err());
        assert!(change(&root, "backup", &f.0.join("missing")).is_err());
        assert_eq!(load(&root).unwrap().data_dir, original.data_dir);
        let destination = f.folder("valid");
        let moved = change(&root, "data", &destination).unwrap();
        fs::rename(moved.database().unwrap(), destination.join("preserved.db")).unwrap();
        assert!(initialize(&root).is_err());
        assert!(!destination.join("todo.db").exists());
        fs::write(root.join("storage-locations.json"), b"broken").unwrap();
        assert!(initialize(&root).is_err());
    }
    #[cfg(windows)]
    #[test]
    fn failed_config_commit_keeps_source_and_removes_new_database() {
        let f = Fixture::new();
        let root = f.folder("original");
        let original = initialize(&root).unwrap();
        let config = root.join("storage-locations.json");
        let permissions = fs::metadata(&config).unwrap().permissions();
        let mut readonly = permissions.clone();
        readonly.set_readonly(true);
        fs::set_permissions(&config, readonly).unwrap();
        let destination = f.folder("target");
        let result = change(&root, "data", &destination);
        fs::set_permissions(&config, permissions).unwrap();
        assert!(result.is_err());
        assert_eq!(load(&root).unwrap().data_dir, original.data_dir);
        assert!(original.database().unwrap().exists());
        assert!(!destination.join("todo.db").exists());
    }
}
fn persist(root: &Path, locations: &Locations) -> Result<(), String> {
    let temporary = root.join(format!("storage-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|e| e.to_string())?;
        serde_json::to_writer_pretty(&mut file, locations).map_err(|e| e.to_string())?;
        file.flush().map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(&temporary, root.join("storage-locations.json")).map_err(|e| {
            format!(
                "Não foi possível salvar as novas pastas; a configuração anterior foi mantida: {e}"
            )
        })
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
pub fn change(root: &Path, kind: &str, folder: &Path) -> Result<Locations, String> {
    if !["data", "backup"].contains(&kind) {
        return Err("Tipo de armazenamento inválido.".into());
    }
    if !folder.is_absolute() || !folder.is_dir() {
        return Err("Selecione uma pasta existente e acessível.".into());
    }
    let destination = fs::canonicalize(folder).map_err(|e| e.to_string())?;
    let mut locations = initialize(root)?;
    let source = locations.database()?;
    let current = if kind == "data" {
        &locations.data_dir
    } else {
        &locations.backup_dir
    };
    if fs::canonicalize(current).ok().as_ref() == Some(&destination) {
        return Ok(locations);
    }
    // Test write access without touching any existing file in the selected folder.
    let probe = destination.join(format!(".chrono-write-{}", uuid::Uuid::new_v4()));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|e| format!("Sem acesso de escrita à pasta: {e}"))?;
    let check = file.write_all(b"Chrono").and_then(|_| file.sync_all());
    drop(file);
    let _ = fs::remove_file(&probe);
    check.map_err(|e| e.to_string())?;
    if kind == "backup" {
        // Verify a complete backup before committing the new preference.
        database::backup_in(&source, &destination, "location-change")?;
        locations.backup_dir = destination;
    } else {
        let target = destination.join("todo.db");
        if target.exists()
            || destination.join("todo.db-wal").exists()
            || destination.join("todo.db-shm").exists()
        {
            return Err("A pasta já contém um banco Chrono. Escolha outra pasta; nenhum arquivo foi substituído.".into());
        }
        let temporary = destination.join(format!(".chrono-migrate-{}.db", uuid::Uuid::new_v4()));
        let result = (|| {
            // SQLite creates a consistent snapshot, including WAL content and undo history.
            let connection = rusqlite::Connection::open_with_flags(
                &source,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
            )
            .map_err(|e| e.to_string())?;
            connection
                .busy_timeout(std::time::Duration::from_secs(5))
                .map_err(|e| e.to_string())?;
            connection
                .execute(
                    "VACUUM INTO ?1",
                    [temporary.to_str().ok_or("Caminho inválido")?],
                )
                .map_err(|e| format!("Não foi possível copiar o banco: {e}"))?;
            let copied = database::load(&temporary)?;
            crate::model::validate(&copied.data)?;
            fs::OpenOptions::new()
                .read(true)
                .write(true)
                .open(&temporary)
                .and_then(|f| f.sync_all())
                .map_err(|e| e.to_string())?;
            // create_new refuses an existing destination, including a race. The locator
            // switches only after this complete, synchronized copy succeeds.
            let mut output = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&target)
                .map_err(|e| e.to_string())?;
            let copy = fs::File::open(&temporary)
                .and_then(|mut input| std::io::copy(&mut input, &mut output))
                .and_then(|_| output.sync_all());
            drop(output);
            if let Err(error) = copy {
                let _ = fs::remove_file(&target);
                return Err(error.to_string());
            }
            locations.data_dir = destination.clone();
            if let Err(error) = persist(root, &locations) {
                let _ = fs::remove_file(&target);
                return Err(error);
            }
            Ok(())
        })();
        let _ = fs::remove_file(&temporary);
        let _ = fs::remove_file(temporary.with_file_name(format!(
            "{}-wal",
            temporary.file_name().unwrap().to_string_lossy()
        )));
        let _ = fs::remove_file(temporary.with_file_name(format!(
            "{}-shm",
            temporary.file_name().unwrap().to_string_lossy()
        )));
        result?;
        return Ok(locations);
    }
    persist(root, &locations)?;
    Ok(locations)
}
