use crate::{
    application,
    domain::session_score::{
        LoadProfileRevisionsQuery, LoadSessionScoresQuery, ProfileRevision, SaveSessionScoreInput,
        SessionScoreRecord,
    },
};

#[tauri::command]
pub(crate) async fn save_session_score(
    input: SaveSessionScoreInput,
) -> Result<SessionScoreRecord, String> {
    tauri::async_runtime::spawn_blocking(move || application::session_scoring::save_score(input))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
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
