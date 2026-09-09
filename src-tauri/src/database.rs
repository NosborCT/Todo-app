use rusqlite::{Connection, Result};

pub fn init_database(db_path: &str) -> Result<()>{

    let connection = Connection::open(db_path)?;

    let migration = include_str!("../migrations/0001_create_tasks.sql");

    connection.execute_batch(migration)?;
    Ok(())
}
