mod commands;
mod domain;
mod events;
mod index_db;
mod ingest;
mod sources;
mod state;

use commands::{
    get_session_flow, get_session_lane_inspector, get_summary_dashboard, list_sessions,
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
            list_sessions,
            get_session_flow,
            get_session_lane_inspector,
            get_summary_dashboard,
            open_workspace,
            open_log_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
