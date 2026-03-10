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

        create table if not exists threads (
          thread_id text primary key,
          title text not null,
          cwd text not null,
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

        create index if not exists idx_threads_updated_at on threads(updated_at desc);
        create index if not exists idx_agent_sessions_thread_depth_started_at
          on agent_sessions(thread_id, depth, started_at);
        ",
    )?;

    ensure_threads_columns(&connection)?;

    Ok(())
}

fn ensure_threads_columns(connection: &Connection) -> Result<()> {
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
