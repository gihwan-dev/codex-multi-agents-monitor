use tauri::Manager;

pub mod codex_source;
pub mod ipc;
pub mod log_parser;
pub mod normalize;
pub mod repository;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state =
                ipc::build_app_state(app.handle()).map_err(Box::<dyn std::error::Error>::from)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::query_workspace_sessions,
            ipc::query_session_detail,
            ipc::start_live_bridge,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
