use std::path::{Path, PathBuf};

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::commands::error::CommandError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ExpectedPathKind {
    Directory,
    File,
}

#[tauri::command]
pub fn open_workspace(app: AppHandle, path: String) -> Result<(), CommandError> {
    let workspace_path = PathBuf::from(path);
    validate_target_path(&workspace_path, ExpectedPathKind::Directory)?;
    app.opener()
        .open_path(workspace_path.display().to_string(), None::<&str>)
        .map_err(|error| map_opener_error(&workspace_path, error))
}

#[tauri::command]
pub fn open_log_file(app: AppHandle, path: String) -> Result<(), CommandError> {
    let log_path = PathBuf::from(path);
    validate_target_path(&log_path, ExpectedPathKind::File)?;
    // Keep log-file UX focused on "where is this file?" by revealing it in the parent directory.
    app.opener()
        .reveal_item_in_dir(&log_path)
        .map_err(|error| map_opener_error(&log_path, error))
}

pub(crate) fn validate_target_path(
    path: &Path,
    expected_kind: ExpectedPathKind,
) -> Result<(), CommandError> {
    if !path.exists() {
        return Err(CommandError::PathNotFound(path.display().to_string()));
    }

    if expected_kind == ExpectedPathKind::Directory && !path.is_dir() {
        return Err(CommandError::NotDirectory(path.display().to_string()));
    }

    if expected_kind == ExpectedPathKind::File && !path.is_file() {
        return Err(CommandError::NotFile(path.display().to_string()));
    }

    Ok(())
}

pub(crate) fn map_opener_error(path: &Path, error: tauri_plugin_opener::Error) -> CommandError {
    CommandError::OpenFailed {
        path: path.display().to_string(),
        reason: error.to_string(),
    }
}
