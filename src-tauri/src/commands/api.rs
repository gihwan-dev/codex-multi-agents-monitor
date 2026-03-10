use chrono::{DateTime, Utc};
use rusqlite::Connection;
use tauri::State;

use crate::commands::error::CommandError;
use crate::domain::{
    BottleneckSnapshot, HistorySummary, HistorySummaryPayload, MonitorThread, ThreadDetail,
};
use crate::domain::models::ThreadStatus;
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;
use crate::state::AppState;

fn parse_timestamp(value: Option<String>) -> Option<DateTime<Utc>> {
    value.and_then(|value| {
        DateTime::parse_from_rfc3339(&value)
            .ok()
            .map(|parsed| parsed.with_timezone(&Utc))
    })
}

fn list_threads_from_db(state: &AppState) -> Result<Vec<MonitorThread>, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              title,
              cwd,
              status,
              started_at,
              updated_at,
              latest_activity_summary
            from threads
            order by updated_at desc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            let status = match row.get::<_, String>(3)?.as_str() {
                "completed" => ThreadStatus::Completed,
                _ => ThreadStatus::Inflight,
            };

            Ok(MonitorThread {
                thread_id: row.get(0)?,
                title: row.get(1)?,
                cwd: row.get(2)?,
                status,
                started_at: parse_timestamp(row.get(4)?),
                updated_at: parse_timestamp(row.get(5)?),
                latest_activity_summary: row.get(6)?,
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut threads = Vec::new();
    for row in rows {
        threads.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }

    Ok(threads)
}

#[tauri::command]
pub fn list_live_threads(state: State<'_, AppState>) -> Result<Vec<MonitorThread>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    list_threads_from_db(&state)
}

#[tauri::command]
pub fn get_thread_detail(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadDetail>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
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
