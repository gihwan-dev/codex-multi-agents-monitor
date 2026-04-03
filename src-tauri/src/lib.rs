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
        .manage(state::live_session_subscriptions::LiveSessionSubscriptionRegistry::new())
        .invoke_handler(tauri::generate_handler![
            commands::eval::list_experiments,
            commands::eval::get_experiment_detail,
            commands::eval::create_experiment,
            commands::eval::update_experiment,
            commands::eval::delete_experiment,
            commands::eval::add_case,
            commands::eval::update_case,
            commands::eval::delete_case,
            commands::eval::save_candidate_run,
            commands::eval::run_grader,
            commands::eval::compare_candidates,
            commands::sessions::load_recent_session_index,
            commands::sessions::load_recent_session_snapshot,
            commands::sessions::start_recent_session_live_subscription,
            commands::sessions::stop_recent_session_live_subscription,
            commands::workspace::resolve_workspace_identities,
            commands::sessions::load_archived_session_index,
            commands::sessions::load_archived_session_snapshot,
            commands::sessions::refresh_archived_session_index,
            commands::sessions::scan_skill_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
