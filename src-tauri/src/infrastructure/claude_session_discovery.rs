use crate::infrastructure::filesystem::recent_file_modified_at;
use std::{
    env, fs, io,
    path::{Path, PathBuf},
};

const CLAUDE_HOME_DIR_NAME: &str = ".claude";
const CLAUDE_PROJECTS_DIR_NAME: &str = "projects";

pub(crate) fn resolve_claude_projects_root() -> io::Result<PathBuf> {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
    Ok(home
        .join(CLAUDE_HOME_DIR_NAME)
        .join(CLAUDE_PROJECTS_DIR_NAME))
}

pub(crate) fn collect_claude_main_session_files(projects_root: &Path) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    let Some(project_dirs) = read_dir_if_available(projects_root)? else {
        return Ok(files);
    };

    for project_dir in project_dirs {
        let Some(project_path) = read_entry_path_if_available(project_dir)? else {
            continue;
        };
        if !project_path.is_dir() {
            continue;
        }
        files.extend(collect_project_session_files(&project_path)?);
    }

    files.sort_by(|left, right| {
        recent_file_modified_at(right)
            .cmp(&recent_file_modified_at(left))
            .then_with(|| right.cmp(left))
    });
    Ok(files)
}

fn collect_project_session_files(project_path: &Path) -> io::Result<Vec<PathBuf>> {
    let Some(entries) = read_dir_if_available(project_path)? else {
        return Ok(Vec::new());
    };
    let mut files = Vec::new();

    for entry in entries {
        let Some(path) = read_entry_path_if_available(entry)? else {
            continue;
        };
        if is_main_claude_session_path(&path) {
            files.push(path);
        }
    }

    Ok(files)
}

pub(crate) fn collect_claude_subagent_session_files(
    session_file: &Path,
) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    let Some(session_name) = session_file.file_stem().and_then(|value| value.to_str()) else {
        return Ok(files);
    };
    let Some(parent_dir) = session_file.parent() else {
        return Ok(files);
    };
    let subagents_dir = parent_dir.join(session_name).join("subagents");
    let Some(entries) = read_dir_if_available(&subagents_dir)? else {
        return Ok(files);
    };

    for entry in entries {
        let Some(path) = read_entry_path_if_available(entry)? else {
            continue;
        };
        if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }

    files.sort();
    Ok(files)
}

pub(crate) fn resolve_claude_subagent_meta_path(session_file: &Path) -> Option<PathBuf> {
    let file_name = session_file.file_name()?.to_str()?;
    let meta_name = file_name.strip_suffix(".jsonl")?;
    Some(session_file.with_file_name(format!("{meta_name}.meta.json")))
}

fn is_main_claude_session_path(path: &Path) -> bool {
    path.is_file() && path.extension().and_then(|value| value.to_str()) == Some("jsonl")
}

fn read_dir_if_available(directory: &Path) -> io::Result<Option<fs::ReadDir>> {
    match fs::read_dir(directory) {
        Ok(entries) => Ok(Some(entries)),
        Err(error)
            if matches!(
                error.kind(),
                io::ErrorKind::NotFound | io::ErrorKind::PermissionDenied
            ) =>
        {
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

fn read_entry_path_if_available(entry: io::Result<fs::DirEntry>) -> io::Result<Option<PathBuf>> {
    match entry {
        Ok(entry) => Ok(Some(entry.path())),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        collect_claude_main_session_files, collect_claude_subagent_session_files,
        resolve_claude_subagent_meta_path,
    };
    use crate::test_support::TempDir;
    use std::{fs, path::PathBuf};

    #[test]
    fn collects_only_top_level_project_session_files() {
        let temp_dir = TempDir::new("claude-discovery-main");
        let projects_root = temp_dir.path.join("projects");
        let project_root = projects_root.join("demo-app");
        let nested_root = project_root.join("session-001/subagents");
        fs::create_dir_all(&nested_root).expect("nested directories should exist");

        let main_file = project_root.join("session-001.jsonl");
        let nested_subagent = nested_root.join("agent-1.jsonl");
        fs::write(&main_file, "").expect("main session file should exist");
        fs::write(&nested_subagent, "").expect("subagent file should exist");

        let files =
            collect_claude_main_session_files(&projects_root).expect("discovery should succeed");

        assert_eq!(files, vec![main_file]);
    }

    #[test]
    fn collects_adjacent_subagent_jsonl_files() {
        let temp_dir = TempDir::new("claude-discovery-subagents");
        let session_file = temp_dir.path.join("demo-app/session-001.jsonl");
        let subagents_dir = temp_dir.path.join("demo-app/session-001/subagents");
        fs::create_dir_all(&subagents_dir).expect("subagents dir should exist");
        fs::write(&session_file, "").expect("session file should exist");

        let first = subagents_dir.join("agent-2.jsonl");
        let second = subagents_dir.join("agent-1.jsonl");
        fs::write(&first, "").expect("subagent file should exist");
        fs::write(&second, "").expect("subagent file should exist");

        let files =
            collect_claude_subagent_session_files(&session_file).expect("subagents should load");

        assert_eq!(files, vec![second, first]);
    }

    #[test]
    fn derives_adjacent_subagent_meta_path() {
        let session_file = PathBuf::from("/tmp/demo/agent-12.jsonl");
        let meta_path =
            resolve_claude_subagent_meta_path(&session_file).expect("meta path should resolve");

        assert_eq!(meta_path, PathBuf::from("/tmp/demo/agent-12.meta.json"));
    }
}
