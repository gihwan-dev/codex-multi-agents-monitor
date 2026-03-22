use serde::Serialize;
use std::path::PathBuf;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceIdentity {
    pub(crate) origin_path: String,
    pub(crate) display_name: String,
    pub(crate) is_worktree: bool,
}

pub(crate) fn build_workspace_identity(
    origin_path: PathBuf,
    is_worktree: bool,
) -> WorkspaceIdentity {
    let display_name = origin_path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| origin_path.display().to_string());

    WorkspaceIdentity {
        origin_path: origin_path.display().to_string(),
        display_name,
        is_worktree,
    }
}
