use crate::{
    domain::workspace::{build_workspace_identity, WorkspaceIdentity},
    infrastructure::{
        filesystem::{normalize_path, resolve_projects_root},
        git::{resolve_common_dir, resolve_linked_git_dir},
    },
};
use std::{
    collections::HashMap,
    io,
    path::{Path, PathBuf},
};

pub(crate) fn resolve_workspace_identities(
    repo_paths: Vec<String>,
) -> HashMap<String, WorkspaceIdentity> {
    repo_paths
        .into_iter()
        .filter_map(|repo_path| {
            resolve_workspace_identity(Path::new(&repo_path))
                .ok()
                .map(|identity| (repo_path, identity))
        })
        .collect()
}

pub(crate) fn resolve_workspace_identity(repo_path: &Path) -> io::Result<WorkspaceIdentity> {
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

pub(crate) fn resolve_live_session_workspace_identity(
    workspace_path: &Path,
    projects_root: &Path,
) -> io::Result<WorkspaceIdentity> {
    if is_conductor_workspace_path(workspace_path) {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "conductor workspaces are excluded from live sessions",
        ));
    }

    if is_documents_archives_workspace_path(workspace_path) {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "archived project workspaces are excluded from live sessions",
        ));
    }

    let normalized_projects_root =
        normalize_path(projects_root).unwrap_or_else(|_| projects_root.to_path_buf());

    if let Ok(identity) = resolve_workspace_identity(workspace_path) {
        let origin_path = normalize_path(Path::new(&identity.origin_path))
            .unwrap_or_else(|_| PathBuf::from(identity.origin_path.clone()));

        if origin_path.starts_with(&normalized_projects_root) && origin_path.exists() {
            return Ok(identity);
        }
    }

    let inferred_origin = infer_live_projects_origin(workspace_path, &normalized_projects_root)
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "live session workspace does not resolve into Documents/Projects",
            )
        })?;

    if !inferred_origin.exists() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "live session workspace origin missing",
        ));
    }

    let normalized_workspace =
        normalize_path(workspace_path).unwrap_or_else(|_| workspace_path.to_path_buf());

    Ok(build_workspace_identity(
        inferred_origin.clone(),
        inferred_origin != normalized_workspace,
    ))
}

pub(crate) fn resolve_session_workspace_identity(
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

pub(crate) fn resolve_archived_workspace_identity(workspace_path: &str) -> (String, String) {
    let path = Path::new(workspace_path);

    if let Ok(projects_root) = resolve_projects_root() {
        if let Ok(identity) = resolve_session_workspace_identity(path, &projects_root) {
            return (identity.origin_path, identity.display_name);
        }
    }

    let display_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("unknown")
        .to_owned();

    (workspace_path.to_owned(), display_name)
}

pub(crate) fn is_conductor_workspace_path(workspace_path: &Path) -> bool {
    let segments: Vec<&str> = workspace_path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect();

    segments
        .windows(4)
        .any(|window| matches!(window, ["conductor", "workspaces", _, _]))
}

pub(crate) fn is_documents_archives_workspace_path(workspace_path: &Path) -> bool {
    let segments: Vec<&str> = workspace_path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect();

    segments
        .windows(2)
        .any(|window| matches!(window, ["Documents", "Archives"]))
}

fn infer_projects_origin(workspace_path: &Path, projects_root: &Path) -> Option<PathBuf> {
    let normalized_workspace = normalize_path(workspace_path).ok()?;
    let normalized_projects_root =
        normalize_path(projects_root).unwrap_or_else(|_| projects_root.to_path_buf());

    let candidate = if normalized_workspace.starts_with(&normalized_projects_root) {
        let relative = normalized_workspace
            .strip_prefix(&normalized_projects_root)
            .ok()?;
        let first_segment = relative.components().next()?;
        normalized_projects_root.join(first_segment.as_os_str())
    } else {
        let workspace_file_name = normalized_workspace.file_name()?.to_str()?;
        normalized_projects_root.join(workspace_file_name)
    };

    let normalized_candidate = normalize_path(&candidate).unwrap_or(candidate);
    if normalized_candidate.starts_with(&normalized_projects_root) {
        Some(normalized_candidate)
    } else {
        None
    }
}

fn infer_live_projects_origin(workspace_path: &Path, projects_root: &Path) -> Option<PathBuf> {
    let normalized_workspace = normalize_path(workspace_path).ok()?;
    let normalized_projects_root =
        normalize_path(projects_root).unwrap_or_else(|_| projects_root.to_path_buf());

    if !normalized_workspace.starts_with(&normalized_projects_root) {
        return None;
    }

    let relative = normalized_workspace
        .strip_prefix(&normalized_projects_root)
        .ok()?;
    let first_segment = relative.components().next()?;
    let candidate = normalized_projects_root.join(first_segment.as_os_str());
    let normalized_candidate = normalize_path(&candidate).unwrap_or(candidate);

    if normalized_candidate.starts_with(&normalized_projects_root) {
        Some(normalized_candidate)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{
        is_conductor_workspace_path, resolve_live_session_workspace_identity,
        resolve_workspace_identity,
    };
    use crate::{
        infrastructure::filesystem::normalize_path,
        test_support::{create_linked_worktree, TempDir},
    };
    use std::{fs, io, path::Path};

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
    fn resolves_live_existing_codex_worktree_to_origin_identity() {
        let temp_dir = TempDir::new("live-codex-worktree");
        let projects_root = temp_dir.path.join("Documents/Projects");
        let origin_repo_path = projects_root.join("exem-ui");
        let workspace_path = temp_dir.path.join(".codex/worktrees/fcaf/exem-ui");

        fs::create_dir_all(&projects_root).expect("projects root should exist");
        create_linked_worktree(&origin_repo_path, &workspace_path, "fcaf");

        let identity = resolve_live_session_workspace_identity(&workspace_path, &projects_root)
            .expect("existing codex worktrees should resolve to the origin repo");
        let expected_origin_path = normalize_path(&origin_repo_path)
            .expect("origin path should normalize")
            .display()
            .to_string();

        assert_eq!(identity.display_name, "exem-ui");
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
}
