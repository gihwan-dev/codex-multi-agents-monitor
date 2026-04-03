use crate::{
    application,
    domain::session_score::{
        LoadProfileRevisionsQuery, LoadSessionScoresQuery, ProfileRevision, SaveSessionScoreInput,
        SessionScoreRecord,
    },
    state::archive_cache::ArchivedIndexCache,
};

#[tauri::command]
pub(crate) async fn save_session_score(
    input: SaveSessionScoreInput,
    cache: tauri::State<'_, ArchivedIndexCache>,
) -> Result<SessionScoreRecord, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        application::session_scoring::save_score(input)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string());

    clear_archived_index_cache_after_score_save(cache.inner(), result)
}

#[tauri::command]
pub(crate) async fn load_session_scores(
    query: Option<LoadSessionScoresQuery>,
) -> Result<Vec<SessionScoreRecord>, String> {
    let query = query.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || application::session_scoring::load_scores(query))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn load_profile_revisions(
    query: Option<LoadProfileRevisionsQuery>,
) -> Result<Vec<ProfileRevision>, String> {
    let query = query.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || {
        application::session_scoring::load_profile_revisions(query)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

fn clear_archived_index_cache_after_score_save(
    cache: &ArchivedIndexCache,
    result: Result<SessionScoreRecord, String>,
) -> Result<SessionScoreRecord, String> {
    if result.is_ok() {
        cache.clear();
    }

    result
}

#[cfg(test)]
mod tests {
    use super::clear_archived_index_cache_after_score_save;
    use crate::{
        domain::{
            session::SessionProvider,
            session_score::{ProfileSnapshot, SessionScoreRecord},
        },
        state::archive_cache::ArchivedIndexCache,
    };

    fn sample_score_record() -> SessionScoreRecord {
        SessionScoreRecord {
            provider: SessionProvider::Codex,
            session_id: "session-001".to_owned(),
            file_path: "/tmp/session-001.jsonl".to_owned(),
            workspace_path: "/tmp/workspace".to_owned(),
            session_score: None,
            profile_snapshot: ProfileSnapshot {
                revision: "rev-1".to_owned(),
                label: "Codex".to_owned(),
                provider: SessionProvider::Codex,
                main_model: None,
                guidance_hash: None,
                subagents: Vec::new(),
            },
        }
    }

    #[test]
    fn clears_archived_index_cache_after_successful_score_save() {
        let cache = ArchivedIndexCache::new();
        let populated = cache.populate_if_empty(vec![]);
        assert_eq!(populated, vec![]);
        assert!(cache.clone_entries().is_some());

        let result = clear_archived_index_cache_after_score_save(&cache, Ok(sample_score_record()));

        assert!(result.is_ok());
        assert!(cache.clone_entries().is_none());
    }

    #[test]
    fn keeps_archived_index_cache_when_score_save_fails() {
        let cache = ArchivedIndexCache::new();
        let populated = cache.populate_if_empty(vec![]);
        assert_eq!(populated, vec![]);
        assert!(cache.clone_entries().is_some());

        let result =
            clear_archived_index_cache_after_score_save(&cache, Err("save failed".to_owned()));

        assert_eq!(result, Err("save failed".to_owned()));
        assert!(cache.clone_entries().is_some());
    }
}
