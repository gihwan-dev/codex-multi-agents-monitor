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
          status text not null check (status in ('inflight', 'completed')),
          started_at text,
          updated_at text,
          latest_activity_summary text
        );

        create index if not exists idx_threads_updated_at on threads(updated_at desc);
        ",
    )?;

    Ok(())
}
