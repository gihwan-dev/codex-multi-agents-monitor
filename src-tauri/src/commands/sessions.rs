use crate::{
    application,
    domain::session::{ArchivedSessionIndexResult, RecentSessionIndexItem, SessionLogSnapshot},
    state::archive_cache::ArchivedIndexCache,
};

#[tauri::command]
pub(crate) async fn load_recent_session_index() -> Vec<RecentSessionIndexItem> {
    tauri::async_runtime::spawn_blocking(
        application::recent_sessions::load_recent_session_index_from_disk,
    )
    .await
    .ok()
    .and_then(Result::ok)
    .unwrap_or_default()
}

#[tauri::command]
pub(crate) async fn load_recent_session_snapshot(file_path: String) -> Option<SessionLogSnapshot> {
    tauri::async_runtime::spawn_blocking(move || {
        application::recent_sessions::load_recent_session_snapshot_from_disk(&file_path)
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
pub(crate) async fn load_archived_session_index(
    offset: usize,
    limit: usize,
    search: Option<String>,
    cache: tauri::State<'_, ArchivedIndexCache>,
) -> Result<ArchivedSessionIndexResult, String> {
    let index = match cache.clone_entries() {
        Some(index) => index,
        None => {
            let built = tauri::async_runtime::spawn_blocking(
                application::archived_sessions::build_archived_index,
            )
            .await
            .ok()
            .and_then(Result::ok)
            .unwrap_or_default();

            cache.populate_if_empty(built)
        }
    };

    Ok(application::archived_sessions::load_archived_session_index(
        offset, limit, search, &index,
    ))
}

#[tauri::command]
pub(crate) async fn load_archived_session_snapshot(
    file_path: String,
) -> Option<SessionLogSnapshot> {
    tauri::async_runtime::spawn_blocking(move || {
        application::archived_sessions::load_archived_session_snapshot_from_disk(&file_path)
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
pub(crate) fn refresh_archived_session_index(cache: tauri::State<'_, ArchivedIndexCache>) {
    cache.clear();
}
