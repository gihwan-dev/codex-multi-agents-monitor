use anyhow::{Context, Result};
use rusqlite::Connection;

use crate::state::AppState;

pub fn open_monitor_db(state: &AppState) -> Result<Connection> {
    Connection::open(&state.monitor_db_path).with_context(|| {
        format!(
            "failed to open monitor db at {}",
            state.monitor_db_path.display()
        )
    })
}

pub fn init_monitor_db(state: &AppState) -> Result<()> {
    let connection = open_monitor_db(state)?;

    connection.execute_batch(
        "
        create table if not exists ingest_watermarks (
          source_path text primary key,
          inode text not null,
          byte_offset integer not null default 0,
          updated_at text not null
        );

        create table if not exists ingest_source_health (
          source_key text primary key,
          status text not null check (status in ('missing', 'degraded'))
        );

        create table if not exists threads (
          thread_id text primary key,
          title text not null,
          cwd text not null,
          workspace_root text not null default '',
          rollout_path text not null default '',
          archived integer not null default 0,
          source_kind text not null default '',
          status text not null check (status in ('inflight', 'completed')),
          started_at text,
          updated_at text,
          latest_activity_summary text
        );

        create table if not exists agent_sessions (
          session_id text primary key,
          thread_id text not null,
          agent_role text not null,
          agent_nickname text,
          depth integer not null,
          started_at text,
          updated_at text,
          rollout_path text not null default '',
          cwd text not null default ''
        );

        create table if not exists timeline_events (
          event_id text primary key,
          thread_id text not null,
          agent_session_id text,
          kind text not null,
          started_at text not null,
          ended_at text,
          summary text
        );

        create table if not exists wait_spans (
          call_id text primary key,
          thread_id text not null,
          parent_session_id text not null,
          child_session_id text,
          started_at text not null,
          ended_at text,
          duration_ms integer
        );

        create table if not exists tool_spans (
          call_id text primary key,
          thread_id text not null,
          agent_session_id text,
          tool_name text not null,
          started_at text not null,
          ended_at text,
          duration_ms integer
        );

        create index if not exists idx_threads_updated_at on threads(updated_at desc);
        create index if not exists idx_agent_sessions_thread_depth_started_at
          on agent_sessions(thread_id, depth, started_at);
        create index if not exists idx_timeline_events_thread_started_at
          on timeline_events(thread_id, started_at, event_id);
        create index if not exists idx_wait_spans_thread_started_at
          on wait_spans(thread_id, started_at, call_id);
        create index if not exists idx_tool_spans_thread_started_at
          on tool_spans(thread_id, started_at, call_id);
        ",
    )?;

    ensure_threads_columns(&connection)?;

    Ok(())
}

fn ensure_threads_columns(connection: &Connection) -> Result<()> {
    add_column_if_missing(
        connection,
        "threads",
        "workspace_root",
        "text not null default ''",
    )?;
    add_column_if_missing(
        connection,
        "threads",
        "rollout_path",
        "text not null default ''",
    )?;
    add_column_if_missing(connection, "threads", "archived", "integer not null default 0")?;
    add_column_if_missing(
        connection,
        "threads",
        "source_kind",
        "text not null default ''",
    )?;
    backfill_threads_workspace_root(connection)?;
    Ok(())
}

fn backfill_threads_workspace_root(connection: &Connection) -> Result<()> {
    connection
        .execute(
            "
            update threads
            set workspace_root = cwd
            where trim(workspace_root) = ''
            ",
            [],
        )
        .with_context(|| "failed to backfill threads.workspace_root from cwd".to_string())?;
    Ok(())
}

fn add_column_if_missing(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    if has_column(connection, table, column)? {
        return Ok(());
    }

    let sql = format!("alter table {table} add column {column} {definition}");
    connection
        .execute(&sql, [])
        .with_context(|| format!("failed to add column {table}.{column}"))?;
    Ok(())
}

fn has_column(connection: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut statement = connection
        .prepare(&format!("pragma table_info({table})"))
        .with_context(|| format!("failed to inspect table schema: {table}"))?;
    let mut rows = statement.query([])?;

    while let Some(row) = rows.next()? {
        let current: String = row.get(1)?;
        if current == column {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::{Arc, Mutex};
    use std::time::{Instant, SystemTime, UNIX_EPOCH};

    use rusqlite::Connection;

    use crate::sources::SourcePaths;
    use crate::state::AppState;

    use super::init_monitor_db;

    #[test]
    fn init_monitor_db_backfills_workspace_root_for_legacy_threads() {
        let state = build_test_state("workspace-root-backfill");
        let connection = Connection::open(&state.monitor_db_path).expect("open legacy monitor db");
        connection
            .execute_batch(
                "
                create table threads (
                  thread_id text primary key,
                  title text not null,
                  cwd text not null,
                  status text not null,
                  started_at text,
                  updated_at text,
                  latest_activity_summary text
                );

                insert into threads (
                  thread_id,
                  title,
                  cwd,
                  status
                ) values ('thread-legacy', 'Legacy Thread', '/workspace/legacy', 'completed');
                ",
            )
            .expect("seed legacy threads table");

        init_monitor_db(&state).expect("initialize monitor db");

        let workspace_root: String = connection
            .query_row(
                "select workspace_root from threads where thread_id = ?1",
                ["thread-legacy"],
                |row| row.get(0),
            )
            .expect("read backfilled workspace_root");
        assert_eq!(workspace_root, "/workspace/legacy");
    }

    fn build_test_state(label: &str) -> AppState {
        let root_dir = std::env::temp_dir().join(format!(
            "codex-monitor-index-db-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be monotonic")
                .as_nanos()
        ));
        let live_sessions_dir = root_dir.join("sessions");
        fs::create_dir_all(&live_sessions_dir).expect("create live sessions dir");
        fs::File::create(root_dir.join("state_5.sqlite")).expect("create state db file");

        AppState {
            monitor_db_path: root_dir.join("monitor.db"),
            source_paths: SourcePaths {
                live_sessions_dir,
                state_db_path: root_dir.join("state_5.sqlite"),
            },
            last_snapshot_refresh_at: Arc::new(Mutex::new(Some(Instant::now()))),
        }
    }
}
