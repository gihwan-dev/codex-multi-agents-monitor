mod application;
mod commands;
mod domain;
mod infrastructure;
mod state;
mod support;
#[cfg(test)]
mod test_support;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(state::archive_cache::ArchivedIndexCache::new())
        .invoke_handler(tauri::generate_handler![
            commands::sessions::load_recent_session_index,
            commands::sessions::load_recent_session_snapshot,
            commands::workspace::resolve_workspace_identities,
            commands::sessions::load_archived_session_index,
            commands::sessions::load_archived_session_snapshot,
            commands::sessions::refresh_archived_session_index,
            commands::sessions::scan_skill_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
