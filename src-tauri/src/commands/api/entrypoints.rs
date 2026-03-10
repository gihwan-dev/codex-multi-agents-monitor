use tauri::State;

use crate::commands::error::CommandError;
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;
use crate::state::AppState;

use super::history_summary::build_history_summary;
use super::live_overview::list_live_threads_from_db;
use super::thread_detail::{get_thread_detail_from_db, get_thread_drilldown_from_db};
use crate::domain::{HistorySummaryPayload, LiveOverviewThread, ThreadDetail, ThreadDrilldown};

#[tauri::command]
pub fn list_live_threads(
    state: State<'_, AppState>,
) -> Result<Vec<LiveOverviewThread>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    list_live_threads_from_db(&state)
}

#[tauri::command]
pub fn get_thread_detail(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadDetail>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    get_thread_detail_from_db(&state, &thread_id)
}

#[tauri::command]
pub fn get_thread_drilldown(
    thread_id: String,
    lane_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadDrilldown>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    get_thread_drilldown_from_db(&state, &thread_id, &lane_id)
}

#[tauri::command]
pub fn get_history_summary(
    state: State<'_, AppState>,
) -> Result<HistorySummaryPayload, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    build_history_summary(&state)
}
