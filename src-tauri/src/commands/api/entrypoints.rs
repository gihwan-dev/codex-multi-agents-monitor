use std::time::Duration;

use tauri::State;

use crate::commands::error::CommandError;
use crate::domain::{
    SessionFlowPayload, SessionLaneInspectorPayload, SessionLaneRef, SessionListFilters,
    SessionListPayload, SessionScope, SummaryDashboardFilters, SummaryDashboardPayload,
};
use crate::ingest::refresh_monitor_snapshot_if_stale;
use crate::state::AppState;

use super::session_flow::get_session_flow_from_db;
use super::session_lane_inspector::get_session_lane_inspector_from_db;
use super::session_list::list_sessions_from_db;
use super::summary_dashboard::get_summary_dashboard_from_db;

const SNAPSHOT_MAX_AGE: Duration = Duration::from_secs(2);

fn refresh_monitor_snapshot(state: &AppState) -> Result<(), CommandError> {
    refresh_monitor_snapshot_if_stale(state, SNAPSHOT_MAX_AGE)
        .map_err(|error| CommandError::Internal(error.to_string()))
}

#[tauri::command]
pub fn list_sessions(
    scope: SessionScope,
    filters: Option<SessionListFilters>,
    state: State<'_, AppState>,
) -> Result<SessionListPayload, CommandError> {
    refresh_monitor_snapshot(&state)?;
    list_sessions_from_db(&state, scope, filters)
}

#[tauri::command]
pub fn get_session_flow(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Option<SessionFlowPayload>, CommandError> {
    refresh_monitor_snapshot(&state)?;
    get_session_flow_from_db(&state, &session_id)
}

#[tauri::command]
pub fn get_session_lane_inspector(
    session_id: String,
    lane_ref: SessionLaneRef,
    state: State<'_, AppState>,
) -> Result<Option<SessionLaneInspectorPayload>, CommandError> {
    refresh_monitor_snapshot(&state)?;
    get_session_lane_inspector_from_db(&state, &session_id, lane_ref)
}

#[tauri::command]
pub fn get_summary_dashboard(
    filters: Option<SummaryDashboardFilters>,
    state: State<'_, AppState>,
) -> Result<SummaryDashboardPayload, CommandError> {
    refresh_monitor_snapshot(&state)?;
    get_summary_dashboard_from_db(&state, filters)
}
