use crate::state::AppState;

pub fn run_incremental_ingest(state: &AppState) {
    let _ = (
        state.monitor_db_path.as_path(),
        state.source_paths.live_sessions_dir.as_path(),
        state.source_paths.archived_sessions_dir.as_path(),
        state.source_paths.state_db_path.as_path(),
    );
    // Intentionally empty in initial setup. Ingestion is introduced in later slices.
}
