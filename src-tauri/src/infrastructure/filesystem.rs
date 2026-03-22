use std::{
    env, fs, io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub(crate) fn resolve_codex_home() -> io::Result<PathBuf> {
    if let Some(codex_home) = env::var_os("CODEX_HOME") {
        return Ok(PathBuf::from(codex_home));
    }

    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
    Ok(home.join(".codex"))
}

pub(crate) fn resolve_projects_root() -> io::Result<PathBuf> {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
    Ok(home.join("Documents/Projects"))
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

#[cfg(test)]
mod tests {
    use super::sort_paths_by_recent_activity;
    use crate::test_support::TempDir;
    use std::{fs, thread, time::Duration};

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
}
