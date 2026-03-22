use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    env,
    fs::{self, File},
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_RECENT_SESSIONS: usize = 24;
const RECENT_INDEX_PREFIX_SCAN_LIMIT: usize = 80;
const RECENT_INDEX_TAIL_ENTRY_LIMIT: usize = 120;
const RECENT_INDEX_TAIL_BYTES: u64 = 131_072;
const ARCHIVED_INDEX_SCAN_LIMIT: usize = 50;
const DEFAULT_THREAD_TITLE: &str = "새 스레드";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceIdentity {
    origin_path: String,
    display_name: String,
    is_worktree: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionEntrySnapshot {
    timestamp: String,
    entry_type: String,
    role: Option<String>,
    text: Option<String>,
    function_name: Option<String>,
    function_call_id: Option<String>,
    function_arguments_preview: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubagentSnapshot {
    session_id: String,
    parent_thread_id: String,
    depth: u32,
    agent_nickname: String,
    agent_role: String,
    model: Option<String>,
    started_at: String,
    updated_at: String,
    entries: Vec<SessionEntrySnapshot>,
    error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionLogSnapshot {
    session_id: String,
    forked_from_id: Option<String>,
    workspace_path: String,
    origin_path: String,
    display_name: String,
    started_at: String,
    updated_at: String,
    model: Option<String>,
    entries: Vec<SessionEntrySnapshot>,
    subagents: Vec<SubagentSnapshot>,
    is_archived: bool,
    prompt_assembly: Vec<PromptAssemblyLayer>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PromptAssemblyLayer {
    layer_type: String,
    label: String,
    content_length: usize,
    preview: String,
    raw_content: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentSessionIndexItem {
    session_id: String,
    workspace_path: String,
    origin_path: String,
    display_name: String,
    started_at: String,
    updated_at: String,
    model: Option<String>,
    file_path: String,
    first_user_message: Option<String>,
    title: String,
    status: String,
    last_event_summary: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchivedSessionIndex {
    session_id: String,
    workspace_path: String,
    origin_path: String,
    display_name: String,
    started_at: String,
    updated_at: String,
    model: Option<String>,
    message_count: u32,
    file_path: String,
    first_user_message: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchivedSessionIndexResult {
    items: Vec<ArchivedSessionIndex>,
    total: usize,
    has_more: bool,
}

struct ArchivedIndexCache(Mutex<Option<Vec<ArchivedSessionIndex>>>);

#[tauri::command]
fn resolve_workspace_identities(repo_paths: Vec<String>) -> HashMap<String, WorkspaceIdentity> {
    repo_paths
        .into_iter()
        .filter_map(|repo_path| {
            resolve_workspace_identity(Path::new(&repo_path))
                .ok()
                .map(|identity| (repo_path, identity))
        })
        .collect()
}

#[tauri::command]
async fn load_recent_session_index() -> Vec<RecentSessionIndexItem> {
    tauri::async_runtime::spawn_blocking(load_recent_session_index_from_disk)
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_default()
}

#[tauri::command]
async fn load_recent_session_snapshot(file_path: String) -> Option<SessionLogSnapshot> {
    tauri::async_runtime::spawn_blocking(move || load_recent_session_snapshot_from_disk(&file_path))
        .await
        .ok()
        .flatten()
}

fn resolve_workspace_identity(repo_path: &Path) -> io::Result<WorkspaceIdentity> {
    let git_metadata_path = repo_path.join(".git");
    if git_metadata_path.is_dir() {
        return Ok(build_workspace_identity(normalize_path(repo_path)?, false));
    }

    if git_metadata_path.is_file() {
        let git_dir = resolve_linked_git_dir(&git_metadata_path)?;
        let common_dir = resolve_common_dir(&git_dir)?;
        let origin_path = common_dir.parent().ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidData, "commondir has no repo parent")
        })?;

        return Ok(build_workspace_identity(normalize_path(origin_path)?, true));
    }

    Err(io::Error::new(
        io::ErrorKind::NotFound,
        ".git metadata missing",
    ))
}

fn load_recent_session_index_from_disk() -> io::Result<Vec<RecentSessionIndexItem>> {
    let codex_home = resolve_codex_home()?;
    let projects_root = resolve_projects_root()?;
    let sessions_root = codex_home.join("sessions");
    let archived_thread_ids = load_archived_thread_ids(&codex_home).unwrap_or_default();
    let mut session_files = Vec::new();
    collect_jsonl_files(&sessions_root, &mut session_files)?;
    sort_session_files_by_recent_activity(&mut session_files);

    let mut items = Vec::new();

    for session_file in &session_files {
        if items.len() >= MAX_RECENT_SESSIONS {
            continue;
        }

        let item = match read_recent_index_entry(session_file, &projects_root) {
            Ok(Some(item)) => item,
            Ok(None) => continue,
            Err(_) => continue,
        };

        if archived_thread_ids.contains(&item.session_id) {
            continue;
        }

        items.push(item);
    }

    Ok(items)
}

fn load_archived_thread_ids(codex_home: &Path) -> io::Result<HashSet<String>> {
    let state_database = resolve_codex_state_database(codex_home)?;
    let connection = Connection::open_with_flags(
        state_database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(map_sqlite_error)?;
    let mut statement = connection
        .prepare("SELECT id FROM threads WHERE archived = 1")
        .map_err(map_sqlite_error)?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(map_sqlite_error)?;

    let mut archived_thread_ids = HashSet::new();
    for row in rows {
        archived_thread_ids.insert(row.map_err(map_sqlite_error)?);
    }

    Ok(archived_thread_ids)
}

fn resolve_codex_state_database(codex_home: &Path) -> io::Result<PathBuf> {
    let mut candidates: Vec<PathBuf> = fs::read_dir(codex_home)?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| {
            path.extension().and_then(|value| value.to_str()) == Some("sqlite")
                && path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .is_some_and(|name| name == "state.sqlite" || name.starts_with("state_"))
        })
        .collect();

    candidates.sort_by(|left, right| {
        recent_file_modified_at(right)
            .cmp(&recent_file_modified_at(left))
            .then_with(|| right.cmp(left))
    });

    candidates.into_iter().next().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "codex state sqlite database missing",
        )
    })
}

fn map_sqlite_error(error: rusqlite::Error) -> io::Error {
    io::Error::other(error)
}

fn sort_session_files_by_recent_activity(files: &mut [PathBuf]) {
    files.sort_by(|left, right| {
        recent_file_modified_at(right)
            .cmp(&recent_file_modified_at(left))
            .then_with(|| right.cmp(left))
    });
}

fn recent_file_modified_at(path: &Path) -> SystemTime {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(UNIX_EPOCH)
}

fn collect_jsonl_files(directory: &Path, files: &mut Vec<PathBuf>) -> io::Result<()> {
    if !directory.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            collect_jsonl_files(&path, files)?;
            continue;
        }

        if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }

    Ok(())
}

fn load_recent_session_snapshot_from_disk(file_path: &str) -> Option<SessionLogSnapshot> {
    let codex_home = resolve_codex_home().ok()?;
    let projects_root = resolve_projects_root().ok()?;
    let sessions_root = codex_home.join("sessions");
    let path = Path::new(file_path);

    let canonical_path = fs::canonicalize(path).ok()?;
    let canonical_root = fs::canonicalize(&sessions_root).ok()?;
    if !canonical_path.starts_with(&canonical_root) {
        return None;
    }

    let archived_thread_ids = load_archived_thread_ids(&codex_home).unwrap_or_default();
    let mut snapshot = read_session_snapshot(&canonical_path, &projects_root).ok()??;
    if archived_thread_ids.contains(&snapshot.session_id) {
        return None;
    }

    let mut session_files = Vec::new();
    collect_jsonl_files(&sessions_root, &mut session_files).ok()?;

    for session_file in &session_files {
        if fs::canonicalize(session_file).ok().as_ref() == Some(&canonical_path) {
            continue;
        }

        if let Ok(Some(sub)) = read_subagent_snapshot(session_file) {
            if sub.parent_thread_id == snapshot.session_id
                || snapshot
                    .forked_from_id
                    .as_ref()
                    .is_some_and(|fid| sub.parent_thread_id == *fid)
            {
                snapshot.subagents.push(sub);
            }
        }
    }

    Some(snapshot)
}

fn read_recent_index_entry(
    session_file: &Path,
    projects_root: &Path,
) -> io::Result<Option<RecentSessionIndexItem>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = match session_meta.get("payload").and_then(Value::as_object) {
        Some(payload) => payload,
        None => return Ok(None),
    };

    if payload
        .get("source")
        .and_then(|source| source.get("subagent"))
        .is_some()
    {
        return Ok(None);
    }

    if payload.get("source").and_then(Value::as_str).is_none() {
        return Ok(None);
    }

    let workspace_path = payload
        .get("cwd")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "session cwd missing"))?;
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();
    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());

    let workspace_identity =
        resolve_live_session_workspace_identity(Path::new(workspace_path), projects_root).ok();
    let Some(workspace_identity) = workspace_identity else {
        return Ok(None);
    };

    let mut prefix_entries = Vec::new();
    let mut model: Option<String> = None;
    for line in reader
        .lines()
        .take(RECENT_INDEX_PREFIX_SCAN_LIMIT)
        .flatten()
    {
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if model.is_none() {
            model = extract_turn_context_model(&entry);
        }

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            prefix_entries.push(snapshot_entry);
        }
    }

    let tail_entries = read_tail_entry_snapshots(
        session_file,
        RECENT_INDEX_TAIL_BYTES,
        RECENT_INDEX_TAIL_ENTRY_LIMIT,
    )?;
    let title = derive_recent_index_title(&prefix_entries);
    let first_user_message = extract_first_user_message(&prefix_entries);
    let updated_at = tail_entries
        .last()
        .map(|entry| entry.timestamp.clone())
        .unwrap_or_else(|| started_at.clone());
    let status = derive_recent_index_status(&tail_entries);
    let last_event_summary = derive_recent_index_last_summary(&tail_entries);

    Ok(Some(RecentSessionIndexItem {
        session_id,
        workspace_path: workspace_path.to_owned(),
        origin_path: workspace_identity.origin_path,
        display_name: workspace_identity.display_name,
        started_at,
        updated_at,
        model,
        file_path: session_file.display().to_string(),
        first_user_message,
        title,
        status,
        last_event_summary,
    }))
}

fn read_subagent_snapshot(session_file: &Path) -> io::Result<Option<SubagentSnapshot>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "payload missing"))?;

    let thread_spawn = payload
        .get("source")
        .and_then(|s| s.get("subagent"))
        .and_then(|s| s.get("thread_spawn"))
        .and_then(Value::as_object);

    let thread_spawn = match thread_spawn {
        Some(ts) => ts,
        None => return Ok(None),
    };

    let parent_thread_id = thread_spawn
        .get("parent_thread_id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let depth = thread_spawn
        .get("depth")
        .and_then(Value::as_u64)
        .unwrap_or(1) as u32;
    let agent_nickname = thread_spawn
        .get("agent_nickname")
        .and_then(Value::as_str)
        .unwrap_or("Subagent")
        .to_owned();
    let agent_role = thread_spawn
        .get("agent_role")
        .or_else(|| thread_spawn.get("subagent_type"))
        .and_then(Value::as_str)
        .unwrap_or("agent")
        .to_owned();

    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;
    let mut error: Option<String> = None;

    // Fork context boundary: when a second session_meta is detected (parent's
    // session_meta copied into the forked JSONL), skip entries until we find
    // the subagent's own task_started. Detection: a new task_started appearing
    // while a previous turn is still open (no task_complete) means we've reached
    // the subagent's own turn — the parent's last turn in the fork context is
    // always incomplete (still active when the subagent was spawned).
    let mut past_fork_boundary = true;
    let mut has_open_turn = false;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if entry.get("type").and_then(Value::as_str) == Some("session_meta") {
            past_fork_boundary = false;
            continue;
        }

        if !past_fork_boundary {
            let payload_type = entry
                .get("payload")
                .and_then(|p| p.get("type"))
                .and_then(Value::as_str);
            match payload_type {
                Some("task_started") => {
                    if has_open_turn {
                        past_fork_boundary = true;
                    }
                    has_open_turn = true;
                }
                Some("task_complete") => {
                    has_open_turn = false;
                }
                _ => {}
            }
        }

        // Always take the latest model from turn_context — the subagent's own
        // turn_context (which comes last) has the actual model.
        if let Some("turn_context") = entry.get("type").and_then(Value::as_str) {
            if let Some(m) = entry
                .get("payload")
                .and_then(|p| p.get("model"))
                .and_then(Value::as_str)
                .filter(|v| !v.trim().is_empty())
            {
                model = Some(m.to_owned());
            }
        }

        if past_fork_boundary {
            if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
                updated_at = snapshot_entry.timestamp.clone();
                entries.push(snapshot_entry);
            } else if error.is_none() {
                error = extract_error_hint(&entry);
            }
        }
    }

    Ok(Some(SubagentSnapshot {
        session_id,
        parent_thread_id,
        depth,
        agent_nickname,
        agent_role,
        model,
        started_at,
        updated_at,
        entries,
        error,
    }))
}

fn read_session_snapshot(
    session_file: &Path,
    projects_root: &Path,
) -> io::Result<Option<SessionLogSnapshot>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidData, "session meta payload missing")
        })?;

    if payload.get("source").and_then(Value::as_str).is_none() {
        return Ok(None);
    }

    let workspace_path = payload
        .get("cwd")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "session cwd missing"))?;
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();
    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let forked_from_id = payload
        .get("forked_from_id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned);

    let mut prompt_assembly = Vec::new();

    // Extract base_instructions from session_meta
    if let Some(bi_text) = payload
        .get("base_instructions")
        .and_then(|bi| bi.get("text"))
        .and_then(Value::as_str)
    {
        prompt_assembly.push(PromptAssemblyLayer {
            layer_type: "system".to_owned(),
            label: "Base Instructions".to_owned(),
            content_length: bi_text.len(),
            preview: truncate_utf8_safe(bi_text, 120),
            raw_content: bi_text.to_owned(),
        });
    }

    let workspace_identity =
        resolve_live_session_workspace_identity(Path::new(workspace_path), projects_root).ok();
    let Some(workspace_identity) = workspace_identity else {
        return Ok(None);
    };

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;
    let mut prompt_assembly_done = false;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if model.is_none() {
            if let Some("turn_context") = entry.get("type").and_then(Value::as_str) {
                model = entry
                    .get("payload")
                    .and_then(|p| p.get("model"))
                    .and_then(Value::as_str)
                    .filter(|v| !v.trim().is_empty())
                    .map(ToOwned::to_owned);
            }
        }

        // Stop extracting prompt assembly after first task_complete (end of first turn)
        if !prompt_assembly_done {
            if let Some(payload) = entry.get("payload").and_then(Value::as_object) {
                if payload.get("type").and_then(Value::as_str) == Some("task_complete") {
                    prompt_assembly_done = true;
                }
            }
        }

        if !prompt_assembly_done
            && entry.get("type").and_then(Value::as_str) == Some("response_item")
        {
            extract_prompt_layers(&entry, &mut prompt_assembly);
        }

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            updated_at = snapshot_entry.timestamp.clone();
            entries.push(snapshot_entry);
        }
    }

    Ok(Some(SessionLogSnapshot {
        session_id,
        forked_from_id,
        workspace_path: workspace_path.to_owned(),
        origin_path: workspace_identity.origin_path,
        display_name: workspace_identity.display_name,
        started_at,
        updated_at,
        model,
        entries,
        subagents: Vec::new(),
        is_archived: false,
        prompt_assembly,
    }))
}

fn resolve_live_session_workspace_identity(
    workspace_path: &Path,
    projects_root: &Path,
) -> io::Result<WorkspaceIdentity> {
    if is_conductor_workspace_path(workspace_path) {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "conductor workspaces are excluded from live sessions",
        ));
    }

    let workspace_identity = resolve_session_workspace_identity(workspace_path, projects_root)?;
    if !Path::new(&workspace_identity.origin_path).exists() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "live session workspace origin missing",
        ));
    }

    Ok(workspace_identity)
}

fn resolve_session_workspace_identity(
    workspace_path: &Path,
    projects_root: &Path,
) -> io::Result<WorkspaceIdentity> {
    let normalized_projects_root =
        normalize_path(projects_root).unwrap_or_else(|_| projects_root.to_path_buf());

    if let Ok(identity) = resolve_workspace_identity(workspace_path) {
        if Path::new(&identity.origin_path).starts_with(&normalized_projects_root) {
            return Ok(identity);
        }
    }

    let inferred_origin = infer_projects_origin(workspace_path, &normalized_projects_root)
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "workspace does not resolve into Documents/Projects",
            )
        })?;

    Ok(build_workspace_identity(
        inferred_origin.clone(),
        inferred_origin != workspace_path,
    ))
}

fn infer_projects_origin(workspace_path: &Path, projects_root: &Path) -> Option<PathBuf> {
    let normalized_workspace = normalize_path(workspace_path).ok()?;
    let normalized_projects_root =
        normalize_path(projects_root).unwrap_or_else(|_| projects_root.to_path_buf());

    let workspace_file_name = normalized_workspace.file_name()?.to_str()?;

    let candidate = if normalized_workspace.starts_with(&normalized_projects_root) {
        normalized_workspace
    } else {
        normalized_projects_root.join(workspace_file_name)
    };

    let normalized_candidate = normalize_path(&candidate).unwrap_or(candidate);
    if normalized_candidate.starts_with(&normalized_projects_root) {
        Some(normalized_candidate)
    } else {
        None
    }
}

fn is_conductor_workspace_path(workspace_path: &Path) -> bool {
    let segments: Vec<&str> = workspace_path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect();

    segments
        .windows(4)
        .any(|window| matches!(window, ["conductor", "workspaces", _, _]))
}

fn classify_developer_content(text: &str) -> (String, String) {
    if text.starts_with("<permissions") {
        ("permissions".into(), "Permissions & Sandbox".into())
    } else if text.starts_with("<app-context>") {
        ("app-context".into(), "App Context".into())
    } else if text.starts_with("<collaboration_mode>") {
        ("collaboration-mode".into(), "Collaboration Mode".into())
    } else if text.starts_with("<apps_instructions>") {
        ("apps".into(), "Apps / Connectors".into())
    } else if text.starts_with("<skills_instructions>") {
        ("skills-catalog".into(), "Skills Catalog".into())
    } else {
        ("system".into(), "Developer Instructions".into())
    }
}

fn classify_user_context(text: &str) -> (String, String) {
    let trimmed = text.trim();
    if trimmed.starts_with("# AGENTS.md instructions") {
        ("agents".into(), "AGENTS.md".into())
    } else if trimmed.starts_with("<environment_context>") {
        ("environment".into(), "Environment Context".into())
    } else if trimmed.starts_with("Automation:") {
        ("automation".into(), "Automation Envelope".into())
    } else if trimmed
        .get(..26)
        .map(|prefix| prefix.eq_ignore_ascii_case("PLEASE IMPLEMENT THIS PLAN"))
        .unwrap_or(false)
    {
        ("delegated".into(), "Delegated Plan".into())
    } else if trimmed.starts_with("<skill>") {
        let name = extract_skill_name(trimmed);
        ("skill".into(), format!("Skill: {name}"))
    } else if trimmed.starts_with("<subagent_notification>") {
        (
            "subagent-notification".into(),
            "Subagent Notification".into(),
        )
    } else if trimmed.starts_with("<turn_aborted>") {
        ("system".into(), "Turn Aborted".into())
    } else {
        ("user".into(), "User Prompt".into())
    }
}

fn extract_skill_name(text: &str) -> String {
    if let Some(start) = text.find("<name>") {
        let after = &text[start + 6..];
        if let Some(end) = after.find("</name>") {
            return after[..end].to_owned();
        }
    }
    "unknown".to_owned()
}

fn extract_prompt_layers(entry: &Value, layers: &mut Vec<PromptAssemblyLayer>) {
    let payload = match entry.get("payload").and_then(Value::as_object) {
        Some(p) => p,
        None => return,
    };
    let role = payload.get("role").and_then(Value::as_str).unwrap_or("");
    let content = match payload.get("content").and_then(Value::as_array) {
        Some(c) => c,
        None => return,
    };

    for item in content {
        let text = match item.get("text").and_then(Value::as_str) {
            Some(t) if !t.trim().is_empty() => t,
            _ => continue,
        };
        let trimmed = text.trim();

        let (layer_type, label) = match role {
            "developer" => classify_developer_content(trimmed),
            "user" => classify_user_context(trimmed),
            _ => continue,
        };

        // Skip per-turn data: user prompts, skills, subagent notifications
        if matches!(
            layer_type.as_str(),
            "user" | "skill" | "subagent-notification"
        ) {
            continue;
        }

        layers.push(PromptAssemblyLayer {
            layer_type,
            label,
            content_length: text.len(),
            preview: truncate_utf8_safe(text, 120),
            raw_content: text.to_owned(),
        });
    }
}

fn is_system_boilerplate_text(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed.starts_with("# AGENTS.md instructions")
        || trimmed.starts_with("Automation:")
        || trimmed.starts_with("<skill>")
        || trimmed.starts_with("<subagent_notification>")
        || trimmed.starts_with("<turn_aborted>")
        || trimmed
            .get(..26)
            .map(|prefix| prefix.eq_ignore_ascii_case("PLEASE IMPLEMENT THIS PLAN"))
            .unwrap_or(false)
}

fn truncate_utf8_safe(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_owned();
    }
    let truncated: String = trimmed.chars().take(max_chars).collect();
    truncated
}

fn extract_error_hint(entry: &Value) -> Option<String> {
    let payload = entry.get("payload")?.as_object()?;
    let payload_type = payload.get("type").and_then(Value::as_str)?;

    if payload_type == "error" {
        return payload
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| {
                payload
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(Value::as_str)
            })
            .map(ToOwned::to_owned);
    }
    if payload_type == "turn_aborted" {
        return payload
            .get("reason")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or(Some("Turn aborted".to_owned()));
    }
    None
}

fn extract_message_text(content: &Value) -> Option<String> {
    let items = content.as_array()?;
    let mut parts = Vec::new();

    for item in items {
        match item {
            Value::String(value) if !value.trim().is_empty() => parts.push(value.trim().to_owned()),
            Value::Object(value) => {
                let content_type = value
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                if content_type == "input_image" {
                    parts.push("[Image]".to_owned());
                    continue;
                }

                if !matches!(content_type, "input_text" | "output_text" | "text") {
                    continue;
                }

                let Some(text) = value.get("text").and_then(Value::as_str) else {
                    continue;
                };
                if !text.trim().is_empty() {
                    parts.push(text.trim().to_owned());
                }
            }
            _ => {}
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn extract_entry_snapshot(entry: &Value) -> Option<SessionEntrySnapshot> {
    let timestamp = entry.get("timestamp")?.as_str()?.to_owned();

    // Handle top-level "compacted" type which has no payload.type
    if entry.get("type").and_then(Value::as_str) == Some("compacted") {
        return Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "context_compacted".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        });
    }

    let payload = entry.get("payload")?.as_object()?;
    let payload_type = payload.get("type").and_then(Value::as_str)?;

    match payload_type {
        "message" => {
            let role = payload.get("role")?.as_str()?;
            if role != "user" && role != "assistant" {
                return None;
            }
            let text = extract_message_text(payload.get("content")?);
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "message".to_owned(),
                role: Some(role.to_owned()),
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "function_call" => {
            let name = payload
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_owned();
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let arguments = match name.as_str() {
                // exec_command: extract just the "cmd" field for a clean preview
                "exec_command" => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .and_then(|args| {
                        serde_json::from_str::<Value>(args).ok().and_then(|v| {
                            v.get("cmd")
                                .and_then(Value::as_str)
                                .map(|c| truncate_utf8_safe(c, 500))
                        })
                    })
                    .or_else(|| {
                        payload
                            .get("arguments")
                            .and_then(Value::as_str)
                            .map(|args| truncate_utf8_safe(args, 500))
                    }),
                "spawn_agent" | "close_agent" | "wait" | "wait_agent" | "resume_agent"
                | "send_input" => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .map(|args| truncate_utf8_safe(args, 2000)),
                _ => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .map(|args| truncate_utf8_safe(args, 200)),
            };
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call".to_owned(),
                role: None,
                text: None,
                function_name: Some(name),
                function_call_id: call_id,
                function_arguments_preview: arguments,
            })
        }
        "function_call_output" => {
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let output = payload
                .get("output")
                .and_then(Value::as_str)
                .map(|o| truncate_utf8_safe(o, 2000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call_output".to_owned(),
                role: None,
                text: output,
                function_name: None,
                function_call_id: call_id,
                function_arguments_preview: None,
            })
        }
        "custom_tool_call" => {
            let name = payload
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("custom_tool")
                .to_owned();
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let arguments = match name.as_str() {
                // apply_patch: extract file paths from the full patch text before truncation
                "apply_patch" => {
                    let raw = payload
                        .get("arguments")
                        .and_then(Value::as_str)
                        .or_else(|| payload.get("input").and_then(Value::as_str));
                    raw.map(|args| {
                        let file_paths: Vec<&str> = args
                            .lines()
                            .filter_map(|line| {
                                line.strip_prefix("*** Add File: ")
                                    .or_else(|| line.strip_prefix("*** Update File: "))
                                    .or_else(|| line.strip_prefix("*** Delete File: "))
                            })
                            .collect();
                        if file_paths.len() > 1 {
                            let first = file_paths[0].trim();
                            format!(
                                "{} (+{} more)",
                                truncate_utf8_safe(first, 200),
                                file_paths.len() - 1
                            )
                        } else if file_paths.len() == 1 {
                            truncate_utf8_safe(file_paths[0].trim(), 200)
                        } else {
                            truncate_utf8_safe(args, 200)
                        }
                    })
                }
                "spawn_agent" | "close_agent" | "wait" | "wait_agent" | "resume_agent"
                | "send_input" => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .or_else(|| payload.get("input").and_then(Value::as_str))
                    .map(|args| truncate_utf8_safe(args, 2000)),
                _ => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .or_else(|| payload.get("input").and_then(Value::as_str))
                    .map(|args| truncate_utf8_safe(args, 200)),
            };
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call".to_owned(),
                role: None,
                text: None,
                function_name: Some(name),
                function_call_id: call_id,
                function_arguments_preview: arguments,
            })
        }
        "custom_tool_call_output" => {
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let output = payload
                .get("output")
                .and_then(Value::as_str)
                .map(|o| truncate_utf8_safe(o, 2000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call_output".to_owned(),
                role: None,
                text: output,
                function_name: None,
                function_call_id: call_id,
                function_arguments_preview: None,
            })
        }
        "reasoning" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "reasoning".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
        "task_started" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "task_started".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
        "task_complete" => {
            let text = payload
                .get("last_agent_message")
                .and_then(Value::as_str)
                .filter(|v| !v.trim().is_empty())
                .map(|t| truncate_utf8_safe(t, 500));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "task_complete".to_owned(),
                role: None,
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "agent_message" => {
            let text = payload
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| payload.get("text").and_then(Value::as_str))
                .map(|t| truncate_utf8_safe(t, 1000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "agent_message".to_owned(),
                role: None,
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "context_compacted" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "context_compacted".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
        "turn_aborted" => {
            let reason = payload
                .get("reason")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "turn_aborted".to_owned(),
                role: None,
                text: reason,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "thread_rolled_back" => {
            let reason = payload
                .get("reason")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "thread_rolled_back".to_owned(),
                role: None,
                text: reason,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "agent_reasoning" => {
            let text = payload
                .get("text")
                .and_then(Value::as_str)
                .map(|t| truncate_utf8_safe(t, 1000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "agent_reasoning".to_owned(),
                role: None,
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "item_completed" => {
            let item_text = payload
                .get("item")
                .and_then(|item| item.get("text"))
                .and_then(Value::as_str)
                .map(|t| truncate_utf8_safe(t, 1000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "item_completed".to_owned(),
                role: None,
                text: item_text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "web_search_call" => {
            let action = payload.get("action");
            let preview = action
                .and_then(|a| a.get("queries"))
                .and_then(Value::as_array)
                .filter(|arr| !arr.is_empty())
                .map(|arr| {
                    let joined: String = arr
                        .iter()
                        .filter_map(Value::as_str)
                        .collect::<Vec<_>>()
                        .join(" | ");
                    truncate_utf8_safe(&joined, 500)
                })
                .or_else(|| {
                    action
                        .and_then(|a| a.get("query"))
                        .and_then(Value::as_str)
                        .map(|q| truncate_utf8_safe(q, 200))
                });
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call".to_owned(),
                role: None,
                text: None,
                function_name: Some("web_search".to_owned()),
                function_call_id: None,
                function_arguments_preview: preview,
            })
        }
        "token_count" => {
            let info = payload.get("info").and_then(Value::as_object)?;
            let last_usage = info.get("last_token_usage").and_then(Value::as_object)?;
            let input = last_usage
                .get("input_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let cached = last_usage
                .get("cached_input_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let output = last_usage
                .get("output_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let reasoning = last_usage
                .get("reasoning_output_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let text = format!(
                r#"{{"in":{input},"cached":{cached},"out":{output},"reasoning":{reasoning}}}"#,
            );
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "token_count".to_owned(),
                role: None,
                text: Some(text),
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        _ => None,
    }
}

fn extract_turn_context_model(entry: &Value) -> Option<String> {
    if entry.get("type").and_then(Value::as_str) != Some("turn_context") {
        return None;
    }

    entry
        .get("payload")
        .and_then(|payload| payload.get("model"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
}

fn read_tail_entry_snapshots(
    session_file: &Path,
    max_bytes: u64,
    max_entries: usize,
) -> io::Result<Vec<SessionEntrySnapshot>> {
    let mut file = File::open(session_file)?;
    let file_len = file.metadata()?.len();
    let offset = file_len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(offset))?;

    let mut buffer = String::new();
    file.read_to_string(&mut buffer)?;
    let mut lines = buffer.lines();
    if offset > 0 {
        let _ = lines.next();
    }

    let mut entries = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            entries.push(snapshot_entry);
        }
    }

    if entries.len() > max_entries {
        entries.drain(0..entries.len() - max_entries);
    }

    Ok(entries)
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn sanitize_summary_text(text: &str) -> String {
    collapse_whitespace(text)
        .trim()
        .trim_start_matches('$')
        .to_owned()
}

fn extract_first_user_message(entries: &[SessionEntrySnapshot]) -> Option<String> {
    entries.iter().find_map(|entry| {
        if entry.entry_type != "message" || entry.role.as_deref() != Some("user") {
            return None;
        }

        let text = entry.text.as_deref()?.trim();
        if text.is_empty() || is_system_boilerplate_text(text) {
            return None;
        }

        Some(truncate_utf8_safe(text, 200))
    })
}

fn derive_recent_index_title(entries: &[SessionEntrySnapshot]) -> String {
    let title = extract_first_user_message(entries)
        .map(|message| sanitize_summary_text(&message))
        .filter(|message| !message.is_empty())
        .unwrap_or_else(|| DEFAULT_THREAD_TITLE.to_owned());

    truncate_utf8_safe(&title, 120)
}

fn derive_recent_index_status(entries: &[SessionEntrySnapshot]) -> String {
    let has_abort = entries.iter().any(|entry| {
        matches!(
            entry.entry_type.as_str(),
            "turn_aborted" | "thread_rolled_back"
        )
    });

    let latest_message = entries.iter().rev().find(|entry| {
        entry.entry_type == "message"
            && entry
                .text
                .as_deref()
                .map(|text| {
                    let trimmed = text.trim();
                    trimmed.starts_with("<turn_aborted>") || !is_system_boilerplate_text(trimmed)
                })
                .unwrap_or(false)
    });

    let Some(latest_message) = latest_message else {
        return if has_abort {
            "interrupted".to_owned()
        } else {
            "done".to_owned()
        };
    };

    if latest_message
        .text
        .as_deref()
        .is_some_and(|text| text.contains("<turn_aborted>"))
    {
        return "interrupted".to_owned();
    }

    if has_abort {
        let last_abort = entries.iter().rev().find(|entry| {
            matches!(
                entry.entry_type.as_str(),
                "turn_aborted" | "thread_rolled_back"
            )
        });
        if let Some(last_abort) = last_abort {
            if last_abort.timestamp >= latest_message.timestamp {
                return "interrupted".to_owned();
            }
        }
    }

    if latest_message.role.as_deref() == Some("user") {
        let has_completion_after = entries.iter().any(|entry| {
            entry.entry_type == "task_complete" && entry.timestamp >= latest_message.timestamp
        });

        return if has_completion_after {
            "done".to_owned()
        } else {
            "running".to_owned()
        };
    }

    "done".to_owned()
}

fn derive_recent_index_last_summary(entries: &[SessionEntrySnapshot]) -> String {
    for entry in entries.iter().rev() {
        match entry.entry_type.as_str() {
            "message" => {
                if let Some(text) = entry.text.as_deref() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() && !is_system_boilerplate_text(trimmed) {
                        return truncate_utf8_safe(&sanitize_summary_text(trimmed), 160);
                    }
                }
            }
            "function_call_output"
            | "task_complete"
            | "agent_message"
            | "agent_reasoning"
            | "item_completed"
            | "turn_aborted"
            | "thread_rolled_back" => {
                if let Some(text) = entry.text.as_deref() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        return truncate_utf8_safe(&sanitize_summary_text(trimmed), 160);
                    }
                }
            }
            "function_call" => {
                if let Some(arguments) = entry.function_arguments_preview.as_deref() {
                    let trimmed = arguments.trim();
                    if !trimmed.is_empty() {
                        return truncate_utf8_safe(
                            &format!(
                                "{}: {}",
                                entry.function_name.as_deref().unwrap_or("tool"),
                                sanitize_summary_text(trimmed)
                            ),
                            160,
                        );
                    }
                }
                if let Some(name) = entry.function_name.as_deref() {
                    return truncate_utf8_safe(name, 160);
                }
            }
            _ => {}
        }
    }

    "No event summary yet.".to_owned()
}

fn build_workspace_identity(origin_path: PathBuf, is_worktree: bool) -> WorkspaceIdentity {
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

fn resolve_codex_home() -> io::Result<PathBuf> {
    if let Some(codex_home) = env::var_os("CODEX_HOME") {
        return Ok(PathBuf::from(codex_home));
    }

    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
    Ok(home.join(".codex"))
}

fn resolve_projects_root() -> io::Result<PathBuf> {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
    Ok(home.join("Documents/Projects"))
}

fn normalize_path(path: &Path) -> io::Result<PathBuf> {
    fs::canonicalize(path).or_else(|_| Ok(path.to_path_buf()))
}

fn resolve_linked_git_dir(git_metadata_path: &Path) -> io::Result<PathBuf> {
    let git_file = fs::read_to_string(git_metadata_path)?;
    let git_dir_value = git_file
        .lines()
        .next()
        .map(str::trim)
        .and_then(|line| line.strip_prefix("gitdir:"))
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid gitdir file"))?;

    let git_metadata_parent = git_metadata_path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "gitdir metadata path has no parent directory",
        )
    })?;

    normalize_path(&git_metadata_parent.join(git_dir_value))
}

fn resolve_common_dir(git_dir: &Path) -> io::Result<PathBuf> {
    let commondir_path = git_dir.join("commondir");
    let commondir_contents = fs::read_to_string(&commondir_path)?;
    let commondir_value = commondir_contents
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid commondir file"))?;

    normalize_path(&git_dir.join(commondir_value))
}

#[tauri::command]
async fn load_archived_session_index(
    offset: usize,
    limit: usize,
    search: Option<String>,
    cache: tauri::State<'_, ArchivedIndexCache>,
) -> Result<ArchivedSessionIndexResult, String> {
    let cached = {
        let guard = cache.0.lock().unwrap_or_else(|e| e.into_inner());
        guard.clone()
    };

    let index = match cached {
        Some(index) => index,
        None => {
            let built = tauri::async_runtime::spawn_blocking(build_archived_index)
                .await
                .ok()
                .and_then(Result::ok)
                .unwrap_or_default();

            let mut guard = cache.0.lock().unwrap_or_else(|e| e.into_inner());
            if guard.is_none() {
                *guard = Some(built.clone());
                built
            } else {
                guard.clone().unwrap_or_default()
            }
        }
    };

    Ok(filter_archived_index(&index, offset, limit, search))
}

fn filter_archived_index(
    index: &[ArchivedSessionIndex],
    offset: usize,
    limit: usize,
    search: Option<String>,
) -> ArchivedSessionIndexResult {
    let filtered: Vec<&ArchivedSessionIndex> = match &search {
        Some(query) if !query.trim().is_empty() => {
            let lower_query = query.to_lowercase();
            index
                .iter()
                .filter(|entry| {
                    entry.display_name.to_lowercase().contains(&lower_query)
                        || entry.workspace_path.to_lowercase().contains(&lower_query)
                        || entry
                            .first_user_message
                            .as_ref()
                            .map(|m| m.to_lowercase().contains(&lower_query))
                            .unwrap_or(false)
                })
                .collect()
        }
        _ => index.iter().collect(),
    };

    let total = filtered.len();
    let items: Vec<ArchivedSessionIndex> = filtered
        .into_iter()
        .skip(offset)
        .take(limit)
        .cloned()
        .collect();
    let has_more = offset + items.len() < total;

    ArchivedSessionIndexResult {
        items,
        total,
        has_more,
    }
}

#[tauri::command]
async fn load_archived_session_snapshot(file_path: String) -> Option<SessionLogSnapshot> {
    tauri::async_runtime::spawn_blocking(move || {
        load_archived_session_snapshot_from_disk(&file_path)
    })
    .await
    .ok()
    .flatten()
}

fn load_archived_session_snapshot_from_disk(file_path: &str) -> Option<SessionLogSnapshot> {
    let codex_home = resolve_codex_home().ok()?;
    let archived_root = codex_home.join("archived_sessions");
    let path = Path::new(&file_path);

    let canonical_path = fs::canonicalize(path).ok()?;
    let canonical_root = fs::canonicalize(&archived_root).ok()?;
    if !canonical_path.starts_with(&canonical_root) {
        return None;
    }

    let mut snapshot = read_archived_session_full(path).ok()??;

    // Scan same directory for subagent JSONLs
    if let Some(parent_dir) = path.parent() {
        if let Ok(dir_entries) = fs::read_dir(parent_dir) {
            for entry in dir_entries.flatten() {
                let sub_path = entry.path();
                if sub_path == canonical_path {
                    continue;
                }
                if sub_path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                    continue;
                }
                if let Ok(Some(sub)) = read_subagent_snapshot(&sub_path) {
                    if sub.parent_thread_id == snapshot.session_id
                        || snapshot
                            .forked_from_id
                            .as_ref()
                            .is_some_and(|fid| sub.parent_thread_id == *fid)
                    {
                        snapshot.subagents.push(sub);
                    }
                }
            }
        }
    }

    Some(snapshot)
}

#[tauri::command]
fn refresh_archived_session_index(cache: tauri::State<'_, ArchivedIndexCache>) {
    let mut guard = cache.0.lock().unwrap_or_else(|e| e.into_inner());
    *guard = None;
}

fn build_archived_index() -> io::Result<Vec<ArchivedSessionIndex>> {
    let codex_home = resolve_codex_home()?;
    let archived_root = codex_home.join("archived_sessions");
    let mut archived_files = Vec::new();
    collect_jsonl_files(&archived_root, &mut archived_files)?;
    archived_files.sort_by(|left, right| right.cmp(left));

    let mut entries = Vec::new();
    for file_path in &archived_files {
        if let Ok(Some(entry)) = read_archived_index_entry(file_path) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

fn read_archived_index_entry(session_file: &Path) -> io::Result<Option<ArchivedSessionIndex>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let payload = match session_meta.get("payload").and_then(Value::as_object) {
        Some(p) => p,
        None => return Ok(None),
    };

    if payload
        .get("source")
        .and_then(|s| s.get("subagent"))
        .is_some()
    {
        return Ok(None);
    }
    if payload.get("source").and_then(Value::as_str).is_none() {
        return Ok(None);
    }

    let workspace_path = payload
        .get("cwd")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_default()
        .to_owned();
    if is_conductor_workspace_path(Path::new(&workspace_path)) {
        return Ok(None);
    }
    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();
    let (origin_path, display_name) = resolve_archived_workspace_identity(&workspace_path);

    let mut model: Option<String> = None;
    let mut first_user_message: Option<String> = None;
    for line in reader.lines().take(ARCHIVED_INDEX_SCAN_LIMIT) {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.trim().is_empty() {
            continue;
        }
        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        if model.is_none() && entry.get("type").and_then(Value::as_str) == Some("turn_context") {
            model = entry
                .get("payload")
                .and_then(|p| p.get("model"))
                .and_then(Value::as_str)
                .filter(|v| !v.trim().is_empty())
                .map(ToOwned::to_owned);
        }

        if first_user_message.is_none() {
            if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
                if snapshot_entry.entry_type == "message"
                    && snapshot_entry.role.as_deref() == Some("user")
                {
                    if let Some(ref text) = snapshot_entry.text {
                        if !is_system_boilerplate_text(text) {
                            first_user_message = Some(truncate_utf8_safe(text, 200));
                        }
                    }
                }
            }
        }

        if model.is_some() && first_user_message.is_some() {
            break;
        }
    }

    Ok(Some(ArchivedSessionIndex {
        session_id,
        workspace_path: workspace_path.clone(),
        origin_path,
        display_name,
        started_at: started_at.clone(),
        updated_at: started_at,
        model,
        message_count: 0,
        file_path: session_file.display().to_string(),
        first_user_message,
    }))
}

fn read_archived_session_full(session_file: &Path) -> io::Result<Option<SessionLogSnapshot>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "payload missing"))?;

    if payload.get("source").and_then(Value::as_str).is_none() {
        return Ok(None);
    }

    let workspace_path = payload
        .get("cwd")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_default();
    if is_conductor_workspace_path(Path::new(workspace_path)) {
        return Ok(None);
    }
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();
    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let forked_from_id = payload
        .get("forked_from_id")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
        .map(ToOwned::to_owned);

    let mut prompt_assembly = Vec::new();

    // Extract base_instructions from session_meta
    if let Some(bi_text) = payload
        .get("base_instructions")
        .and_then(|bi| bi.get("text"))
        .and_then(Value::as_str)
    {
        prompt_assembly.push(PromptAssemblyLayer {
            layer_type: "system".to_owned(),
            label: "Base Instructions".to_owned(),
            content_length: bi_text.len(),
            preview: truncate_utf8_safe(bi_text, 120),
            raw_content: bi_text.to_owned(),
        });
    }

    let (origin_path, display_name) = resolve_archived_workspace_identity(workspace_path);

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;
    let mut prompt_assembly_done = false;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if model.is_none() {
            if let Some("turn_context") = entry.get("type").and_then(Value::as_str) {
                model = entry
                    .get("payload")
                    .and_then(|p| p.get("model"))
                    .and_then(Value::as_str)
                    .filter(|v| !v.trim().is_empty())
                    .map(ToOwned::to_owned);
            }
        }

        // Stop extracting prompt assembly after first task_complete (end of first turn)
        if !prompt_assembly_done {
            if let Some(payload) = entry.get("payload").and_then(Value::as_object) {
                if payload.get("type").and_then(Value::as_str) == Some("task_complete") {
                    prompt_assembly_done = true;
                }
            }
        }

        if !prompt_assembly_done
            && entry.get("type").and_then(Value::as_str) == Some("response_item")
        {
            extract_prompt_layers(&entry, &mut prompt_assembly);
        }

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            updated_at = snapshot_entry.timestamp.clone();
            entries.push(snapshot_entry);
        }
    }

    Ok(Some(SessionLogSnapshot {
        session_id,
        forked_from_id,
        workspace_path: workspace_path.to_owned(),
        origin_path,
        display_name,
        started_at,
        updated_at,
        model,
        entries,
        subagents: Vec::new(),
        is_archived: true,
        prompt_assembly,
    }))
}

fn resolve_archived_workspace_identity(workspace_path: &str) -> (String, String) {
    let path = Path::new(workspace_path);

    if let Ok(projects_root) = resolve_projects_root() {
        if let Ok(identity) = resolve_session_workspace_identity(path, &projects_root) {
            return (identity.origin_path, identity.display_name);
        }
    }

    let display_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty())
        .unwrap_or("unknown")
        .to_owned();

    (workspace_path.to_owned(), display_name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ArchivedIndexCache(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            load_recent_session_index,
            load_recent_session_snapshot,
            resolve_workspace_identities,
            load_archived_session_index,
            load_archived_session_snapshot,
            refresh_archived_session_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        thread,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempDir {
        path: PathBuf,
    }

    static TEST_ENV_MUTEX: Mutex<()> = Mutex::new(());

    struct EnvVarGuard {
        key: &'static str,
        original: Option<std::ffi::OsString>,
    }

    struct RecentSessionTestContext {
        _temp_dir: TempDir,
        _env_lock: std::sync::MutexGuard<'static, ()>,
        _home_guard: EnvVarGuard,
        _codex_home_guard: EnvVarGuard,
        temp_root: PathBuf,
        codex_home: PathBuf,
        sessions_root: PathBuf,
        projects_root: PathBuf,
    }

    impl TempDir {
        fn new(name: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock should be after unix epoch")
                .as_nanos();
            let unique = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "codex-multi-agent-monitor-{name}-{timestamp}-{unique}"
            ));
            fs::create_dir_all(&path).expect("temp dir should be created");
            Self { path }
        }
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &Path) -> Self {
            let original = std::env::var_os(key);
            std::env::set_var(key, value);
            Self { key, original }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original {
                std::env::set_var(self.key, value);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn create_state_database(path: &Path, archived_ids: &[&str]) {
        let connection = Connection::open(path).expect("state database should be created");
        connection
            .execute_batch(
                "CREATE TABLE threads (
                    id TEXT PRIMARY KEY,
                    archived INTEGER NOT NULL
                );",
            )
            .expect("threads table should be created");

        for thread_id in archived_ids {
            connection
                .execute(
                    "INSERT INTO threads (id, archived) VALUES (?1, 1)",
                    [thread_id],
                )
                .expect("archived thread should be inserted");
        }
    }

    fn write_session_lines<I, S>(path: &Path, lines: I)
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let contents = lines
            .into_iter()
            .map(|line| line.as_ref().to_owned())
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(path, contents).expect("session file should be written");
    }

    fn create_git_workspace(path: &Path) {
        fs::create_dir_all(path.join(".git")).expect("workspace git dir should exist");
    }

    fn session_meta_line(session_id: &str, workspace_path: &Path) -> String {
        session_meta_line_with_fork(session_id, workspace_path, None)
    }

    fn session_meta_line_with_fork(
        session_id: &str,
        workspace_path: &Path,
        forked_from_id: Option<&str>,
    ) -> String {
        let forked_from = forked_from_id
            .map(|value| format!(r#","forked_from_id":"{value}""#))
            .unwrap_or_default();

        format!(
            r#"{{"timestamp":"2026-03-20T00:00:00.000Z","type":"session_meta","payload":{{"id":"{session_id}"{forked_from},"source":"desktop","cwd":"{}","timestamp":"2026-03-20T00:00:00.000Z"}}}}"#,
            workspace_path.display()
        )
    }

    impl RecentSessionTestContext {
        fn new(name: &str) -> Self {
            let env_lock = TEST_ENV_MUTEX.lock().expect("test env mutex should lock");
            let temp_dir = TempDir::new(name);
            let home_root = normalize_path(&temp_dir.path).expect("temp path should normalize");
            let home_guard = EnvVarGuard::set("HOME", &home_root);
            let codex_home = home_root.join(".codex");
            let codex_home_guard = EnvVarGuard::set("CODEX_HOME", &codex_home);
            let sessions_root = codex_home.join("sessions");
            let projects_root = home_root.join("Documents/Projects");

            fs::create_dir_all(&sessions_root).expect("sessions root should exist");
            fs::create_dir_all(&projects_root).expect("projects root should exist");

            Self {
                _temp_dir: temp_dir,
                _env_lock: env_lock,
                _home_guard: home_guard,
                _codex_home_guard: codex_home_guard,
                temp_root: home_root,
                codex_home,
                sessions_root,
                projects_root,
            }
        }
    }

    #[test]
    fn resolves_standard_repo_origin_from_git_directory() {
        let temp_dir = TempDir::new("repo");
        let repo_path = temp_dir.path.join("codex-multi-agent-monitor");
        fs::create_dir_all(repo_path.join(".git")).expect(".git directory should exist");

        let identity =
            resolve_workspace_identity(&repo_path).expect("git directory repo should resolve");
        let expected_origin_path = normalize_path(&repo_path)
            .expect("repo path should normalize")
            .display()
            .to_string();

        assert_eq!(identity.display_name, "codex-multi-agent-monitor");
        assert_eq!(identity.origin_path, expected_origin_path);
        assert!(!identity.is_worktree);
    }

    #[test]
    fn resolves_linked_worktree_origin_from_commondir() {
        let temp_dir = TempDir::new("worktree");
        let origin_repo_path = temp_dir.path.join("codex-multi-agent-monitor");
        let worktree_repo_path = temp_dir.path.join("codex-multi-agent-monitor-fix-123");
        let worktree_git_dir = origin_repo_path.join(".git/worktrees/fix-123");

        fs::create_dir_all(origin_repo_path.join(".git")).expect("origin git dir should exist");
        fs::create_dir_all(&worktree_git_dir).expect("worktree git dir should exist");
        fs::create_dir_all(&worktree_repo_path).expect("worktree repo should exist");
        fs::write(
            worktree_repo_path.join(".git"),
            format!("gitdir: {}\n", worktree_git_dir.display()),
        )
        .expect("gitdir file should be written");
        fs::write(worktree_git_dir.join("commondir"), "../..\n")
            .expect("commondir file should be written");

        let identity = resolve_workspace_identity(&worktree_repo_path)
            .expect("linked worktree should resolve to origin repo");
        let expected_origin_path = normalize_path(&origin_repo_path)
            .expect("origin path should normalize")
            .display()
            .to_string();

        assert_eq!(identity.display_name, "codex-multi-agent-monitor");
        assert_eq!(identity.origin_path, expected_origin_path);
        assert!(identity.is_worktree);
    }

    #[test]
    fn identifies_conductor_workspace_path_from_segments() {
        let workspace_path = Path::new("/Users/test/conductor/workspaces/React-Dashboard/hanoi");
        let plain_path = Path::new("/Users/test/Documents/Projects/React-Dashboard");

        assert!(is_conductor_workspace_path(workspace_path));
        assert!(!is_conductor_workspace_path(plain_path));
    }

    #[test]
    fn rejects_live_session_when_inferred_origin_path_is_missing() {
        let temp_dir = TempDir::new("missing-live-origin");
        let projects_root = temp_dir.path.join("Documents/Projects");
        let workspace_path = temp_dir.path.join("tmp/codex-routing-smoke-missing");

        fs::create_dir_all(&projects_root).expect("projects root should exist");
        fs::create_dir_all(&workspace_path).expect("workspace path should exist");

        let error = resolve_live_session_workspace_identity(&workspace_path, &projects_root)
            .expect_err("missing origin path should be rejected for live sessions");

        assert_eq!(error.kind(), io::ErrorKind::NotFound);
    }

    #[test]
    fn rejects_live_conductor_workspace_before_identity_resolution() {
        let temp_dir = TempDir::new("live-conductor");
        let projects_root = temp_dir.path.join("Documents/Projects");
        let workspace_path = temp_dir
            .path
            .join("conductor/workspaces/React-Dashboard/kyiv");

        fs::create_dir_all(&projects_root).expect("projects root should exist");
        fs::create_dir_all(&workspace_path).expect("workspace path should exist");

        let error = resolve_live_session_workspace_identity(&workspace_path, &projects_root)
            .expect_err("conductor workspaces should be excluded from live sessions");

        assert_eq!(error.kind(), io::ErrorKind::NotFound);
    }

    #[test]
    fn skips_conductor_archived_index_entries() {
        let temp_dir = TempDir::new("archived-index-conductor");
        let session_file = temp_dir.path.join("rollout.jsonl");

        write_session_lines(
            &session_file,
            [
                r#"{"timestamp":"2026-03-04T10:14:39.570Z","type":"session_meta","payload":{"id":"conductor-archived","timestamp":"2026-03-04T10:14:39.570Z","cwd":"/Users/choegihwan/conductor/workspaces/React-Dashboard/hanoi","source":"exec"}}"#,
            ],
        );

        let entry =
            read_archived_index_entry(&session_file).expect("archived index read should succeed");

        assert!(entry.is_none());
    }

    #[test]
    fn skips_conductor_archived_snapshots() {
        let temp_dir = TempDir::new("archived-full-conductor");
        let session_file = temp_dir.path.join("rollout.jsonl");

        write_session_lines(
            &session_file,
            [
                r#"{"timestamp":"2026-03-04T10:14:39.570Z","type":"session_meta","payload":{"id":"conductor-archived","timestamp":"2026-03-04T10:14:39.570Z","cwd":"/Users/choegihwan/conductor/workspaces/React-Dashboard/hanoi","source":"exec"}}"#,
            ],
        );

        let snapshot = read_archived_session_full(&session_file)
            .expect("archived snapshot read should succeed");

        assert!(snapshot.is_none());
    }

    #[test]
    fn loads_archived_thread_ids_from_latest_state_database() {
        let temp_dir = TempDir::new("state-database");
        let older_database = temp_dir.path.join("state_4.sqlite");
        let newer_database = temp_dir.path.join("state_5.sqlite");

        create_state_database(&older_database, &["old-archived"]);
        thread::sleep(Duration::from_millis(20));
        create_state_database(&newer_database, &["new-archived", "newer-archived"]);

        let archived_thread_ids =
            load_archived_thread_ids(&temp_dir.path).expect("archived thread ids should load");

        assert!(archived_thread_ids.contains("new-archived"));
        assert!(archived_thread_ids.contains("newer-archived"));
        assert!(!archived_thread_ids.contains("old-archived"));
    }

    #[test]
    fn sorts_recent_session_files_by_modified_time_before_filename() {
        let temp_dir = TempDir::new("recent-files");
        let older_started = temp_dir.path.join("rollout-2026-03-20-old.jsonl");
        let newer_started = temp_dir.path.join("rollout-2026-03-21-new.jsonl");

        fs::write(&older_started, "old").expect("older file should be created");
        thread::sleep(Duration::from_millis(20));
        fs::write(&newer_started, "new").expect("newer file should be created");
        thread::sleep(Duration::from_millis(20));
        fs::write(&older_started, "old updated").expect("older file should be refreshed");

        let mut files = vec![newer_started.clone(), older_started.clone()];
        sort_session_files_by_recent_activity(&mut files);

        assert_eq!(files[0], older_started);
        assert_eq!(files[1], newer_started);
    }

    #[test]
    fn rejects_linked_worktree_without_commondir() {
        let temp_dir = TempDir::new("missing-commondir");
        let repo_path = temp_dir.path.join("broken-worktree");
        let git_dir = temp_dir.path.join("shared/.git/worktrees/broken");

        fs::create_dir_all(&repo_path).expect("repo dir should exist");
        fs::create_dir_all(&git_dir).expect("git dir should exist");
        fs::write(
            repo_path.join(".git"),
            format!("gitdir: {}\n", git_dir.display()),
        )
        .expect("gitdir file should be written");

        let error =
            resolve_workspace_identity(&repo_path).expect_err("missing commondir should fail");
        assert_eq!(error.kind(), io::ErrorKind::NotFound);
    }

    #[test]
    fn rejects_invalid_gitdir_file() {
        let temp_dir = TempDir::new("invalid-gitdir");
        let repo_path = temp_dir.path.join("broken-repo");

        fs::create_dir_all(&repo_path).expect("repo dir should exist");
        fs::write(repo_path.join(".git"), "not-a-gitdir\n").expect("git metadata should exist");

        let error = resolve_workspace_identity(&repo_path).expect_err("invalid gitdir should fail");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn builds_recent_index_entry_from_lightweight_session_scan() {
        let ctx = RecentSessionTestContext::new("recent-index");
        let workspace_path = ctx.projects_root.join("demo-app");
        let session_file = ctx.sessions_root.join("session.jsonl");

        create_git_workspace(&workspace_path);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-001", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Ship the recent-index flow"}]}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:03.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Working on the lightweight summary."}]}}"#
                    .to_owned(),
            ],
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");
        let item = items
            .into_iter()
            .next()
            .expect("recent index entry should exist");

        assert_eq!(item.session_id, "session-001");
        assert_eq!(item.display_name, "demo-app");
        assert_eq!(item.model.as_deref(), Some("gpt-5"));
        assert_eq!(item.title, "Ship the recent-index flow");
        assert_eq!(item.status, "done");
        assert_eq!(
            item.last_event_summary,
            "Working on the lightweight summary."
        );
        assert_eq!(
            item.first_user_message.as_deref(),
            Some("Ship the recent-index flow")
        );
    }

    #[test]
    fn skips_conductor_recent_index_entries() {
        let ctx = RecentSessionTestContext::new("recent-index-conductor");
        let workspace_path = ctx
            .temp_root
            .join("conductor/workspaces/React-Dashboard/kyiv");
        let session_file = ctx.sessions_root.join("conductor.jsonl");

        fs::create_dir_all(&workspace_path).expect("workspace path should exist");
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-conductor", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Should never appear"}]}}"#
                    .to_owned(),
            ],
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn skips_recent_index_entries_when_origin_workspace_is_missing() {
        let ctx = RecentSessionTestContext::new("recent-index-missing-origin");
        let workspace_path = ctx.temp_root.join("tmp/ghost-workspace");
        let session_file = ctx.sessions_root.join("missing-origin.jsonl");

        fs::create_dir_all(&workspace_path).expect("workspace path should exist");
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-missing-origin", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"This workspace should be rejected"}]}}"#
                    .to_owned(),
            ],
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn keeps_recent_automation_sessions_when_workspace_identity_is_valid() {
        let ctx = RecentSessionTestContext::new("recent-index-automation");
        let workspace_path = ctx.projects_root.join("automation-demo");
        let session_file = ctx.sessions_root.join("automation.jsonl");

        create_git_workspace(&workspace_path);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("automation-session", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Automation: Daily Diary Automation\n# Daily Diary\nAI 에이전트 활동 로그와 Obsidian 볼트 변경사항을 종합한다."}]}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:03.000Z","type":"event_msg","payload":{"type":"task_complete","last_agent_message":"done"}}"#
                    .to_owned(),
            ],
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");
        let item = items
            .into_iter()
            .next()
            .expect("automation session should remain visible");

        assert_eq!(item.session_id, "automation-session");
        assert_eq!(item.display_name, "automation-demo");
        assert_eq!(item.title, DEFAULT_THREAD_TITLE);
        assert!(item.first_user_message.is_none());
    }

    #[test]
    fn excludes_archived_threads_from_recent_index() {
        let ctx = RecentSessionTestContext::new("recent-index-archived");
        let workspace_path = ctx.projects_root.join("demo-app");
        let archived_session_file = ctx.sessions_root.join("archived-live.jsonl");
        let visible_session_file = ctx.sessions_root.join("visible-live.jsonl");
        let state_database = ctx.codex_home.join("state_9.sqlite");

        create_git_workspace(&workspace_path);
        fs::create_dir_all(&ctx.codex_home).expect("codex home should exist");
        create_state_database(&state_database, &["session-archived"]);
        write_session_lines(
            &archived_session_file,
            vec![
                session_meta_line("session-archived", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Archived thread should stay hidden"}]}}"#
                    .to_owned(),
            ],
        );
        write_session_lines(
            &visible_session_file,
            vec![
                session_meta_line("session-visible", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Visible thread should remain"}]}}"#
                    .to_owned(),
            ],
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].session_id, "session-visible");
    }

    #[test]
    fn rejects_archived_threads_from_recent_snapshot_loading() {
        let ctx = RecentSessionTestContext::new("recent-snapshot-archived");
        let workspace_path = ctx.projects_root.join("demo-app");
        let session_file = ctx.sessions_root.join("archived-selected.jsonl");
        let state_database = ctx.codex_home.join("state_11.sqlite");

        create_git_workspace(&workspace_path);
        fs::create_dir_all(&ctx.codex_home).expect("codex home should exist");
        create_state_database(&state_database, &["session-archived"]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-archived", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Archived thread should not hydrate"}]}}"#
                    .to_owned(),
            ],
        );

        let snapshot =
            load_recent_session_snapshot_from_disk(session_file.to_string_lossy().as_ref());

        assert!(snapshot.is_none());
    }

    #[test]
    fn loads_selected_recent_snapshot_and_matching_subagents_only() {
        let ctx = RecentSessionTestContext::new("recent-detail");
        let workspace_path = ctx.projects_root.join("demo-app");
        let selected_file = ctx.sessions_root.join("selected.jsonl");
        let matched_subagent_file = ctx.sessions_root.join("matched-sub.jsonl");
        let unrelated_subagent_file = ctx.sessions_root.join("other-sub.jsonl");

        create_git_workspace(&workspace_path);
        write_session_lines(
            &selected_file,
            vec![
                session_meta_line_with_fork("session-001", &workspace_path, Some("fork-001")),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Inspect only this session"}]}}"#
                    .to_owned(),
            ],
        );
        write_session_lines(
            &matched_subagent_file,
            vec![
                r#"{"timestamp":"2026-03-20T00:01:00.000Z","type":"session_meta","payload":{"id":"sub-001","source":{"subagent":{"thread_spawn":{"parent_thread_id":"session-001","depth":1,"agent_nickname":"Euler","agent_role":"worker"}}},"cwd":"/tmp/test","timestamp":"2026-03-20T00:01:00.000Z"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-20T00:01:01.000Z","type":"turn_context","payload":{"model":"gpt-5-mini"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-20T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Matched child"}]}}"#.to_owned(),
            ],
        );
        write_session_lines(
            &unrelated_subagent_file,
            vec![
                r#"{"timestamp":"2026-03-20T00:02:00.000Z","type":"session_meta","payload":{"id":"sub-999","source":{"subagent":{"thread_spawn":{"parent_thread_id":"other-parent","depth":1,"agent_nickname":"Noether","agent_role":"worker"}}},"cwd":"/tmp/test","timestamp":"2026-03-20T00:02:00.000Z"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-20T00:02:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Unrelated child"}]}}"#.to_owned(),
            ],
        );

        let snapshot =
            load_recent_session_snapshot_from_disk(selected_file.to_string_lossy().as_ref())
                .expect("selected recent snapshot should exist");

        assert_eq!(snapshot.session_id, "session-001");
        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(snapshot.subagents[0].session_id, "sub-001");
        assert_eq!(snapshot.subagents[0].agent_nickname, "Euler");
    }

    #[test]
    fn strips_fork_context_from_subagent_entries() {
        let temp_dir = TempDir::new("fork-context");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            // Line 1: subagent session_meta
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-001","forked_from_id":"parent-001","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Gibbs","agent_role":"explorer"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            // Line 2: parent session_meta (triggers fork context)
            r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#,
            // Line 3: parent turn 1 task_started
            r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#,
            // Line 4: parent turn 1 user message
            r#"{"timestamp":"2026-03-18T09:12:04.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Hello parent"}]}}"#,
            // Line 5: parent turn 1 assistant message
            r#"{"timestamp":"2026-03-18T09:12:10.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"I will help you."}]}}"#,
            // Line 6: parent turn 1 task_complete
            r#"{"timestamp":"2026-03-18T09:12:15.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-p1","last_agent_message":"done"}}"#,
            // Line 7: parent turn 2 task_started (incomplete — still active when subagent forked)
            r#"{"timestamp":"2026-03-18T09:13:00.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p2"}}"#,
            // Line 8: parent turn 2 spawn_agent call
            r#"{"timestamp":"2026-03-18T09:13:05.000Z","type":"response_item","payload":{"type":"function_call","name":"spawn_agent","call_id":"call-001","arguments":"{\"agent_type\":\"explorer\",\"message\":\"do stuff\",\"fork_context\":true}"}}"#,
            // Line 9: parent turn 2 spawn output
            r#"{"timestamp":"2026-03-18T09:13:06.000Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call-001","output":"You are the newly spawned agent."}}"#,
            // Line 10: subagent's own task_started (boundary)
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            // Line 11: subagent turn_context
            r#"{"timestamp":"2026-03-18T09:14:10.100Z","type":"turn_context","payload":{"model":"gpt-5.3-codex-spark","turn_id":"turn-sub-1"}}"#,
            // Line 12: subagent user message (delegated task)
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"do stuff"}]}}"#,
            // Line 13: subagent task_complete
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":null}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse subagent file")
            .expect("should produce a snapshot");

        assert_eq!(snapshot.session_id, "sub-001");
        assert_eq!(snapshot.parent_thread_id, "parent-001");
        assert_eq!(snapshot.agent_nickname, "Gibbs");
        assert_eq!(snapshot.agent_role, "explorer");
        assert_eq!(snapshot.model, Some("gpt-5.3-codex-spark".to_owned()));

        // Only subagent's own entries: task_started, user message, task_complete
        assert_eq!(
            snapshot.entries.len(),
            3,
            "fork context entries should be stripped"
        );
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(snapshot.entries[1].role.as_deref(), Some("user"));
        assert_eq!(snapshot.entries[1].text.as_deref(), Some("do stuff"));
        assert_eq!(snapshot.entries[2].entry_type, "task_complete");

        // updated_at should reflect the last subagent entry
        assert_eq!(snapshot.updated_at, "2026-03-18T09:14:30.000Z");
    }

    #[test]
    fn reads_subagent_without_fork_context() {
        let temp_dir = TempDir::new("no-fork");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-002","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Pasteur","agent_role":"researcher"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.100Z","type":"turn_context","payload":{"model":"gpt-5","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"research this"}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:20.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Here are my findings."}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse subagent file")
            .expect("should produce a snapshot");

        assert_eq!(snapshot.agent_nickname, "Pasteur");
        assert_eq!(snapshot.entries.len(), 4); // task_started, user, assistant, task_complete
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(snapshot.entries[1].role.as_deref(), Some("user"));
        assert_eq!(snapshot.entries[2].entry_type, "message");
        assert_eq!(snapshot.entries[2].role.as_deref(), Some("assistant"));
        assert_eq!(snapshot.entries[3].entry_type, "task_complete");
    }

    #[test]
    fn fork_context_single_incomplete_parent_turn() {
        let temp_dir = TempDir::new("single-turn-fork");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            // subagent meta
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-003","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Hume","agent_role":"explorer"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            // parent meta
            r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#,
            // parent turn 1 (incomplete — only task_started, no task_complete)
            r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:10.000Z","type":"response_item","payload":{"type":"function_call","name":"spawn_agent","call_id":"call-x","arguments":"{}"}}"#,
            // subagent's own task_started (detected as boundary: 2nd task_started while turn-p1 is open)
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Working on it."}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse")
            .expect("should produce snapshot");

        assert_eq!(snapshot.agent_nickname, "Hume");
        // Only subagent entries: task_started, assistant message, task_complete
        assert_eq!(
            snapshot.entries.len(),
            3,
            "fork context with single incomplete turn should be stripped"
        );
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(snapshot.entries[1].role.as_deref(), Some("assistant"));
        assert_eq!(snapshot.entries[2].entry_type, "task_complete");
    }
}
