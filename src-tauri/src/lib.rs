mod commands;
mod domain;
mod events;
mod index_db;
mod ingest;
mod sources;
mod state;

use commands::{
    get_history_summary, get_session_flow, get_summary_dashboard, get_thread_detail,
    get_thread_drilldown, list_archived_sessions, list_live_threads,
    open_log_file, open_workspace,
};
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let _ = (
                events::THREADS_UPDATED,
                events::THREAD_UPDATED,
                events::INGEST_HEALTH,
            );
            let app_state = AppState::from_handle(app.handle())?;
            app.manage(app_state);
            Ok(())
        })
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_live_threads,
            list_archived_sessions,
            get_session_flow,
            get_summary_dashboard,
            get_thread_detail,
            get_thread_drilldown,
            get_history_summary,
            open_workspace,
            open_log_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
