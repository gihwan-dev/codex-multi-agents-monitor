use std::cmp::Ordering;
use std::collections::HashMap;
use std::env;
use std::error::Error;
use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

use rusqlite::{Connection, OpenFlags};
use serde::Deserialize;

use crate::normalize::{
    CanonicalEvent, CanonicalSession, CanonicalSessionBundle, SessionStatus,
    SourceKind as CanonicalSourceKind,
};
use crate::repository::{SessionDetailSnapshot, SessionSummary, WorkspaceSessionGroup};

const DESKTOP_THREAD_SOURCE: &str = "vscode";
static DESKTOP_THREAD_CACHE: OnceLock<Mutex<Option<DesktopThreadIndex>>> = OnceLock::new();

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DesktopThreadIndex {
    by_session_id: HashMap<String, DesktopThreadMetadata>,
    session_id_by_rollout_path: HashMap<PathBuf, String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct DesktopThreadMetadata {
    rollout_path: PathBuf,
    workspace_path: String,
    title: Option<String>,
    first_user_message: Option<String>,
}

#[derive(Debug)]
pub enum DesktopThreadsError {
    MissingHome,
    MissingStateDatabase,
    Io {
        path: PathBuf,
        source: io::Error,
    },
    Sql {
        path: PathBuf,
        source: rusqlite::Error,
    },
    Json {
        path: PathBuf,
        source: serde_json::Error,
    },
}

impl fmt::Display for DesktopThreadsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingHome => write!(f, "HOME is not set"),
            Self::MissingStateDatabase => write!(f, "latest state_*.sqlite not found"),
            Self::Io { path, source } => {
                write!(
                    f,
                    "desktop thread metadata I/O failed for {}: {}",
                    path.display(),
                    source
                )
            }
            Self::Sql { path, source } => {
                write!(
                    f,
                    "desktop thread metadata SQL failed for {}: {}",
                    path.display(),
                    source
                )
            }
            Self::Json { path, source } => {
                write!(
                    f,
                    "desktop thread metadata JSON failed for {}: {}",
                    path.display(),
                    source
                )
            }
        }
    }
}

impl Error for DesktopThreadsError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            Self::Sql { source, .. } => Some(source),
            Self::Json { source, .. } => Some(source),
            Self::MissingHome | Self::MissingStateDatabase => None,
        }
    }
}

#[derive(Debug)]
struct DesktopThreadRow {
    session_id: String,
    rollout_path: String,
    cwd: String,
    title: Option<String>,
    first_user_message: Option<String>,
    archived: bool,
    source: Option<String>,
    agent_role: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GlobalState {
    #[serde(rename = "electron-saved-workspace-roots", default)]
    saved_workspace_roots: Vec<PathBuf>,
}

impl DesktopThreadIndex {
    pub fn filter_workspace_groups(
        &self,
        summaries: Vec<SessionSummary>,
    ) -> Vec<WorkspaceSessionGroup> {
        let mut visible = summaries
            .into_iter()
            .filter_map(|summary| self.enrich_summary(summary))
            .collect::<Vec<_>>();

        visible.sort_by(compare_workspace_summary);

        let mut groups: Vec<WorkspaceSessionGroup> = Vec::new();
        for summary in visible {
            let workspace_path = summary.workspace_path.clone();
            match groups.last_mut() {
                Some(group) if group.workspace_path == workspace_path => {
                    group.sessions.push(summary);
                }
                _ => groups.push(WorkspaceSessionGroup {
                    workspace_path,
                    sessions: vec![summary],
                }),
            }
        }

        groups
    }

    pub fn enrich_summary(&self, mut summary: SessionSummary) -> Option<SessionSummary> {
        let metadata = self.by_session_id.get(&summary.session_id)?;
        let existing_title = summary.title.take();

        summary.workspace_path = metadata.workspace_path.clone();
        summary.title = choose_title(
            metadata.title.clone(),
            metadata.first_user_message.clone(),
            existing_title,
        );
        summary.is_archived = false;
        summary.source_kind = CanonicalSourceKind::SessionLog;
        if summary.status == SessionStatus::Archived {
            summary.status = SessionStatus::Live;
        }

        Some(summary)
    }

    pub fn enrich_summary_for_rollout(
        &self,
        rollout_path: &Path,
        summary: SessionSummary,
    ) -> Option<SessionSummary> {
        let session_id = self.session_id_by_rollout_path.get(rollout_path)?;
        if session_id != &summary.session_id {
            return None;
        }

        self.enrich_summary(summary)
    }

    pub fn enrich_detail(&self, detail: &mut SessionDetailSnapshot) {
        let Some(metadata) = self.by_session_id.get(&detail.bundle.session.session_id) else {
            return;
        };

        let existing_title = detail.bundle.session.title.take();
        detail.bundle.session.workspace_path = metadata.workspace_path.clone();
        detail.bundle.session.title = choose_title(
            metadata.title.clone(),
            metadata.first_user_message.clone(),
            existing_title,
        );
        detail.bundle.session.is_archived = false;
        detail.bundle.session.source_kind = CanonicalSourceKind::SessionLog;
        if detail.bundle.session.status == SessionStatus::Archived {
            detail.bundle.session.status = SessionStatus::Live;
        }

        for session in &mut detail.timeline.sessions {
            if session.session_id != detail.bundle.session.session_id {
                continue;
            }

            let existing_timeline_title = session.title.take();
            session.workspace_path = metadata.workspace_path.clone();
            session.title = choose_title(
                metadata.title.clone(),
                metadata.first_user_message.clone(),
                existing_timeline_title,
            );
            session.is_archived = false;
            session.source_kind = CanonicalSourceKind::SessionLog;
            if session.status == SessionStatus::Archived {
                session.status = SessionStatus::Live;
            }
        }
    }
}

pub fn load_visible_desktop_threads() -> Option<DesktopThreadIndex> {
    match detect_desktop_paths() {
        Ok(Some((state_db_path, global_state_path, live_root))) => {
            match load_visible_desktop_threads_from_paths(
                &state_db_path,
                &global_state_path,
                &live_root,
            ) {
                Ok(index) => {
                    cache_desktop_threads(index.clone());
                    Some(index)
                }
                Err(source) => {
                    eprintln!("desktop thread metadata unavailable, reusing last-known-good index when possible: {source}");
                    cached_desktop_threads().or_else(|| Some(DesktopThreadIndex::default()))
                }
            }
        }
        Ok(None) => None,
        Err(source) => {
            eprintln!(
                "desktop thread discovery unavailable, reusing last-known-good index when possible: {source}"
            );
            cached_desktop_threads().or_else(|| Some(DesktopThreadIndex::default()))
        }
    }
}

fn desktop_thread_cache() -> &'static Mutex<Option<DesktopThreadIndex>> {
    DESKTOP_THREAD_CACHE.get_or_init(|| Mutex::new(None))
}

fn cache_desktop_threads(index: DesktopThreadIndex) {
    if let Ok(mut cache) = desktop_thread_cache().lock() {
        *cache = Some(index);
    }
}

fn cached_desktop_threads() -> Option<DesktopThreadIndex> {
    desktop_thread_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.clone())
}

fn clear_desktop_thread_cache() {
    if let Ok(mut cache) = desktop_thread_cache().lock() {
        *cache = None;
    }
}

pub fn load_visible_desktop_threads_from_paths(
    state_db_path: &Path,
    global_state_path: &Path,
    live_root: &Path,
) -> Result<DesktopThreadIndex, DesktopThreadsError> {
    let saved_workspace_roots = load_saved_workspace_roots(global_state_path)?;
    let rows = load_thread_rows(state_db_path)?;

    let mut by_session_id = HashMap::new();
    let mut session_id_by_rollout_path = HashMap::new();

    for row in rows {
        if row.archived {
            continue;
        }
        if row.source.as_deref() != Some(DESKTOP_THREAD_SOURCE) {
            continue;
        }
        if row
            .agent_role
            .as_deref()
            .map(str::trim)
            .is_some_and(|role| !role.is_empty())
        {
            continue;
        }

        let rollout_path = PathBuf::from(&row.rollout_path);
        if !rollout_path.starts_with(live_root) || !rollout_path.is_file() {
            continue;
        }

        let cwd = PathBuf::from(&row.cwd);
        let Some(workspace_root) = find_saved_workspace_root(&cwd, &saved_workspace_roots) else {
            continue;
        };

        let metadata = DesktopThreadMetadata {
            rollout_path: rollout_path.clone(),
            workspace_path: workspace_root.to_string_lossy().to_string(),
            title: normalize_metadata_value(row.title),
            first_user_message: normalize_metadata_value(row.first_user_message),
        };

        session_id_by_rollout_path.insert(rollout_path, row.session_id.clone());
        by_session_id.insert(row.session_id, metadata);
    }

    Ok(DesktopThreadIndex {
        by_session_id,
        session_id_by_rollout_path,
    })
}

fn detect_desktop_paths() -> Result<Option<(PathBuf, PathBuf, PathBuf)>, DesktopThreadsError> {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or(DesktopThreadsError::MissingHome)?;
    let codex_root = home.join(".codex");
    let global_state_path = codex_root.join(".codex-global-state.json");
    let live_root = codex_root.join("sessions");

    if !global_state_path.is_file() || !live_root.is_dir() {
        return Ok(None);
    }

    let Some(state_db_path) = find_latest_state_database(&codex_root)? else {
        return Ok(None);
    };

    Ok(Some((state_db_path, global_state_path, live_root)))
}

fn find_latest_state_database(codex_root: &Path) -> Result<Option<PathBuf>, DesktopThreadsError> {
    let entries = fs::read_dir(codex_root).map_err(|source| DesktopThreadsError::Io {
        path: codex_root.to_path_buf(),
        source,
    })?;
    let mut latest: Option<(PathBuf, SystemTime)> = None;

    for entry in entries {
        let entry = entry.map_err(|source| DesktopThreadsError::Io {
            path: codex_root.to_path_buf(),
            source,
        })?;
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.starts_with("state_") || !file_name.ends_with(".sqlite") {
            continue;
        }

        let metadata = entry.metadata().map_err(|source| DesktopThreadsError::Io {
            path: path.clone(),
            source,
        })?;
        let modified_at = metadata
            .modified()
            .map_err(|source| DesktopThreadsError::Io {
                path: path.clone(),
                source,
            })?;

        match &latest {
            Some((latest_path, latest_modified_at)) => {
                if modified_at > *latest_modified_at
                    || (modified_at == *latest_modified_at && path > *latest_path)
                {
                    latest = Some((path, modified_at));
                }
            }
            None => latest = Some((path, modified_at)),
        }
    }

    Ok(latest.map(|(path, _)| path))
}

fn load_saved_workspace_roots(
    global_state_path: &Path,
) -> Result<Vec<PathBuf>, DesktopThreadsError> {
    let raw = fs::read_to_string(global_state_path).map_err(|source| DesktopThreadsError::Io {
        path: global_state_path.to_path_buf(),
        source,
    })?;
    let state =
        serde_json::from_str::<GlobalState>(&raw).map_err(|source| DesktopThreadsError::Json {
            path: global_state_path.to_path_buf(),
            source,
        })?;

    Ok(state.saved_workspace_roots)
}

fn load_thread_rows(state_db_path: &Path) -> Result<Vec<DesktopThreadRow>, DesktopThreadsError> {
    let conn = Connection::open_with_flags(state_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|source| DesktopThreadsError::Sql {
            path: state_db_path.to_path_buf(),
            source,
        })?;
    let mut statement = conn
        .prepare(
            r#"
            SELECT
              id,
              rollout_path,
              cwd,
              title,
              first_user_message,
              archived,
              source,
              agent_role
            FROM threads
            "#,
        )
        .map_err(|source| DesktopThreadsError::Sql {
            path: state_db_path.to_path_buf(),
            source,
        })?;

    let rows = statement
        .query_map([], |row| {
            Ok(DesktopThreadRow {
                session_id: row.get(0)?,
                rollout_path: row.get(1)?,
                cwd: row.get(2)?,
                title: row.get(3)?,
                first_user_message: row.get(4)?,
                archived: row.get::<_, i64>(5)? != 0,
                source: row.get(6)?,
                agent_role: row.get(7)?,
            })
        })
        .map_err(|source| DesktopThreadsError::Sql {
            path: state_db_path.to_path_buf(),
            source,
        })?;

    rows.map(|row| {
        row.map_err(|source| DesktopThreadsError::Sql {
            path: state_db_path.to_path_buf(),
            source,
        })
    })
    .collect()
}

fn find_saved_workspace_root<'a>(cwd: &Path, saved_roots: &'a [PathBuf]) -> Option<&'a PathBuf> {
    saved_roots
        .iter()
        .filter(|root| cwd.starts_with(root))
        .max_by(|left, right| {
            left.components()
                .count()
                .cmp(&right.components().count())
                .then_with(|| left.cmp(right))
        })
}

fn normalize_metadata_value(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn choose_title(
    preferred_title: Option<String>,
    first_user_message: Option<String>,
    existing_title: Option<String>,
) -> Option<String> {
    normalize_metadata_value(preferred_title)
        .or_else(|| normalize_metadata_value(first_user_message))
        .or_else(|| normalize_metadata_value(existing_title))
}

fn activity_timestamp(summary: &SessionSummary) -> &str {
    summary
        .last_event_at
        .as_deref()
        .unwrap_or(summary.started_at.as_str())
}

fn compare_workspace_summary(left: &SessionSummary, right: &SessionSummary) -> Ordering {
    left.workspace_path
        .cmp(&right.workspace_path)
        .then_with(|| activity_timestamp(right).cmp(activity_timestamp(left)))
        .then_with(|| left.session_id.cmp(&right.session_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs::File;
    use std::time::UNIX_EPOCH;

    use rusqlite::params;
    use serde_json::json;

    use crate::normalize::{SessionStatus, SourceKind};
    use crate::repository::{
        PersistedSessionDetail, SessionTimelineSnapshot, TimelineLineageRelation,
    };

    struct TestFixture {
        root: PathBuf,
    }

    impl TestFixture {
        fn new(name: &str) -> Self {
            let unique = format!(
                "{}-{}-{}",
                name,
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("system time before unix epoch")
                    .as_nanos()
            );
            let root = env::temp_dir().join(format!("codex-monitor-{unique}"));
            fs::create_dir_all(&root).expect("create temp fixture directory");
            Self { root }
        }

        fn path(&self, relative: &str) -> PathBuf {
            self.root.join(relative)
        }
    }

    impl Drop for TestFixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn load_visible_threads_filters_archived_worker_and_outside_saved_roots() {
        let fixture = TestFixture::new("desktop-thread-visibility");
        let live_root = fixture.path("sessions");
        fs::create_dir_all(&live_root).expect("create live root");

        let saved_root = fixture.path("workspace-a");
        let nested_saved_root = saved_root.join("packages/app");
        let outside_root = fixture.path(".codex/worktrees/1234/workspace-a");
        fs::create_dir_all(&nested_saved_root).expect("create nested saved root");
        fs::create_dir_all(&outside_root).expect("create outside root");

        let global_state_path = fixture.path(".codex-global-state.json");
        fs::write(
            &global_state_path,
            serde_json::to_string(&json!({
                "electron-saved-workspace-roots": [saved_root],
            }))
            .expect("serialize global state"),
        )
        .expect("write global state");

        let state_db_path = fixture.path("state_9.sqlite");
        let conn = Connection::open(&state_db_path).expect("open state sqlite");
        conn.execute_batch(
            r#"
            CREATE TABLE threads (
              id TEXT PRIMARY KEY,
              rollout_path TEXT NOT NULL,
              cwd TEXT NOT NULL,
              title TEXT,
              first_user_message TEXT,
              archived INTEGER NOT NULL,
              source TEXT,
              agent_role TEXT
            );
            "#,
        )
        .expect("create threads table");

        let valid_rollout = live_root.join("rollout-valid.jsonl");
        let archived_rollout = live_root.join("rollout-archived.jsonl");
        let worker_rollout = live_root.join("rollout-worker.jsonl");
        let subagent_rollout = live_root.join("rollout-subagent.jsonl");
        let worktree_rollout = live_root.join("rollout-worktree.jsonl");

        for path in [
            &valid_rollout,
            &archived_rollout,
            &worker_rollout,
            &subagent_rollout,
            &worktree_rollout,
        ] {
            File::create(path).expect("create rollout log");
        }

        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 0, 'vscode', NULL)",
            params![
                "valid-thread",
                valid_rollout.to_string_lossy(),
                nested_saved_root.to_string_lossy(),
                "Visible title",
                "Visible first message",
            ],
        )
        .expect("insert valid thread");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 1, 'vscode', NULL)",
            params![
                "archived-thread",
                archived_rollout.to_string_lossy(),
                saved_root.to_string_lossy(),
                "Archived title",
                "Archived first message",
            ],
        )
        .expect("insert archived thread");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 0, 'vscode', 'worker')",
            params![
                "worker-thread",
                worker_rollout.to_string_lossy(),
                saved_root.to_string_lossy(),
                "Worker title",
                "Worker first message",
            ],
        )
        .expect("insert worker thread");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, NULL)",
            params![
                "subagent-thread",
                subagent_rollout.to_string_lossy(),
                saved_root.to_string_lossy(),
                "Subagent title",
                "Subagent first message",
                "{\"subagent\":{\"thread_spawn\":true}}",
            ],
        )
        .expect("insert subagent source thread");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 0, 'vscode', NULL)",
            params![
                "worktree-thread",
                worktree_rollout.to_string_lossy(),
                outside_root.to_string_lossy(),
                "Worktree title",
                "Worktree first message",
            ],
        )
        .expect("insert outside worktree thread");

        let index =
            load_visible_desktop_threads_from_paths(&state_db_path, &global_state_path, &live_root)
                .expect("load visible desktop threads");

        let visible_summary = index
            .enrich_summary(SessionSummary {
                session_id: "valid-thread".to_string(),
                parent_session_id: None,
                workspace_path: outside_root.to_string_lossy().to_string(),
                title: Some("Repo title".to_string()),
                status: SessionStatus::Live,
                source_kind: SourceKind::SessionLog,
                is_archived: false,
                started_at: "2026-03-13T10:00:00.000Z".to_string(),
                ended_at: None,
                last_event_at: Some("2026-03-13T10:05:00.000Z".to_string()),
                event_count: 3,
            })
            .expect("visible summary");

        assert_eq!(visible_summary.workspace_path, saved_root.to_string_lossy());
        assert_eq!(visible_summary.title.as_deref(), Some("Visible title"));
        assert!(!visible_summary.is_archived);
        assert_eq!(visible_summary.source_kind, SourceKind::SessionLog);
        assert!(index
            .enrich_summary_for_rollout(&valid_rollout, visible_summary.clone())
            .is_some());
        assert!(index
            .enrich_summary(SessionSummary {
                session_id: "archived-thread".to_string(),
                ..visible_summary.clone()
            })
            .is_none());
        assert!(index
            .enrich_summary(SessionSummary {
                session_id: "worker-thread".to_string(),
                ..visible_summary.clone()
            })
            .is_none());
        assert!(index
            .enrich_summary(SessionSummary {
                session_id: "subagent-thread".to_string(),
                ..visible_summary.clone()
            })
            .is_none());
        assert!(index
            .enrich_summary(SessionSummary {
                session_id: "worktree-thread".to_string(),
                ..visible_summary
            })
            .is_none());
    }

    #[test]
    fn enrichment_prefers_thread_title_then_first_user_message_then_existing_title() {
        let fixture = TestFixture::new("desktop-thread-enrichment");
        let live_root = fixture.path("sessions");
        let workspace_root = fixture.path("workspace-a");
        fs::create_dir_all(&live_root).expect("create live root");
        fs::create_dir_all(&workspace_root).expect("create workspace root");

        let title_rollout = live_root.join("rollout-title.jsonl");
        let message_rollout = live_root.join("rollout-message.jsonl");
        let existing_rollout = live_root.join("rollout-existing.jsonl");
        for path in [&title_rollout, &message_rollout, &existing_rollout] {
            File::create(path).expect("create rollout log");
        }

        let global_state_path = fixture.path(".codex-global-state.json");
        fs::write(
            &global_state_path,
            serde_json::to_string(&json!({
                "electron-saved-workspace-roots": [workspace_root],
            }))
            .expect("serialize global state"),
        )
        .expect("write global state");

        let state_db_path = fixture.path("state_10.sqlite");
        let conn = Connection::open(&state_db_path).expect("open state sqlite");
        conn.execute_batch(
            r#"
            CREATE TABLE threads (
              id TEXT PRIMARY KEY,
              rollout_path TEXT NOT NULL,
              cwd TEXT NOT NULL,
              title TEXT,
              first_user_message TEXT,
              archived INTEGER NOT NULL,
              source TEXT,
              agent_role TEXT
            );
            "#,
        )
        .expect("create threads table");

        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 0, 'vscode', NULL)",
            params![
                "title-thread",
                title_rollout.to_string_lossy(),
                workspace_root.to_string_lossy(),
                "Desktop title",
                "Desktop first message",
            ],
        )
        .expect("insert title thread");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, NULL, ?4, 0, 'vscode', NULL)",
            params![
                "message-thread",
                message_rollout.to_string_lossy(),
                workspace_root.to_string_lossy(),
                "Desktop first message only",
            ],
        )
        .expect("insert message thread");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, '   ', NULL, 0, 'vscode', NULL)",
            params![
                "existing-thread",
                existing_rollout.to_string_lossy(),
                workspace_root.to_string_lossy(),
            ],
        )
        .expect("insert existing thread");

        let index =
            load_visible_desktop_threads_from_paths(&state_db_path, &global_state_path, &live_root)
                .expect("load visible desktop threads");

        let title_summary = index
            .enrich_summary(make_summary("title-thread", Some("Repo title")))
            .expect("title summary");
        let message_summary = index
            .enrich_summary(make_summary("message-thread", Some("Repo title")))
            .expect("message summary");
        let existing_summary = index
            .enrich_summary(make_summary("existing-thread", Some("Repo title")))
            .expect("existing summary");

        assert_eq!(title_summary.title.as_deref(), Some("Desktop title"));
        assert_eq!(
            message_summary.title.as_deref(),
            Some("Desktop first message only")
        );
        assert_eq!(existing_summary.title.as_deref(), Some("Repo title"));

        let mut detail = make_detail("message-thread", Some("Repo detail title"));
        index.enrich_detail(&mut detail);
        assert_eq!(
            detail.bundle.session.title.as_deref(),
            Some("Desktop first message only")
        );
        assert_eq!(
            detail.timeline.sessions[0].workspace_path,
            workspace_root.to_string_lossy()
        );
        assert!(!detail.bundle.session.is_archived);
        assert_eq!(detail.bundle.session.source_kind, SourceKind::SessionLog);
    }

    #[test]
    fn load_visible_threads_reuses_last_known_good_index_after_failure() {
        let fixture = TestFixture::new("desktop-thread-cache");
        let live_root = fixture.path("sessions");
        let workspace_root = fixture.path("workspace-a");
        fs::create_dir_all(&live_root).expect("create live root");
        fs::create_dir_all(&workspace_root).expect("create workspace root");

        let rollout = live_root.join("rollout-cache.jsonl");
        File::create(&rollout).expect("create rollout");

        let global_state_path = fixture.path(".codex-global-state.json");
        fs::write(
            &global_state_path,
            serde_json::to_string(&json!({
                "electron-saved-workspace-roots": [workspace_root],
            }))
            .expect("serialize global state"),
        )
        .expect("write global state");

        let state_db_path = fixture.path("state_11.sqlite");
        let conn = Connection::open(&state_db_path).expect("open state sqlite");
        conn.execute_batch(
            r#"
            CREATE TABLE threads (
              id TEXT PRIMARY KEY,
              rollout_path TEXT NOT NULL,
              cwd TEXT NOT NULL,
              title TEXT,
              first_user_message TEXT,
              archived INTEGER NOT NULL,
              source TEXT,
              agent_role TEXT
            );
            "#,
        )
        .expect("create threads table");
        conn.execute(
            "INSERT INTO threads (id, rollout_path, cwd, title, first_user_message, archived, source, agent_role) VALUES (?1, ?2, ?3, ?4, ?5, 0, 'vscode', NULL)",
            params![
                "cached-thread",
                rollout.to_string_lossy(),
                workspace_root.to_string_lossy(),
                "Cached title",
                "Cached message",
            ],
        )
        .expect("insert visible thread");

        let index =
            load_visible_desktop_threads_from_paths(&state_db_path, &global_state_path, &live_root)
                .expect("load visible desktop threads");
        clear_desktop_thread_cache();
        cache_desktop_threads(index);

        let cached = cached_desktop_threads();
        assert!(cached.is_some());
        let summary = cached
            .expect("cached index")
            .enrich_summary(make_summary("cached-thread", Some("Repo title")));
        assert!(summary.is_some());
        clear_desktop_thread_cache();
    }

    fn make_summary(session_id: &str, title: Option<&str>) -> SessionSummary {
        SessionSummary {
            session_id: session_id.to_string(),
            parent_session_id: None,
            workspace_path: "/repo/logged".to_string(),
            title: title.map(str::to_string),
            status: SessionStatus::Live,
            source_kind: SourceKind::SessionLog,
            is_archived: false,
            started_at: "2026-03-13T09:00:00.000Z".to_string(),
            ended_at: None,
            last_event_at: Some("2026-03-13T09:05:00.000Z".to_string()),
            event_count: 2,
        }
    }

    fn make_detail(session_id: &str, title: Option<&str>) -> PersistedSessionDetail {
        let session = CanonicalSession {
            session_id: session_id.to_string(),
            parent_session_id: None,
            workspace_path: "/repo/logged".to_string(),
            title: title.map(str::to_string),
            status: SessionStatus::Live,
            started_at: "2026-03-13T09:00:00.000Z".to_string(),
            ended_at: None,
            is_archived: false,
            source_kind: SourceKind::SessionLog,
        };

        PersistedSessionDetail {
            bundle: CanonicalSessionBundle {
                session: session.clone(),
                events: vec![CanonicalEvent {
                    event_id: format!("{session_id}:0"),
                    session_id: session_id.to_string(),
                    parent_event_id: None,
                    agent_instance_id: Some(session_id.to_string()),
                    lane_id: "agent".to_string(),
                    kind: crate::normalize::EventKind::SessionStart,
                    detail_level: crate::normalize::DetailLevel::Operational,
                    occurred_at: "2026-03-13T09:00:00.000Z".to_string(),
                    duration_ms: None,
                    summary: None,
                    payload_preview: None,
                    payload_ref: None,
                    token_input: None,
                    token_output: None,
                    meta: Default::default(),
                }],
                metrics: Vec::new(),
            },
            last_event_at: Some("2026-03-13T09:05:00.000Z".to_string()),
            event_count: 1,
            timeline: SessionTimelineSnapshot {
                root_session_id: session_id.to_string(),
                sessions: vec![session],
                events: Vec::new(),
                lineage_relations: Vec::<TimelineLineageRelation>::new(),
            },
        }
    }
}
