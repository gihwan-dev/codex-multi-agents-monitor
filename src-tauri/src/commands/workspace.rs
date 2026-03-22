use crate::{application, domain::workspace::WorkspaceIdentity};
use std::collections::HashMap;

#[tauri::command]
pub(crate) fn resolve_workspace_identities(
    repo_paths: Vec<String>,
) -> HashMap<String, WorkspaceIdentity> {
    application::workspace_identity::resolve_workspace_identities(repo_paths)
}
