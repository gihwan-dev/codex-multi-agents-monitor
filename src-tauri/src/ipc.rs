use std::collections::HashMap;
use std::error::Error;
use std::ffi::OsStr;
use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};
use tauri::{App, AppHandle, Emitter, Manager, Runtime, State};
use walkdir::WalkDir;

use crate::codex_source::{detect_roots, discover_session_logs, SessionLogRef, SourceError};
use crate::normalize::{normalize_session, NormalizeError};
use crate::repository::{
    Repository, RepositoryError, SessionDetailSnapshot, SessionSummary, WorkspaceSessionGroup,
};

pub const LIVE_SESSION_UPDATED_EVENT: &str = "codex://live-session-updated";

#[derive(Clone)]
pub struct MonitorState {
    db_path: PathBuf,
    shared: Arc<LiveBridgeShared>,
}

struct LiveBridgeShared {
    poller_started: AtomicBool,
    live_file_marks: Mutex<HashMap<PathBuf, SystemTime>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct WorkspaceSessionsSnapshot {
    pub refreshed_at: String,
    pub workspaces: Vec<WorkspaceSessionGroup>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionDetailQuery {
    pub session_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LiveSessionUpdate {
    pub refreshed_at: String,
    pub summary: SessionSummary,
}

#[derive(Debug)]
pub enum IpcError {
    Source(SourceError),
    Normalize(NormalizeError),
    Repository(RepositoryError),
    Io {
        path: PathBuf,
        source: io::Error,
    },
    Walk {
        root: PathBuf,
        source: walkdir::Error,
    },
    ThreadSpawn(io::Error),
    LockPoisoned(&'static str),
    Emit(tauri::Error),
}

impl fmt::Display for IpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Source(source) => write!(f, "source discovery failed: {}", source),
            Self::Normalize(source) => write!(f, "session normalization failed: {}", source),
            Self::Repository(source) => write!(f, "repository access failed: {}", source),
            Self::Io { path, source } => {
                write!(f, "file access failed for {}: {}", path.display(), source)
            }
            Self::Walk { root, source } => {
                write!(
                    f,
                    "live root walk failed for {}: {}",
                    root.display(),
                    source
                )
            }
            Self::ThreadSpawn(source) => write!(f, "live bridge thread spawn failed: {}", source),
            Self::LockPoisoned(name) => write!(f, "shared state lock poisoned: {}", name),
            Self::Emit(source) => write!(f, "live update emit failed: {}", source),
        }
    }
}

impl Error for IpcError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Source(source) => Some(source),
            Self::Normalize(source) => Some(source),
            Self::Repository(source) => Some(source),
            Self::Io { source, .. } => Some(source),
            Self::Walk { source, .. } => Some(source),
            Self::ThreadSpawn(source) => Some(source),
            Self::Emit(source) => Some(source),
            Self::LockPoisoned(_) => None,
        }
    }
}

impl MonitorState {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            db_path,
            shared: Arc::new(LiveBridgeShared {
                poller_started: AtomicBool::new(false),
                live_file_marks: Mutex::new(HashMap::new()),
            }),
        }
    }

    fn db_path(&self) -> &Path {
        &self.db_path
    }
}

pub fn build_app_state<R: Runtime>(app: &AppHandle<R>) -> Result<MonitorState, Box<dyn Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(MonitorState::new(
        app_data_dir.join("codex-monitor.sqlite3"),
    ))
}

pub fn initialize_state<R: Runtime>(app: &mut App<R>) -> Result<(), Box<dyn Error>> {
    app.manage(build_app_state(app.handle())?);
    Ok(())
}

#[tauri::command]
pub fn query_workspace_sessions(
    state: State<'_, MonitorState>,
) -> Result<WorkspaceSessionsSnapshot, String> {
    query_workspace_sessions_service(state.inner()).map_err(|source| source.to_string())
}

#[tauri::command]
pub fn query_workspace_sessions_cached(
    state: State<'_, MonitorState>,
) -> Result<WorkspaceSessionsSnapshot, String> {
    query_workspace_sessions_cached_service(state.inner()).map_err(|source| source.to_string())
}

#[tauri::command]
pub fn query_session_detail(
    query: SessionDetailQuery,
    state: State<'_, MonitorState>,
) -> Result<SessionDetailSnapshot, String> {
    query_session_detail_service(state.inner(), query).map_err(|source| source.to_string())
}

#[tauri::command]
pub fn start_live_bridge<R: Runtime + 'static>(
    app: AppHandle<R>,
    state: State<'_, MonitorState>,
) -> Result<(), String> {
    start_live_bridge_service(app, state.inner()).map_err(|source| source.to_string())
}

pub fn query_workspace_sessions_service(
    state: &MonitorState,
) -> Result<WorkspaceSessionsSnapshot, IpcError> {
    refresh_repository_from_discovery(state.db_path())?;
    query_workspace_sessions_cached_service(state)
}

pub fn query_workspace_sessions_cached_service(
    state: &MonitorState,
) -> Result<WorkspaceSessionsSnapshot, IpcError> {
    let repository = Repository::open(state.db_path()).map_err(IpcError::Repository)?;

    Ok(WorkspaceSessionsSnapshot {
        refreshed_at: repository
            .current_timestamp()
            .map_err(IpcError::Repository)?,
        workspaces: repository
            .list_workspace_sessions()
            .map_err(IpcError::Repository)?,
    })
}

pub fn query_session_detail_service(
    state: &MonitorState,
    query: SessionDetailQuery,
) -> Result<SessionDetailSnapshot, IpcError> {
    Repository::open(state.db_path())
        .map_err(IpcError::Repository)?
        .load_session_detail(&query.session_id)
        .map_err(IpcError::Repository)
}

pub fn start_live_bridge_service<R: Runtime + 'static>(
    app: AppHandle<R>,
    state: &MonitorState,
) -> Result<(), IpcError> {
    if state
        .shared
        .poller_started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    let roots = match detect_roots() {
        Ok(roots) => roots,
        Err(source) => {
            state.shared.poller_started.store(false, Ordering::SeqCst);
            return Err(IpcError::Source(source));
        }
    };
    let live_root = roots.live_root;
    let baseline = match discover_live_file_stamps(&live_root) {
        Ok(files) => files,
        Err(source) => {
            state.shared.poller_started.store(false, Ordering::SeqCst);
            return Err(source);
        }
    };

    {
        let mut marks = state
            .shared
            .live_file_marks
            .lock()
            .map_err(|_| IpcError::LockPoisoned("live_file_marks"))?;
        let _ = reconcile_live_file_stamps(&mut marks, &baseline, true);
    }

    let db_path = state.db_path.clone();
    let shared = Arc::clone(&state.shared);
    thread::Builder::new()
        .name("codex-live-bridge".to_string())
        .spawn(move || live_bridge_loop(app, db_path, live_root, shared))
        .map_err(|source| {
            state.shared.poller_started.store(false, Ordering::SeqCst);
            IpcError::ThreadSpawn(source)
        })?;

    Ok(())
}

fn refresh_repository_from_discovery(db_path: &Path) -> Result<(), IpcError> {
    let roots = detect_roots().map_err(IpcError::Source)?;
    let logs = discover_session_logs(&roots).map_err(IpcError::Source)?;
    let mut repository = Repository::open(db_path).map_err(IpcError::Repository)?;

    for log_ref in logs {
        let bundle = normalize_session(&log_ref).map_err(IpcError::Normalize)?;
        repository
            .upsert_session_bundle(&bundle)
            .map_err(IpcError::Repository)?;
    }

    Ok(())
}

fn live_bridge_loop<R: Runtime>(
    app: AppHandle<R>,
    db_path: PathBuf,
    live_root: PathBuf,
    shared: Arc<LiveBridgeShared>,
) {
    loop {
        if let Err(source) = poll_live_updates(&app, &db_path, &live_root, &shared) {
            eprintln!("live bridge poll failed: {}", source);
        }
        thread::sleep(Duration::from_millis(250));
    }
}

fn poll_live_updates<R: Runtime>(
    app: &AppHandle<R>,
    db_path: &Path,
    live_root: &Path,
    shared: &Arc<LiveBridgeShared>,
) -> Result<(), IpcError> {
    let live_files = discover_live_file_stamps(live_root)?;
    let changed = {
        let mut marks = shared
            .live_file_marks
            .lock()
            .map_err(|_| IpcError::LockPoisoned("live_file_marks"))?;
        reconcile_live_file_stamps(&mut marks, &live_files, false)
    };
    if changed.is_empty() {
        return Ok(());
    }

    let mut repository = Repository::open(db_path).map_err(IpcError::Repository)?;
    for live_file in changed {
        let log_ref = SessionLogRef {
            path: live_file.path,
            source_kind: crate::codex_source::SourceKind::SessionLog,
            modified_at: live_file.modified_at,
        };
        let bundle = normalize_session(&log_ref).map_err(IpcError::Normalize)?;
        let session_id = bundle.session.session_id.clone();

        repository
            .upsert_session_bundle(&bundle)
            .map_err(IpcError::Repository)?;

        if let Some(summary) = repository
            .load_session_summary(&session_id)
            .map_err(IpcError::Repository)?
        {
            let refreshed_at = repository
                .current_timestamp()
                .map_err(IpcError::Repository)?;
            app.emit(
                LIVE_SESSION_UPDATED_EVENT,
                LiveSessionUpdate {
                    refreshed_at,
                    summary,
                },
            )
            .map_err(IpcError::Emit)?;
        }
    }

    Ok(())
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct LiveFileStamp {
    path: PathBuf,
    modified_at: SystemTime,
}

fn discover_live_file_stamps(live_root: &Path) -> Result<Vec<LiveFileStamp>, IpcError> {
    let mut live_files = Vec::new();

    for entry in WalkDir::new(live_root) {
        let entry = entry.map_err(|source| IpcError::Walk {
            root: live_root.to_path_buf(),
            source,
        })?;
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.path().extension().and_then(OsStr::to_str) != Some("jsonl") {
            continue;
        }

        let path = entry.path().to_path_buf();
        let metadata = entry.metadata().map_err(|source| IpcError::Io {
            path: path.clone(),
            source: source.into(),
        })?;
        let modified_at = metadata.modified().map_err(|source| IpcError::Io {
            path: path.clone(),
            source,
        })?;
        live_files.push(LiveFileStamp { path, modified_at });
    }

    live_files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(live_files)
}

fn reconcile_live_file_stamps(
    cache: &mut HashMap<PathBuf, SystemTime>,
    current: &[LiveFileStamp],
    prime_only: bool,
) -> Vec<LiveFileStamp> {
    let mut next = HashMap::new();
    let mut changed = Vec::new();

    for file in current {
        match cache.get(&file.path) {
            Some(previous) if *previous == file.modified_at => {}
            _ if !prime_only => changed.push(file.clone()),
            _ => {}
        }
        next.insert(file.path.clone(), file.modified_at);
    }

    *cache = next;
    changed.sort_by(|left, right| left.path.cmp(&right.path));
    changed
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::time::UNIX_EPOCH;

    #[test]
    fn diff_helper_skips_unchanged_files() {
        let file = LiveFileStamp {
            path: PathBuf::from("/tmp/live-a.jsonl"),
            modified_at: UNIX_EPOCH + Duration::from_secs(10),
        };
        let mut cache = HashMap::from([(file.path.clone(), file.modified_at)]);

        let changed = reconcile_live_file_stamps(&mut cache, std::slice::from_ref(&file), false);

        assert!(changed.is_empty());
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn diff_helper_returns_exactly_one_modified_file() {
        let unchanged = LiveFileStamp {
            path: PathBuf::from("/tmp/live-a.jsonl"),
            modified_at: UNIX_EPOCH + Duration::from_secs(10),
        };
        let modified = LiveFileStamp {
            path: PathBuf::from("/tmp/live-b.jsonl"),
            modified_at: UNIX_EPOCH + Duration::from_secs(12),
        };
        let mut cache = HashMap::from([
            (unchanged.path.clone(), unchanged.modified_at),
            (modified.path.clone(), UNIX_EPOCH + Duration::from_secs(11)),
        ]);

        let changed =
            reconcile_live_file_stamps(&mut cache, &[unchanged.clone(), modified.clone()], false);

        assert_eq!(changed, vec![modified]);
        assert_eq!(cache.len(), 2);
    }
}
