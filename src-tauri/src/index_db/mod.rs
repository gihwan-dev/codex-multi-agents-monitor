use anyhow::{Context, Result};
use rusqlite::Connection;

use crate::state::AppState;

pub fn init_monitor_db(state: &AppState) -> Result<()> {
    let connection = Connection::open(&state.monitor_db_path).with_context(|| {
        format!(
            "failed to open monitor db at {}",
            state.monitor_db_path.display()
        )
    })?;

    connection.execute_batch(
        "
        create table if not exists ingest_watermarks (
          source_path text primary key,
          inode text not null,
          byte_offset integer not null default 0,
          updated_at text not null
        );
        ",
    )?;

    Ok(())
}
