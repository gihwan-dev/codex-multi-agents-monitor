use crate::domain::session::SessionProvider;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionScore {
    pub(crate) score: u8,
    pub(crate) note: Option<String>,
    pub(crate) scored_at: String,
    pub(crate) scored_by: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileAgentSnapshot {
    pub(crate) provider: SessionProvider,
    pub(crate) role: String,
    pub(crate) model: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileSnapshot {
    pub(crate) revision: String,
    pub(crate) label: String,
    pub(crate) provider: SessionProvider,
    pub(crate) main_model: Option<String>,
    pub(crate) guidance_hash: Option<String>,
    pub(crate) subagents: Vec<ProfileAgentSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProfileRevision {
    pub(crate) revision: String,
    pub(crate) label: String,
    pub(crate) session_count: usize,
    pub(crate) average_score: Option<f64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionScoreRecord {
    pub(crate) provider: SessionProvider,
    pub(crate) session_id: String,
    pub(crate) file_path: String,
    pub(crate) workspace_path: String,
    pub(crate) session_score: Option<SessionScore>,
    pub(crate) profile_snapshot: ProfileSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveSessionScoreInput {
    pub(crate) file_path: String,
    pub(crate) score: u8,
    pub(crate) note: Option<String>,
    pub(crate) scored_at: String,
    pub(crate) scored_by: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SessionScoreSortField {
    Score,
    ScoredAt,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SessionScoreSortDirection {
    Asc,
    Desc,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LoadSessionScoresQuery {
    pub(crate) file_path: Option<String>,
    pub(crate) workspace_path: Option<String>,
    pub(crate) profile_revision: Option<String>,
    pub(crate) min_score: Option<u8>,
    pub(crate) sort_by: Option<SessionScoreSortField>,
    pub(crate) sort_direction: Option<SessionScoreSortDirection>,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LoadProfileRevisionsQuery {
    pub(crate) workspace_path: Option<String>,
}
