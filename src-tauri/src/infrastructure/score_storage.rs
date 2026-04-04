use crate::{
    domain::{
        session::SessionProvider,
        session_score::{ProfileSnapshot, SessionScore, SessionScoreRecord},
    },
    infrastructure::filesystem::resolve_codex_home,
};
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

const STORAGE_SCHEMA_VERSION: u32 = 1;
const STORAGE_SUBDIR: &str = "monitor/session-scores";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSessionScoreRecord {
    schema_version: u32,
    provider: SessionProvider,
    session_id: String,
    file_path: String,
    workspace_path: String,
    session_score: Option<SessionScore>,
    profile_snapshot: ProfileSnapshot,
}

pub(crate) fn save_session_score_record(record: &SessionScoreRecord) -> io::Result<()> {
    fs::create_dir_all(resolve_storage_root()?)?;
    let payload = StoredSessionScoreRecord {
        schema_version: STORAGE_SCHEMA_VERSION,
        provider: record.provider,
        session_id: record.session_id.clone(),
        file_path: record.file_path.clone(),
        workspace_path: record.workspace_path.clone(),
        session_score: record.session_score.clone(),
        profile_snapshot: record.profile_snapshot.clone(),
    };
    let raw = serde_json::to_string_pretty(&payload).map_err(io::Error::other)?;
    fs::write(
        score_record_path(record.provider, &record.session_id, &record.workspace_path)?,
        raw,
    )
}

pub(crate) fn load_session_score_record(
    provider: SessionProvider,
    session_id: &str,
    workspace_path: &str,
) -> io::Result<Option<SessionScoreRecord>> {
    let path = score_record_path(provider, session_id, workspace_path)?;
    if !path.exists() {
        return Ok(None);
    }

    load_session_score_record_from_path(&path).map(Some)
}

pub(crate) fn load_all_session_score_records() -> io::Result<Vec<SessionScoreRecord>> {
    let storage_root = resolve_storage_root()?;
    if !storage_root.exists() {
        return Ok(Vec::new());
    }

    let mut records = Vec::new();
    for entry in fs::read_dir(storage_root)? {
        let Some(path) = read_storage_entry_path(entry)? else {
            continue;
        };
        match load_session_score_record_from_path(&path) {
            Ok(record) => records.push(record),
            Err(error) => eprintln!("skipping corrupt score record {}: {error}", path.display()),
        }
    }

    Ok(records)
}

fn resolve_storage_root() -> io::Result<PathBuf> {
    Ok(resolve_codex_home()?.join(STORAGE_SUBDIR))
}

fn score_record_path(
    provider: SessionProvider,
    session_id: &str,
    workspace_path: &str,
) -> io::Result<PathBuf> {
    Ok(resolve_storage_root()?.join(format!(
        "{}.json",
        build_storage_key(provider, session_id, workspace_path)
    )))
}

fn load_session_score_record_from_path(path: &Path) -> io::Result<SessionScoreRecord> {
    let raw = fs::read_to_string(path)?;
    let stored =
        serde_json::from_str::<StoredSessionScoreRecord>(&raw).map_err(io::Error::other)?;

    Ok(SessionScoreRecord {
        provider: stored.provider,
        session_id: stored.session_id,
        file_path: stored.file_path,
        workspace_path: stored.workspace_path,
        session_score: stored.session_score,
        profile_snapshot: stored.profile_snapshot,
    })
}

fn read_storage_entry_path(entry: io::Result<fs::DirEntry>) -> io::Result<Option<PathBuf>> {
    let path = match entry {
        Ok(entry) => entry.path(),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => return Ok(None),
        Err(error) => return Err(error),
    };

    Ok((path.extension().and_then(|value| value.to_str()) == Some("json")).then_some(path))
}

fn build_storage_key(provider: SessionProvider, session_id: &str, workspace_path: &str) -> String {
    let provider_name = match provider {
        SessionProvider::Codex => "codex",
        SessionProvider::Claude => "claude",
    };
    stable_hash(&format!(
        "{provider_name}\n{}\n{}",
        session_id.trim(),
        workspace_path.trim()
    ))
}

fn stable_hash(value: &str) -> String {
    const FNV_OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const FNV_PRIME: u64 = 0x0000_0001_0000_01b3;

    let mut hash = FNV_OFFSET_BASIS;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::{
        build_storage_key, load_all_session_score_records, resolve_storage_root,
        save_session_score_record,
    };
    use crate::{
        domain::{
            session::SessionProvider,
            session_score::{ProfileSnapshot, SessionScoreRecord},
        },
        test_support::RecentSessionTestContext,
    };
    use std::fs;

    #[test]
    fn builds_stable_key_from_provider_session_and_workspace() {
        let first = build_storage_key(SessionProvider::Codex, "session-1", "/tmp/demo");
        let second = build_storage_key(SessionProvider::Codex, "session-1", "/tmp/demo");
        let third = build_storage_key(SessionProvider::Claude, "session-1", "/tmp/demo");

        assert_eq!(first, second);
        assert_ne!(first, third);
    }

    #[test]
    fn load_all_session_score_records_skips_corrupt_files() {
        let _ctx = RecentSessionTestContext::new("score-storage-best-effort");
        let valid_record = SessionScoreRecord {
            provider: SessionProvider::Claude,
            session_id: "session-1".to_owned(),
            file_path: "/tmp/session-1.jsonl".to_owned(),
            workspace_path: "/tmp/workspace".to_owned(),
            session_score: None,
            profile_snapshot: ProfileSnapshot {
                revision: "rev-1".to_owned(),
                label: "Profile A".to_owned(),
                provider: SessionProvider::Claude,
                main_model: Some("claude-opus-4-1".to_owned()),
                guidance_hash: Some("guidance-hash".to_owned()),
                subagents: Vec::new(),
            },
        };
        save_session_score_record(&valid_record).expect("valid score record should be written");
        fs::write(
            resolve_storage_root()
                .expect("storage root should resolve")
                .join("corrupt.json"),
            "{",
        )
        .expect("corrupt record should be written");

        let records =
            load_all_session_score_records().expect("best-effort score record load should succeed");

        assert_eq!(records, vec![valid_record]);
    }
}
