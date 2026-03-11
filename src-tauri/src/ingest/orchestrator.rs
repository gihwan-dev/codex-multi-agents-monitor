use std::time::{Duration, Instant};

use anyhow::Result;

use crate::index_db::init_monitor_db;
use crate::state::AppState;

pub fn rebuild_monitor_snapshot(state: &AppState) -> Result<()> {
    init_monitor_db(state)?;
    super::run_incremental_ingest(state)
}

pub fn refresh_monitor_snapshot_if_stale(
    state: &AppState,
    max_age: Duration,
) -> Result<()> {
    let mut last_refresh = state
        .last_snapshot_refresh_at
        .lock()
        .expect("last_snapshot_refresh_at lock poisoned");
    if let Some(last_refresh_at) = *last_refresh {
        if last_refresh_at.elapsed() < max_age {
            return Ok(());
        }
    }

    rebuild_monitor_snapshot(state)?;
    *last_refresh = Some(Instant::now());
    Ok(())
}
