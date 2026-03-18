use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    env,
    fs::{self, File},
    io::{self, BufRead, BufReader},
    path::{Path, PathBuf},
    sync::Mutex,
};

const MAX_RECENT_WORKSPACES: usize = 4;

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
fn load_recent_session_snapshots() -> Vec<SessionLogSnapshot> {
    load_recent_session_snapshots_from_disk().unwrap_or_default()
}

fn resolve_workspace_identity(repo_path: &Path) -> io::Result<WorkspaceIdentity> {
    let git_metadata_path = repo_path.join(".git");
    if git_metadata_path.is_dir() {
        return Ok(build_workspace_identity(
            normalize_path(repo_path)?,
            false,
        ));
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

fn load_recent_session_snapshots_from_disk() -> io::Result<Vec<SessionLogSnapshot>> {
    let codex_home = resolve_codex_home()?;
    let projects_root = resolve_projects_root()?;
    let sessions_root = codex_home.join("sessions");
    let mut session_files = Vec::new();
    collect_jsonl_files(&sessions_root, &mut session_files)?;
    session_files.sort_by(|left, right| right.cmp(left));

    let mut seen_origin_paths = HashSet::new();
    let mut parent_snapshots = Vec::new();
    let mut subagent_snapshots = Vec::new();

    for session_file in &session_files {
        match read_subagent_snapshot(session_file) {
            Ok(Some(sub)) => {
                subagent_snapshots.push(sub);
                continue;
            }
            Ok(None) => {}
            Err(_) => continue,
        }

        if parent_snapshots.len() >= MAX_RECENT_WORKSPACES {
            continue;
        }

        let snapshot = match read_session_snapshot(session_file, &projects_root) {
            Ok(Some(snapshot)) => snapshot,
            Ok(None) => continue,
            Err(_) => continue,
        };

        if seen_origin_paths.insert(snapshot.origin_path.clone()) {
            parent_snapshots.push(snapshot);
        }
    }

    for parent in &mut parent_snapshots {
        let matched: Vec<SubagentSnapshot> = subagent_snapshots
            .iter()
            .filter(|sub| {
                sub.parent_thread_id == parent.session_id
                    || parent
                        .forked_from_id
                        .as_ref()
                        .map_or(false, |fid| sub.parent_thread_id == *fid)
            })
            .cloned()
            .collect();
        parent.subagents = matched;
    }

    Ok(parent_snapshots)
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
    let mut has_fork_context = false;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        // Detect forked context: a second session_meta line from the parent session
        if entry.get("type").and_then(Value::as_str) == Some("session_meta") {
            has_fork_context = true;
            continue;
        }

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

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            updated_at = snapshot_entry.timestamp.clone();
            entries.push(snapshot_entry);
        } else if error.is_none() {
            error = extract_error_hint(&entry);
        }
    }

    // Strip forked context: entries with timestamps clustered at the start (within 200ms)
    if has_fork_context && entries.len() > 1 {
        let fork_end = find_fork_context_boundary(&entries);
        if fork_end > 0 && fork_end < entries.len() {
            entries = entries.split_off(fork_end);
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

    let session_meta =
        serde_json::from_str::<Value>(&first_line).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "session meta payload missing"))?;

    if !payload.get("source").and_then(Value::as_str).is_some() {
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

    let workspace_identity =
        resolve_session_workspace_identity(Path::new(workspace_path), projects_root).ok();
    let Some(workspace_identity) = workspace_identity else {
        return Ok(None);
    };

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;

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
    }))
}

fn resolve_session_workspace_identity(
    workspace_path: &Path,
    projects_root: &Path,
) -> io::Result<WorkspaceIdentity> {
    if let Ok(identity) = resolve_workspace_identity(workspace_path) {
        if Path::new(&identity.origin_path).starts_with(projects_root) {
            return Ok(identity);
        }
    }

    let inferred_origin = infer_projects_origin(workspace_path, projects_root).ok_or_else(|| {
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
    let workspace_file_name = normalized_workspace.file_name()?.to_str()?;

    let candidate = if normalized_workspace.starts_with(projects_root) {
        normalized_workspace
    } else {
        projects_root.join(workspace_file_name)
    };

    let normalized_candidate = normalize_path(&candidate).unwrap_or(candidate);
    if normalized_candidate.starts_with(projects_root) {
        Some(normalized_candidate)
    } else {
        None
    }
}

/// Find the boundary between forked context entries and actual subagent work.
/// Forked entries have timestamps clustered within a few milliseconds at the start.
/// Returns the index of the first actual entry, or 0 if no boundary is found.
fn find_fork_context_boundary(entries: &[SessionEntrySnapshot]) -> usize {
    if entries.len() < 2 {
        return 0;
    }

    // Parse milliseconds from ISO 8601 timestamp for gap detection.
    // Compare consecutive entry timestamps: the first gap > 200ms marks the boundary.
    let parse_ms = |ts: &str| -> u64 {
        // Format: "2026-03-18T00:14:09.101Z" — extract seconds and millis
        let parts: Vec<&str> = ts.split('T').collect();
        if parts.len() < 2 {
            return 0;
        }
        let time_part = parts[1].trim_end_matches('Z');
        let time_parts: Vec<&str> = time_part.split(':').collect();
        if time_parts.len() < 3 {
            return 0;
        }
        let hours: u64 = time_parts[0].parse().unwrap_or(0);
        let minutes: u64 = time_parts[1].parse().unwrap_or(0);
        let sec_parts: Vec<&str> = time_parts[2].split('.').collect();
        let seconds: u64 = sec_parts[0].parse().unwrap_or(0);
        let millis: u64 = if sec_parts.len() > 1 {
            let frac = sec_parts[1];
            let padded = format!("{:0<3}", &frac[..frac.len().min(3)]);
            padded.parse().unwrap_or(0)
        } else {
            0
        };
        ((hours * 3600 + minutes * 60 + seconds) * 1000) + millis
    };

    let first_ms = parse_ms(&entries[0].timestamp);
    for i in 1..entries.len() {
        let curr_ms = parse_ms(&entries[i].timestamp);
        if curr_ms.saturating_sub(first_ms) > 200 {
            return i;
        }
    }

    0
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
                let content_type = value.get("type").and_then(Value::as_str).unwrap_or_default();
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
            let args_limit = match name.as_str() {
                "spawn_agent" | "close_agent" | "wait" | "wait_agent" => 2000,
                _ => 200,
            };
            let arguments = payload
                .get("arguments")
                .and_then(Value::as_str)
                .map(|args| truncate_utf8_safe(args, args_limit));
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
                .map(|o| truncate_utf8_safe(o, 1000));
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
            let args_limit = match name.as_str() {
                "spawn_agent" | "close_agent" | "wait" | "wait_agent" => 2000,
                _ => 200,
            };
            let arguments = payload
                .get("arguments")
                .and_then(Value::as_str)
                .or_else(|| payload.get("input").and_then(Value::as_str))
                .map(|args| truncate_utf8_safe(args, args_limit));
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
                .map(|o| truncate_utf8_safe(o, 1000));
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
        "task_complete" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "task_complete".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
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
                entry_type: "agent_message".to_owned(),
                role: None,
                text: item_text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        _ => None,
    }
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
fn load_archived_session_index(
    offset: usize,
    limit: usize,
    search: Option<String>,
    cache: tauri::State<'_, ArchivedIndexCache>,
) -> ArchivedSessionIndexResult {
    let mut guard = cache.0.lock().unwrap_or_else(|e| e.into_inner());

    if guard.is_none() {
        *guard = Some(build_archived_index().unwrap_or_default());
    }

    let index = guard.as_ref().unwrap();
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
fn load_archived_session_snapshot(file_path: String) -> Option<SessionLogSnapshot> {
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
                    if sub.parent_thread_id == snapshot.session_id {
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
    let display_name = Path::new(&workspace_path)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty())
        .unwrap_or("unknown")
        .to_owned();

    let mut model: Option<String> = None;
    let mut first_user_message: Option<String> = None;
    for line in reader.lines().take(50) {
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

        if model.is_none() {
            if entry.get("type").and_then(Value::as_str) == Some("turn_context") {
                model = entry
                    .get("payload")
                    .and_then(|p| p.get("model"))
                    .and_then(Value::as_str)
                    .filter(|v| !v.trim().is_empty())
                    .map(ToOwned::to_owned);
            }
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
        origin_path: workspace_path,
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

    let (origin_path, display_name) = resolve_archived_workspace_identity(workspace_path);

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;

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

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            updated_at = snapshot_entry.timestamp.clone();
            entries.push(snapshot_entry);
        }
    }

    Ok(Some(SessionLogSnapshot {
        session_id,
        forked_from_id: None,
        workspace_path: workspace_path.to_owned(),
        origin_path,
        display_name,
        started_at,
        updated_at,
        model,
        entries,
        subagents: Vec::new(),
        is_archived: true,
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
            load_recent_session_snapshots,
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
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempDir {
        path: PathBuf,
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

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
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
    fn rejects_linked_worktree_without_commondir() {
        let temp_dir = TempDir::new("missing-commondir");
        let repo_path = temp_dir.path.join("broken-worktree");
        let git_dir = temp_dir.path.join("shared/.git/worktrees/broken");

        fs::create_dir_all(&repo_path).expect("repo dir should exist");
        fs::create_dir_all(&git_dir).expect("git dir should exist");
        fs::write(repo_path.join(".git"), format!("gitdir: {}\n", git_dir.display()))
            .expect("gitdir file should be written");

        let error = resolve_workspace_identity(&repo_path).expect_err("missing commondir should fail");
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
}
