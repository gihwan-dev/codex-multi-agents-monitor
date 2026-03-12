use std::env;
use std::error::Error;
use std::ffi::OsStr;
use std::fmt;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use walkdir::WalkDir;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SourceKind {
    SessionLog,
    ArchiveLog,
}

impl SourceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SessionLog => "session_log",
            Self::ArchiveLog => "archive_log",
        }
    }
}

#[derive(Clone, Debug)]
pub struct CodexRoots {
    pub live_root: PathBuf,
    pub archived_root: PathBuf,
    pub global_state_path: PathBuf,
}

#[derive(Clone, Debug)]
pub struct SessionLogRef {
    pub path: PathBuf,
    pub source_kind: SourceKind,
    pub modified_at: SystemTime,
}

#[derive(Debug)]
pub enum SourceError {
    MissingHome,
    MissingPath(PathBuf),
    Metadata {
        path: PathBuf,
        source: io::Error,
    },
    Walk {
        root: PathBuf,
        source: walkdir::Error,
    },
}

impl fmt::Display for SourceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingHome => write!(f, "HOME is not set"),
            Self::MissingPath(path) => {
                write!(f, "required Codex path is missing: {}", path.display())
            }
            Self::Metadata { path, source } => {
                write!(
                    f,
                    "failed to read metadata for {}: {}",
                    path.display(),
                    source
                )
            }
            Self::Walk { root, source } => {
                write!(f, "failed to walk {}: {}", root.display(), source)
            }
        }
    }
}

impl Error for SourceError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Metadata { source, .. } => Some(source),
            Self::Walk { source, .. } => Some(source),
            Self::MissingHome | Self::MissingPath(_) => None,
        }
    }
}

pub fn detect_roots() -> Result<CodexRoots, SourceError> {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or(SourceError::MissingHome)?;
    let codex_root = home.join(".codex");
    let roots = CodexRoots {
        live_root: codex_root.join("sessions"),
        archived_root: codex_root.join("archived_sessions"),
        global_state_path: codex_root.join(".codex-global-state.json"),
    };

    for required in [
        &roots.live_root,
        &roots.archived_root,
        &roots.global_state_path,
    ] {
        if !required.exists() {
            return Err(SourceError::MissingPath(required.clone()));
        }
    }

    Ok(roots)
}

pub fn discover_session_logs(roots: &CodexRoots) -> Result<Vec<SessionLogRef>, SourceError> {
    let mut logs = Vec::new();
    logs.extend(discover_for_root(&roots.live_root, SourceKind::SessionLog)?);
    logs.extend(discover_for_root(
        &roots.archived_root,
        SourceKind::ArchiveLog,
    )?);
    logs.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    Ok(logs)
}

fn discover_for_root(
    root: &Path,
    source_kind: SourceKind,
) -> Result<Vec<SessionLogRef>, SourceError> {
    let mut logs = Vec::new();

    for entry in WalkDir::new(root) {
        let entry = entry.map_err(|source| SourceError::Walk {
            root: root.to_path_buf(),
            source,
        })?;
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.path().extension().and_then(OsStr::to_str) != Some("jsonl") {
            continue;
        }

        let path = entry.path().to_path_buf();
        let metadata = entry.metadata().map_err(|source| SourceError::Walk {
            root: root.to_path_buf(),
            source,
        })?;
        logs.push(SessionLogRef {
            path,
            source_kind,
            modified_at: metadata
                .modified()
                .map_err(|source| SourceError::Metadata {
                    path: entry.path().to_path_buf(),
                    source,
                })?,
        });
    }

    Ok(logs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_expected_codex_roots() {
        let roots = detect_roots().expect("expected local Codex roots to exist");
        assert!(roots.live_root.is_dir(), "missing live root");
        assert!(roots.archived_root.is_dir(), "missing archive root");
        assert!(
            roots.global_state_path.is_file(),
            "missing global state file"
        );
    }

    #[test]
    fn discovers_live_and_archived_logs() {
        let roots = detect_roots().expect("expected local Codex roots to exist");
        let logs = discover_session_logs(&roots).expect("expected log discovery to succeed");
        assert!(
            logs.iter()
                .any(|log| log.source_kind == SourceKind::SessionLog),
            "expected at least one live session log"
        );
        assert!(
            logs.iter()
                .any(|log| log.source_kind == SourceKind::ArchiveLog),
            "expected at least one archived session log"
        );
        assert!(
            logs.iter()
                .all(|log| log.path.extension().and_then(OsStr::to_str) == Some("jsonl")),
            "expected only jsonl logs"
        );
    }
}
