use crate::{
    infrastructure::filesystem::recent_file_modified_at, support::error::map_sqlite_error,
};
use rusqlite::{Connection, OpenFlags};
use serde_json::Value;
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ThreadSubagentHint {
    pub(crate) rollout_path: String,
    pub(crate) edge_parent_thread_id: Option<String>,
    pub(crate) source_parent_thread_id: Option<String>,
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

pub(crate) fn load_thread_subagent_hints(codex_home: &Path) -> io::Result<Vec<ThreadSubagentHint>> {
    let state_database = resolve_codex_state_database(codex_home)?;
    let connection = open_state_connection(&state_database)?;
    let mut statement = prepare_thread_subagent_hints_query(&connection)?;
    let rows = statement
        .query_map([], map_thread_subagent_hint)
        .map_err(map_sqlite_error)?;

    collect_thread_subagent_hints(rows)
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

fn prepare_thread_subagent_hints_query(
    connection: &Connection,
) -> io::Result<rusqlite::Statement<'_>> {
    let has_thread_spawn_edges = table_exists(connection, "thread_spawn_edges")?;
    let query = if has_thread_spawn_edges {
        "SELECT t.id, t.rollout_path, t.source, e.parent_thread_id
         FROM threads t
         LEFT JOIN thread_spawn_edges e ON e.child_thread_id = t.id
         WHERE t.rollout_path != ''
         ORDER BY t.updated_at DESC, t.id DESC"
    } else {
        "SELECT id, rollout_path, source, NULL AS parent_thread_id
         FROM threads
         WHERE rollout_path != ''
         ORDER BY updated_at DESC, id DESC"
    };

    connection.prepare(query).map_err(map_sqlite_error)
}

fn map_live_thread_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LiveThreadRow> {
    Ok(LiveThreadRow {
        session_id: row.get(0)?,
        rollout_path: row.get(1)?,
        source: row.get(2)?,
        workspace_path: row.get(3)?,
    })
}

fn map_thread_subagent_hint(row: &rusqlite::Row<'_>) -> rusqlite::Result<ThreadSubagentHint> {
    let source: String = row.get(2)?;

    Ok(ThreadSubagentHint {
        rollout_path: row.get(1)?,
        edge_parent_thread_id: row.get(3)?,
        source_parent_thread_id: source_parent_thread_id(&source),
    })
}

fn collect_live_thread_rows(
    rows: rusqlite::MappedRows<
        '_,
        impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<LiveThreadRow>,
    >,
) -> io::Result<Vec<LiveThreadRow>> {
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(map_sqlite_error)?);
    }
    Ok(result)
}

fn collect_thread_subagent_hints(
    rows: rusqlite::MappedRows<
        '_,
        impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<ThreadSubagentHint>,
    >,
) -> io::Result<Vec<ThreadSubagentHint>> {
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(map_sqlite_error)?);
    }
    Ok(result)
}

fn table_exists(connection: &Connection, table_name: &str) -> io::Result<bool> {
    connection
        .query_row(
            "SELECT EXISTS(
                SELECT 1
                FROM sqlite_master
                WHERE type = 'table' AND name = ?1
            )",
            [table_name],
            |row| row.get::<_, i64>(0),
        )
        .map(|exists| exists != 0)
        .map_err(map_sqlite_error)
}

fn source_parent_thread_id(source: &str) -> Option<String> {
    let parsed = serde_json::from_str::<Value>(source).ok()?;
    parsed
        .get("subagent")
        .and_then(|subagent| subagent.get("thread_spawn"))
        .and_then(|thread_spawn| thread_spawn.get("parent_thread_id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
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
