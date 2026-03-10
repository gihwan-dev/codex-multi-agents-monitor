use chrono::Utc;
use tauri::State;

use crate::commands::error::CommandError;
use crate::domain::{
    BottleneckSnapshot, HistorySummary, HistorySummaryPayload, MonitorThread, ThreadDetail,
};
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;
use crate::state::AppState;

#[tauri::command]
pub fn list_live_threads(state: State<'_, AppState>) -> Result<Vec<MonitorThread>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state);
    Ok(Vec::new())
}

#[tauri::command]
pub fn get_thread_detail(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadDetail>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state);
    let _ = thread_id;
    Ok(None)
}

#[tauri::command]
pub fn get_history_summary(
    state: State<'_, AppState>,
) -> Result<HistorySummaryPayload, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    let generated_at = Utc::now();
    Ok(HistorySummaryPayload {
        history: HistorySummary {
            from_date: generated_at.date_naive().to_string(),
            to_date: generated_at.date_naive().to_string(),
            average_duration_ms: None,
            timeout_count: 0,
            spawn_count: 0,
        },
        bottleneck: BottleneckSnapshot {
            generated_at,
            slow_threads: Vec::new(),
            longest_wait_ms: None,
        },
    })
}
