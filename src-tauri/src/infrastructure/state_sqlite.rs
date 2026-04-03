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
    pub(crate) archived: bool,
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
    let archived_projection = if column_exists(connection, "threads", "archived")? {
        "COALESCE(archived, 0)"
    } else {
        "0"
    };

    let query = format!(
        "SELECT id, rollout_path, source, cwd, {archived_projection} AS archived
         FROM threads
         WHERE COALESCE(rollout_path, '') != ''
           AND COALESCE(cwd, '') != ''
           AND COALESCE(source, '') != ''
         ORDER BY COALESCE(updated_at, 0) DESC, id DESC"
    );

    connection.prepare(&query).map_err(map_sqlite_error)
}

fn prepare_thread_subagent_hints_query(
    connection: &Connection,
) -> io::Result<rusqlite::Statement<'_>> {
    let has_thread_spawn_edges = table_exists(connection, "thread_spawn_edges")?;
    let query = if has_thread_spawn_edges {
        "SELECT t.id, t.rollout_path, t.source, e.parent_thread_id
         FROM threads t
         LEFT JOIN thread_spawn_edges e ON e.child_thread_id = t.id
         WHERE COALESCE(t.rollout_path, '') != ''
           AND COALESCE(t.source, '') != ''
         ORDER BY COALESCE(t.updated_at, 0) DESC, t.id DESC"
    } else {
        "SELECT id, rollout_path, source, NULL AS parent_thread_id
         FROM threads
         WHERE COALESCE(rollout_path, '') != ''
           AND COALESCE(source, '') != ''
         ORDER BY COALESCE(updated_at, 0) DESC, id DESC"
    };

    connection.prepare(query).map_err(map_sqlite_error)
}

fn map_live_thread_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LiveThreadRow> {
    Ok(LiveThreadRow {
        session_id: row.get(0)?,
        rollout_path: row.get(1)?,
        source: row.get(2)?,
        workspace_path: row.get(3)?,
        archived: row.get::<_, i64>(4)? != 0,
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

fn column_exists(connection: &Connection, table_name: &str, column_name: &str) -> io::Result<bool> {
    connection
        .prepare(&format!("PRAGMA table_info({table_name})"))
        .map_err(map_sqlite_error)
        .and_then(|mut statement| {
            let rows = statement
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(map_sqlite_error)?;

            for row in rows {
                if row.map_err(map_sqlite_error)? == column_name {
                    return Ok(true);
                }
            }

            Ok(false)
        })
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
    if !column_exists(&connection, "threads", "archived")? {
        return Ok(HashSet::new());
    }
    let mut statement = connection
        .prepare("SELECT id FROM threads WHERE COALESCE(archived, 0) != 0")
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
    use super::{load_archived_thread_ids, load_live_thread_rows};
    use crate::test_support::{
        create_state_database, insert_thread_row_with_archive_flag, TempDir,
    };
    use rusqlite::Connection;
    use std::{path::Path, thread, time::Duration};

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

    #[test]
    fn loads_thread_rows_with_archived_flag() {
        let temp_dir = TempDir::new("state-thread-rows");
        let database = temp_dir.path.join("state.sqlite");
        let archived_rollout = temp_dir.path.join("archived.jsonl");
        let visible_rollout = temp_dir.path.join("visible.jsonl");
        let workspace_path = temp_dir.path.join("workspace");

        create_state_database(&database, &[]);
        insert_thread_row_with_archive_flag(
            &database,
            "session-archived",
            &archived_rollout,
            "exec",
            &workspace_path,
            2,
            true,
        );
        insert_thread_row_with_archive_flag(
            &database,
            "session-visible",
            &visible_rollout,
            "desktop",
            &workspace_path,
            1,
            false,
        );

        let rows = load_live_thread_rows(&temp_dir.path).expect("thread rows should load");

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].session_id, "session-archived");
        assert!(rows[0].archived);
        assert_eq!(rows[1].session_id, "session-visible");
        assert!(!rows[1].archived);
    }

    #[test]
    fn treats_missing_archived_column_as_unarchived() {
        let temp_dir = TempDir::new("state-no-archived-column");
        let database = temp_dir.path.join("state.sqlite");
        let rollout_path = temp_dir.path.join("visible.jsonl");
        let workspace_path = temp_dir.path.join("workspace");

        create_threads_database_without_archived_column(
            &database,
            "session-visible",
            &rollout_path,
            "desktop",
            &workspace_path,
        );

        let rows = load_live_thread_rows(&temp_dir.path).expect("thread rows should load");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].session_id, "session-visible");
        assert!(!rows[0].archived);
    }

    fn create_threads_database_without_archived_column(
        database: &Path,
        session_id: &str,
        rollout_path: &Path,
        source: &str,
        workspace_path: &Path,
    ) {
        let connection = Connection::open(database).expect("state database should open");
        connection
            .execute_batch(
                "CREATE TABLE threads (
                    id TEXT PRIMARY KEY,
                    rollout_path TEXT NOT NULL DEFAULT '',
                    updated_at INTEGER NOT NULL DEFAULT 0,
                    source TEXT NOT NULL DEFAULT '',
                    cwd TEXT NOT NULL DEFAULT '',
                    title TEXT NOT NULL DEFAULT '',
                    first_user_message TEXT NOT NULL DEFAULT ''
                );",
            )
            .expect("threads table should be created");
        connection
            .execute(
                "INSERT INTO threads (
                    id,
                    rollout_path,
                    updated_at,
                    source,
                    cwd
                ) VALUES (?1, ?2, 1, ?3, ?4)",
                (
                    session_id,
                    rollout_path.display().to_string(),
                    source,
                    workspace_path.display().to_string(),
                ),
            )
            .expect("thread row should be inserted");
    }
}
