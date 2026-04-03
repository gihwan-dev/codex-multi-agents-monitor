use crate::{
    domain::eval::ExperimentDetail,
    infrastructure::{
        filesystem::resolve_codex_home,
        git::{resolve_common_dir, resolve_linked_git_dir},
    },
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::{self, Write},
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};

const STORAGE_SCHEMA_VERSION: u32 = 1;
const STORAGE_SUBDIR: &str = "monitor/evals";
const EXPERIMENTS_DIR_NAME: &str = "experiments";
const EVENTS_FILE_NAME: &str = "events.jsonl";
static EXPERIMENT_MUTATION_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> =
    OnceLock::new();

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EvalAuditEvent {
    pub(crate) timestamp_ms: u64,
    pub(crate) event_kind: String,
    pub(crate) experiment_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) case_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) run_id: Option<String>,
    pub(crate) preview: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredExperimentRecord {
    schema_version: u32,
    detail: ExperimentDetail,
}

pub(crate) fn load_all_experiment_details() -> io::Result<Vec<ExperimentDetail>> {
    let experiments_dir = resolve_experiments_dir()?;
    if !experiments_dir.exists() {
        return Ok(Vec::new());
    }

    let mut details = Vec::new();
    for entry in fs::read_dir(experiments_dir)? {
        let Some(path) = read_experiment_entry_path(entry)? else {
            continue;
        };
        details.push(load_experiment_detail_from_path(&path)?);
    }

    Ok(details)
}

pub(crate) fn load_experiment_detail(experiment_id: &str) -> io::Result<Option<ExperimentDetail>> {
    let path = experiment_file_path(experiment_id)?;
    if !path.exists() {
        return Ok(None);
    }

    load_experiment_detail_from_path(&path).map(Some)
}

pub(crate) fn experiment_mutation_lock(experiment_id: &str) -> Arc<Mutex<()>> {
    let registry = EXPERIMENT_MUTATION_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = registry.lock().unwrap_or_else(|error| error.into_inner());
    guard
        .entry(experiment_id.to_owned())
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone()
}

pub(crate) fn save_experiment_detail(detail: &ExperimentDetail) -> io::Result<()> {
    fs::create_dir_all(resolve_experiments_dir()?)?;
    let payload = StoredExperimentRecord {
        schema_version: STORAGE_SCHEMA_VERSION,
        detail: detail.clone(),
    };
    let raw = serde_json::to_string_pretty(&payload).map_err(io::Error::other)?;
    fs::write(experiment_file_path(&detail.experiment.id)?, raw)
}

pub(crate) fn delete_experiment_detail(experiment_id: &str) -> io::Result<bool> {
    let path = experiment_file_path(experiment_id)?;
    if !path.exists() {
        return Ok(false);
    }

    fs::remove_file(path)?;
    Ok(true)
}

pub(crate) fn append_audit_event(event: &EvalAuditEvent) -> io::Result<()> {
    fs::create_dir_all(resolve_storage_root()?)?;
    let event_path = resolve_storage_root()?.join(EVENTS_FILE_NAME);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(event_path)?;
    let raw = serde_json::to_string(event).map_err(io::Error::other)?;
    writeln!(file, "{raw}")?;
    Ok(())
}

pub(crate) fn resolve_repository_head_sha(repo_path: &Path) -> io::Result<String> {
    let git_metadata_path = repo_path.join(".git");
    let git_dir = if git_metadata_path.is_dir() {
        git_metadata_path
    } else if git_metadata_path.is_file() {
        resolve_linked_git_dir(&git_metadata_path)?
    } else {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "repository git metadata is unavailable",
        ));
    };

    let refs_root = resolve_common_dir(&git_dir).unwrap_or_else(|_| git_dir.clone());
    let head_contents = read_first_line(&git_dir.join("HEAD"))?;

    if let Some(reference) = head_contents.strip_prefix("ref:").map(str::trim) {
        let ref_path = refs_root.join(reference);
        if ref_path.exists() {
            return read_first_line(&ref_path);
        }

        return resolve_packed_reference(&refs_root, reference);
    }

    Ok(head_contents)
}

fn resolve_storage_root() -> io::Result<PathBuf> {
    Ok(resolve_codex_home()?.join(STORAGE_SUBDIR))
}

fn resolve_experiments_dir() -> io::Result<PathBuf> {
    Ok(resolve_storage_root()?.join(EXPERIMENTS_DIR_NAME))
}

fn experiment_file_path(experiment_id: &str) -> io::Result<PathBuf> {
    validate_experiment_id(experiment_id)?;
    Ok(resolve_experiments_dir()?.join(format!("{experiment_id}.json")))
}

fn validate_experiment_id(experiment_id: &str) -> io::Result<()> {
    if experiment_id.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "experiment id is required",
        ));
    }

    if experiment_id.contains('/') || experiment_id.contains('\\') {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "experiment id must not contain path separators",
        ));
    }

    let mut components = Path::new(experiment_id).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(()),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "experiment id must be a single path segment",
        )),
    }
}

fn read_experiment_entry_path(entry: io::Result<fs::DirEntry>) -> io::Result<Option<PathBuf>> {
    let path = match entry {
        Ok(entry) => entry.path(),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => return Ok(None),
        Err(error) => return Err(error),
    };

    Ok(is_experiment_json_path(&path).then_some(path))
}

fn is_experiment_json_path(path: &Path) -> bool {
    path.extension().and_then(|value| value.to_str()) == Some("json")
}

fn load_experiment_detail_from_path(path: &Path) -> io::Result<ExperimentDetail> {
    let raw = fs::read_to_string(path)?;
    let stored = serde_json::from_str::<StoredExperimentRecord>(&raw).map_err(io::Error::other)?;
    Ok(stored.detail)
}

fn read_first_line(path: &Path) -> io::Result<String> {
    let raw = fs::read_to_string(path)?;
    raw.lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing value"))
}

fn resolve_packed_reference(refs_root: &Path, reference: &str) -> io::Result<String> {
    let packed_refs_path = refs_root.join("packed-refs");
    let raw = fs::read_to_string(packed_refs_path)?;
    for line in raw.lines() {
        let stripped = line.trim();
        if stripped.is_empty() || stripped.starts_with('#') || stripped.starts_with('^') {
            continue;
        }

        let Some((sha, packed_reference)) = stripped.split_once(' ') else {
            continue;
        };
        if packed_reference == reference {
            return Ok(sha.to_owned());
        }
    }

    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "repository reference is unavailable",
    ))
}

#[cfg(test)]
mod tests {
    use super::{experiment_file_path, experiment_mutation_lock, resolve_repository_head_sha};
    use std::{
        fs,
        io,
        path::PathBuf,
        sync::Arc,
        time::{SystemTime, UNIX_EPOCH},
    };

    struct TempRepo {
        path: PathBuf,
    }

    impl TempRepo {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time")
                .as_nanos();
            let path = std::env::temp_dir().join(format!("eval-storage-test-{unique}"));
            fs::create_dir_all(path.join(".git/refs/heads")).expect("create git directory");
            Self { path }
        }
    }

    impl Drop for TempRepo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn resolves_head_sha_from_loose_reference() {
        let repo = TempRepo::new();
        fs::write(repo.path.join(".git/HEAD"), "ref: refs/heads/main\n").expect("write head");
        fs::write(repo.path.join(".git/refs/heads/main"), "abc123\n").expect("write ref");

        let sha = resolve_repository_head_sha(&repo.path).expect("resolve sha");

        assert_eq!(sha, "abc123");
    }

    #[test]
    fn reuses_the_same_mutation_lock_per_experiment() {
        let first = experiment_mutation_lock("exp-1");
        let second = experiment_mutation_lock("exp-1");
        let other = experiment_mutation_lock("exp-2");

        assert!(Arc::ptr_eq(&first, &second));
        assert!(!Arc::ptr_eq(&first, &other));
    }

    #[test]
    fn rejects_experiment_ids_with_path_traversal_content() {
        let error = experiment_file_path("../escape").expect_err("reject parent segment");
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);

        let error = experiment_file_path("nested/id").expect_err("reject nested path");
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    }
}
