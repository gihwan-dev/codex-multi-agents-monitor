use crate::{
    infrastructure::filesystem::recent_file_modified_at, support::error::map_sqlite_error,
};
use rusqlite::{Connection, OpenFlags};
#[cfg(test)]
use std::collections::HashSet;
use std::{
    fs, io,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LiveThreadRow {
    pub(crate) session_id: String,
    pub(crate) rollout_path: String,
    pub(crate) source: String,
    pub(crate) workspace_path: String,
}

fn resolve_codex_state_database(codex_home: &Path) -> io::Result<PathBuf> {
    let mut candidates: Vec<PathBuf> = fs::read_dir(codex_home)?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| {
            path.extension().and_then(|value| value.to_str()) == Some("sqlite")
                && path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .is_some_and(|name| name == "state.sqlite" || name.starts_with("state_"))
        })
        .collect();

    candidates.sort_by(|left, right| {
        recent_file_modified_at(right)
            .cmp(&recent_file_modified_at(left))
            .then_with(|| right.cmp(left))
    });

    candidates.into_iter().next().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "codex state sqlite database missing",
        )
    })
}

pub(crate) fn load_live_thread_rows(codex_home: &Path) -> io::Result<Vec<LiveThreadRow>> {
    let state_database = resolve_codex_state_database(codex_home)?;
    let connection = open_state_connection(&state_database)?;
    let mut statement = prepare_live_thread_rows_query(&connection)?;
    let rows = statement
        .query_map([], map_live_thread_row)
        .map_err(map_sqlite_error)?;
    collect_live_thread_rows(rows)
}

fn open_state_connection(state_database: &Path) -> io::Result<Connection> {
    Connection::open_with_flags(
        state_database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(map_sqlite_error)
}

fn prepare_live_thread_rows_query(connection: &Connection) -> io::Result<rusqlite::Statement<'_>> {
    connection
        .prepare(
            "SELECT id, rollout_path, source, cwd
             FROM threads
             WHERE archived = 0
             ORDER BY updated_at DESC, id DESC",
        )
        .map_err(map_sqlite_error)
}

fn map_live_thread_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LiveThreadRow> {
    Ok(LiveThreadRow {
        session_id: row.get(0)?,
        rollout_path: row.get(1)?,
        source: row.get(2)?,
        workspace_path: row.get(3)?,
    })
}

fn collect_live_thread_rows(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<LiveThreadRow>>,
) -> io::Result<Vec<LiveThreadRow>> {
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(map_sqlite_error)?);
    }
    Ok(result)
}

#[cfg(test)]
pub(crate) fn load_archived_thread_ids(codex_home: &Path) -> io::Result<HashSet<String>> {
    let state_database = resolve_codex_state_database(codex_home)?;
    let connection = Connection::open_with_flags(
        state_database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(map_sqlite_error)?;
    let mut statement = connection
        .prepare("SELECT id FROM threads WHERE archived = 1")
        .map_err(map_sqlite_error)?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(map_sqlite_error)?;

    let mut archived_thread_ids = HashSet::new();
    for row in rows {
        archived_thread_ids.insert(row.map_err(map_sqlite_error)?);
    }

    Ok(archived_thread_ids)
}

#[cfg(test)]
mod tests {
    use super::load_archived_thread_ids;
    use crate::test_support::{create_state_database, TempDir};
    use std::{thread, time::Duration};

    #[test]
    fn loads_archived_thread_ids_from_latest_state_database() {
        let temp_dir = TempDir::new("state-database");
        let older_database = temp_dir.path.join("state_4.sqlite");
        let newer_database = temp_dir.path.join("state_5.sqlite");

        create_state_database(&older_database, &["old-archived"]);
        thread::sleep(Duration::from_millis(20));
        create_state_database(&newer_database, &["new-archived", "newer-archived"]);

        let archived_thread_ids =
            load_archived_thread_ids(&temp_dir.path).expect("archived thread ids should load");

        assert!(archived_thread_ids.contains("new-archived"));
        assert!(archived_thread_ids.contains("newer-archived"));
        assert!(!archived_thread_ids.contains("old-archived"));
    }
}
