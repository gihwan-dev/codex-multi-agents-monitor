use serde::Serialize;
use std::{
    collections::HashMap,
    fs,
    io,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceIdentity {
    origin_path: String,
    display_name: String,
    is_worktree: bool,
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
        .invoke_handler(tauri::generate_handler![resolve_workspace_identities])
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
