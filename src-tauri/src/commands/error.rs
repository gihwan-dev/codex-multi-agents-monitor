use serde::{ser::Serializer, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("path does not exist: {0}")]
    PathNotFound(String),
    #[error("path is not a directory: {0}")]
    NotDirectory(String),
    #[error("path is not a file: {0}")]
    NotFile(String),
    #[error("failed to open path ({path}): {reason}")]
    OpenFailed { path: String, reason: String },
    #[error("internal error: {0}")]
    Internal(String),
}

#[derive(Debug, Serialize)]
pub struct CommandErrorPayload {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl CommandError {
    fn code(&self) -> &'static str {
        match self {
            Self::PathNotFound(_) => "path_not_found",
            Self::NotDirectory(_) => "not_directory",
            Self::NotFile(_) => "not_file",
            Self::OpenFailed { .. } => "open_failed",
            Self::Internal(_) => "internal",
        }
    }

    fn path(&self) -> Option<String> {
        match self {
            Self::PathNotFound(path) | Self::NotDirectory(path) | Self::NotFile(path) => {
                Some(path.clone())
            }
            Self::OpenFailed { path, .. } => Some(path.clone()),
            Self::Internal(_) => None,
        }
    }
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        CommandErrorPayload {
            code: self.code(),
            message: self.to_string(),
            path: self.path(),
        }
        .serialize(serializer)
    }
}
