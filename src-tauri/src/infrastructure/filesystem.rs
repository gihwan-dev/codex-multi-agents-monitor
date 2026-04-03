use std::{
    collections::HashSet,
    env, fs, io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const CODEX_CONFIG_FILE_NAME: &str = "config.toml";
const PROJECTS_SECTION_PREFIX: &str = "[projects.\"";

pub(crate) fn resolve_codex_home() -> io::Result<PathBuf> {
    if let Some(codex_home) = env::var_os("CODEX_HOME") {
        return expand_home_path(PathBuf::from(codex_home));
    }

    Ok(resolve_home_directory()?.join(".codex"))
}

pub(crate) fn resolve_projects_root() -> io::Result<PathBuf> {
    let codex_home = resolve_codex_home()?;
    resolve_project_roots(&codex_home)?
        .into_iter()
        .next()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "project roots are not available"))
}

pub(crate) fn resolve_project_roots(codex_home: &Path) -> io::Result<Vec<PathBuf>> {
    let mut roots = load_project_roots_from_config(codex_home)?;
    roots.extend(default_project_root_candidates());
    dedupe_paths(&mut roots);

    if roots.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "project roots are not available",
        ));
    }

    Ok(roots)
}

pub(crate) fn normalize_path(path: &Path) -> io::Result<PathBuf> {
    fs::canonicalize(path).or_else(|_| Ok(path.to_path_buf()))
}

pub(crate) fn recent_file_modified_at(path: &Path) -> SystemTime {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(UNIX_EPOCH)
}

#[cfg(test)]
pub(crate) fn sort_paths_by_recent_activity(files: &mut [PathBuf]) {
    files.sort_by(|left, right| {
        recent_file_modified_at(right)
            .cmp(&recent_file_modified_at(left))
            .then_with(|| right.cmp(left))
    });
}

pub(crate) fn collect_jsonl_files(directory: &Path, files: &mut Vec<PathBuf>) -> io::Result<()> {
    if !directory.exists() {
        return Ok(());
    }

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error)
            if matches!(
                error.kind(),
                io::ErrorKind::NotFound | io::ErrorKind::PermissionDenied
            ) =>
        {
            return Ok(());
        }
        Err(error) => return Err(error),
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) if error.kind() == io::ErrorKind::PermissionDenied => continue,
            Err(error) => return Err(error),
        };
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

fn resolve_home_directory() -> io::Result<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))
}

fn expand_home_path(path: PathBuf) -> io::Result<PathBuf> {
    let Some(raw) = path.to_str() else {
        return Ok(path);
    };

    if raw == "~" {
        return resolve_home_directory();
    }

    if let Some(stripped) = raw.strip_prefix("~/") {
        return Ok(resolve_home_directory()?.join(stripped));
    }

    Ok(path)
}

fn load_project_roots_from_config(codex_home: &Path) -> io::Result<Vec<PathBuf>> {
    let config_path = codex_home.join(CODEX_CONFIG_FILE_NAME);
    let raw = match fs::read_to_string(config_path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };

    let mut roots = Vec::new();
    for line in raw.lines() {
        let stripped = strip_comment(line).trim();
        let Some(project_path) = parse_projects_section_path(stripped) else {
            continue;
        };

        let expanded = expand_home_path(PathBuf::from(project_path))?;
        roots.extend(project_root_candidates_from_config_entry(&expanded));
    }

    Ok(roots)
}

fn strip_comment(line: &str) -> &str {
    line.split('#').next().unwrap_or(line)
}

fn parse_projects_section_path(line: &str) -> Option<String> {
    let value = line
        .strip_prefix(PROJECTS_SECTION_PREFIX)?
        .strip_suffix("\"]")?;
    Some(value.replace("\\\"", "\""))
}

fn project_root_candidates_from_config_entry(path: &Path) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if looks_like_project_container(path) {
        roots.push(path.to_path_buf());
    }

    if has_git_metadata(path) && !is_codex_worktree_path(path) {
        if let Some(parent) = path.parent() {
            roots.push(parent.to_path_buf());
        }
    }

    roots
}

fn looks_like_project_container(path: &Path) -> bool {
    let segments: Vec<&str> = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect();

    segments.ends_with(&["Documents", "Projects"])
        || segments.ends_with(&["Archives", "Projects"])
        || segments.ends_with(&["conductor", "workspaces"])
        || path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| matches!(name, "Projects" | "workspaces"))
}

fn has_git_metadata(path: &Path) -> bool {
    let git_path = path.join(".git");
    git_path.is_dir() || git_path.is_file()
}

fn is_codex_worktree_path(path: &Path) -> bool {
    let segments: Vec<&str> = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect();

    segments
        .windows(2)
        .any(|window| matches!(window, [".codex", "worktrees"]))
}

fn default_project_root_candidates() -> Vec<PathBuf> {
    let Ok(home) = resolve_home_directory() else {
        return Vec::new();
    };

    vec![
        home.join("Documents/Projects"),
        home.join("Documents/Archives/Projects"),
    ]
}

fn dedupe_paths(paths: &mut Vec<PathBuf>) {
    let mut seen = HashSet::new();
    paths.retain(|path| {
        let normalized = normalize_path(path).unwrap_or_else(|_| path.to_path_buf());
        seen.insert(normalized.display().to_string())
    });
}

#[cfg(test)]
mod tests {
    use super::{
        collect_jsonl_files, resolve_codex_home, resolve_project_roots,
        sort_paths_by_recent_activity,
    };
    use crate::test_support::TempDir;
    use crate::test_support::{create_git_workspace, RecentSessionTestContext};
    use std::{fs, thread, time::Duration};

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

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
        sort_paths_by_recent_activity(&mut files);

        assert_eq!(files[0], older_started);
        assert_eq!(files[1], newer_started);
    }

    #[test]
    fn resolves_codex_home_from_tilde_env_path() {
        let ctx = RecentSessionTestContext::new("codex-home-tilde");
        std::env::set_var("CODEX_HOME", "~/.codex");

        let codex_home = resolve_codex_home().expect("codex home should resolve");

        assert_eq!(codex_home, ctx.codex_home);
    }

    #[test]
    fn resolves_project_roots_from_codex_config_and_system_defaults() {
        let ctx = RecentSessionTestContext::new("project-roots-config");
        let custom_root = ctx.temp_root.join("Workspaces");
        let repo_path = custom_root.join("demo-app");

        create_git_workspace(&repo_path);
        fs::write(
            ctx.codex_home.join("config.toml"),
            format!(
                "[projects.\"{}\"]\ntrust_level = \"trusted\"\n",
                repo_path.display()
            ),
        )
        .expect("config should be written");

        let project_roots =
            resolve_project_roots(&ctx.codex_home).expect("project roots should resolve");

        assert!(project_roots.contains(&custom_root));
        assert!(project_roots.contains(&ctx.projects_root));
    }

    #[cfg(unix)]
    #[test]
    fn collect_jsonl_files_ignores_permission_denied_directories() {
        let temp_dir = TempDir::new("collect-jsonl-permissions");
        let accessible_file = temp_dir.path.join("visible.jsonl");
        let blocked_dir = temp_dir.path.join("blocked");

        fs::write(&accessible_file, "visible").expect("visible file should exist");
        fs::create_dir_all(&blocked_dir).expect("blocked dir should exist");
        fs::set_permissions(&blocked_dir, fs::Permissions::from_mode(0o000))
            .expect("blocked dir permissions should be updated");

        let mut files = Vec::new();
        let result = collect_jsonl_files(&temp_dir.path, &mut files);

        fs::set_permissions(&blocked_dir, fs::Permissions::from_mode(0o700))
            .expect("blocked dir permissions should be restored");

        assert!(result.is_ok());
        assert!(files.iter().any(|path| path == &accessible_file));
    }
}
