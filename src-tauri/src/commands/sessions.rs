use crate::{
    application,
    domain::ingest_policy::ArchivedIndexQuery,
    domain::session::{
        ArchivedSessionIndex, ArchivedSessionIndexResult, RecentSessionIndexItem,
        SessionLogSnapshot, SkillActivityScanResult,
    },
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

#[derive(Debug, serde::Deserialize)]
pub(crate) struct ArchivedSessionQuery {
    offset: usize,
    limit: usize,
    search: Option<String>,
}

#[tauri::command]
pub(crate) async fn load_archived_session_index(
    query: ArchivedSessionQuery,
    cache: tauri::State<'_, ArchivedIndexCache>,
) -> Result<ArchivedSessionIndexResult, String> {
    let index = load_or_build_archived_index(cache).await;

    Ok(application::archived_sessions::load_archived_session_index(
        ArchivedIndexQuery {
            offset: query.offset,
            limit: query.limit,
            search: query.search,
            index: &index,
        },
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

#[tauri::command]
pub(crate) async fn scan_skill_activity(limit: usize) -> SkillActivityScanResult {
    tauri::async_runtime::spawn_blocking(move || {
        application::skill_activity::scan_skill_activity_from_disk(limit)
    })
    .await
    .ok()
    .and_then(Result::ok)
    .unwrap_or(SkillActivityScanResult { invocations: vec![] })
}

async fn load_or_build_archived_index(cache: tauri::State<'_, ArchivedIndexCache>) -> Vec<ArchivedSessionIndex> {
    match cache.clone_entries() {
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
    }
}
