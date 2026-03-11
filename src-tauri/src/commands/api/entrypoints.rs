use tauri::State;

use crate::commands::error::CommandError;
use crate::domain::{
    ArchiveListFilters, ArchivedSessionListPayload, HistorySummaryPayload, LiveOverviewThread,
    SessionFlowPayload, SummaryDashboardFilters, SummaryDashboardPayload, ThreadDetail,
    ThreadDrilldown,
};
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;
use crate::state::AppState;

use super::archive_list::list_archived_sessions_from_db;
use super::history_summary::build_history_summary;
use super::live_overview::list_live_threads_from_db;
use super::session_flow::get_session_flow_from_db;
use super::summary_dashboard::get_summary_dashboard_from_db;
use super::thread_detail::{get_thread_detail_from_db, get_thread_drilldown_from_db};

#[tauri::command]
pub fn list_live_threads(
    state: State<'_, AppState>,
) -> Result<Vec<LiveOverviewThread>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    list_live_threads_from_db(&state)
}

#[tauri::command]
pub fn list_archived_sessions(
    filters: Option<ArchiveListFilters>,
    state: State<'_, AppState>,
) -> Result<ArchivedSessionListPayload, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    list_archived_sessions_from_db(&state, filters)
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
pub fn get_session_flow(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<SessionFlowPayload>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    get_session_flow_from_db(&state, &thread_id)
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

#[tauri::command]
pub fn get_summary_dashboard(
    filters: Option<SummaryDashboardFilters>,
    state: State<'_, AppState>,
) -> Result<SummaryDashboardPayload, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    get_summary_dashboard_from_db(&state, filters)
}
