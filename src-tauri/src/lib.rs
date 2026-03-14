use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    env,
    fs::{self, File},
    io::{self, BufRead, BufReader},
    path::{Path, PathBuf},
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
struct SessionMessageSnapshot {
    timestamp: String,
    role: String,
    text: String,
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
    messages: Vec<SessionMessageSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionLogSnapshot {
    session_id: String,
    workspace_path: String,
    origin_path: String,
    display_name: String,
    started_at: String,
    updated_at: String,
    model: Option<String>,
    messages: Vec<SessionMessageSnapshot>,
    subagents: Vec<SubagentSnapshot>,
}

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
            .filter(|sub| sub.parent_thread_id == parent.session_id)
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

    let mut messages = Vec::new();
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

        let Some(message) = extract_message_snapshot(&entry) else {
            continue;
        };

        updated_at = message.timestamp.clone();
        messages.push(message);
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
        messages,
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

    let workspace_identity =
        resolve_session_workspace_identity(Path::new(workspace_path), projects_root).ok();
    let Some(workspace_identity) = workspace_identity else {
        return Ok(None);
    };

    let mut messages = Vec::new();
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

        let Some(message) = extract_message_snapshot(&entry) else {
            continue;
        };

        updated_at = message.timestamp.clone();
        messages.push(message);
    }

    Ok(Some(SessionLogSnapshot {
        session_id,
        workspace_path: workspace_path.to_owned(),
        origin_path: workspace_identity.origin_path,
        display_name: workspace_identity.display_name,
        started_at,
        updated_at,
        model,
        messages,
        subagents: Vec::new(),
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

fn extract_message_snapshot(entry: &Value) -> Option<SessionMessageSnapshot> {
    let payload = entry.get("payload")?.as_object()?;
    if payload.get("type")?.as_str()? != "message" {
        return None;
    }

    let role = payload.get("role")?.as_str()?;
    if role != "user" && role != "assistant" {
        return None;
    }

    let timestamp = entry.get("timestamp")?.as_str()?.to_owned();
    let text = extract_message_text(payload.get("content")?)?;

    Some(SessionMessageSnapshot {
        timestamp,
        role: role.to_owned(),
        text,
    })
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_recent_session_snapshots,
            resolve_workspace_identities
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
