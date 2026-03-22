use crate::{
    application::workspace_identity::{
        is_conductor_workspace_path, resolve_archived_workspace_identity,
    },
    domain::{
        ingest_policy::{filter_archived_index, ARCHIVED_INDEX_SCAN_LIMIT},
        session::{ArchivedSessionIndex, ArchivedSessionIndexResult, SessionLogSnapshot},
    },
    infrastructure::{
        filesystem::{collect_jsonl_files, resolve_codex_home},
        session_jsonl::{
            parse_archived_index_entry, parse_archived_session_snapshot, read_subagent_snapshot,
        },
    },
};
use std::{fs, io, path::Path};

pub(crate) fn load_archived_session_index(
    offset: usize,
    limit: usize,
    search: Option<String>,
    index: &[ArchivedSessionIndex],
) -> ArchivedSessionIndexResult {
    filter_archived_index(index, offset, limit, search)
}

pub(crate) fn build_archived_index() -> io::Result<Vec<ArchivedSessionIndex>> {
    let codex_home = resolve_codex_home()?;
    let archived_root = codex_home.join("archived_sessions");
    let mut archived_files = Vec::new();
    collect_jsonl_files(&archived_root, &mut archived_files)?;
    archived_files.sort_by(|left, right| right.cmp(left));

    let mut entries = Vec::new();
    for file_path in &archived_files {
        if let Ok(Some(entry)) = build_archived_index_entry(file_path) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

pub(crate) fn load_archived_session_snapshot_from_disk(
    file_path: &str,
) -> Option<SessionLogSnapshot> {
    let codex_home = resolve_codex_home().ok()?;
    let archived_root = codex_home.join("archived_sessions");
    let path = Path::new(file_path);

    let canonical_path = fs::canonicalize(path).ok()?;
    let canonical_root = fs::canonicalize(&archived_root).ok()?;
    if !canonical_path.starts_with(&canonical_root) {
        return None;
    }

    let mut snapshot = build_archived_session_snapshot(path).ok()??;

    if let Some(parent_dir) = path.parent() {
        if let Ok(dir_entries) = fs::read_dir(parent_dir) {
            for entry in dir_entries.flatten() {
                let sub_path = entry.path();
                if sub_path == canonical_path {
                    continue;
                }
                if sub_path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    != Some("jsonl")
                {
                    continue;
                }
                if let Ok(Some(subagent)) = read_subagent_snapshot(&sub_path) {
                    if subagent.parent_thread_id == snapshot.session_id
                        || snapshot
                            .forked_from_id
                            .as_ref()
                            .is_some_and(|forked_from_id| {
                                subagent.parent_thread_id == *forked_from_id
                            })
                    {
                        snapshot.subagents.push(subagent);
                    }
                }
            }
        }
    }

    Some(snapshot)
}

fn build_archived_index_entry(session_file: &Path) -> io::Result<Option<ArchivedSessionIndex>> {
    let parsed =
        parse_archived_index_entry(session_file, ARCHIVED_INDEX_SCAN_LIMIT, |workspace_path| {
            is_conductor_workspace_path(Path::new(workspace_path))
        })?;

    Ok(parsed.map(|parsed| {
        let (origin_path, display_name) =
            resolve_archived_workspace_identity(&parsed.workspace_path);

        ArchivedSessionIndex {
            session_id: parsed.session_id,
            workspace_path: parsed.workspace_path,
            origin_path,
            display_name,
            started_at: parsed.started_at,
            updated_at: parsed.updated_at,
            model: parsed.model,
            message_count: 0,
            file_path: session_file.display().to_string(),
            first_user_message: parsed.first_user_message,
        }
    }))
}

fn build_archived_session_snapshot(session_file: &Path) -> io::Result<Option<SessionLogSnapshot>> {
    let parsed = parse_archived_session_snapshot(session_file, |workspace_path| {
        is_conductor_workspace_path(Path::new(workspace_path))
    })?;

    Ok(parsed.map(|parsed| {
        let (origin_path, display_name) =
            resolve_archived_workspace_identity(&parsed.workspace_path);

        SessionLogSnapshot {
            session_id: parsed.session_id,
            forked_from_id: parsed.forked_from_id,
            workspace_path: parsed.workspace_path,
            origin_path,
            display_name,
            started_at: parsed.started_at,
            updated_at: parsed.updated_at,
            model: parsed.model,
            entries: parsed.entries,
            subagents: Vec::new(),
            is_archived: true,
            prompt_assembly: parsed.prompt_assembly,
        }
    }))
}
