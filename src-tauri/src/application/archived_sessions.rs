use crate::{
    application::{
        session_relationships::{load_snapshot_subagents, SnapshotSubagentSearch},
        workspace_identity::{is_conductor_workspace_path, resolve_archived_workspace_identity},
    },
    domain::{
        ingest_policy::{filter_archived_index, ArchivedIndexQuery, ARCHIVED_INDEX_SCAN_LIMIT},
        session::{ArchivedSessionIndex, ArchivedSessionIndexResult, SessionLogSnapshot},
    },
    infrastructure::{
        filesystem::{collect_jsonl_files, resolve_codex_home},
        session_jsonl::{parse_archived_index_entry, parse_archived_session_snapshot},
        state_sqlite::load_thread_subagent_hints,
    },
};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(crate) fn load_archived_session_index(
    query: ArchivedIndexQuery<'_>,
) -> ArchivedSessionIndexResult {
    filter_archived_index(query)
}

pub(crate) fn build_archived_index() -> io::Result<Vec<ArchivedSessionIndex>> {
    let codex_home = resolve_codex_home()?;
    let archived_root = codex_home.join("archived_sessions");
    let archived_files = collect_archived_session_files(&archived_root)?;

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
    snapshot.subagents = load_archived_subagents_best_effort(
        &snapshot,
        &ArchivedSubagentScope {
            archived_root: &archived_root,
            canonical_path: &canonical_path,
            codex_home: &codex_home,
        },
    );

    Some(snapshot)
}

struct ArchivedSubagentScope<'a> {
    archived_root: &'a Path,
    canonical_path: &'a Path,
    codex_home: &'a Path,
}

fn load_archived_subagents_best_effort(
    snapshot: &SessionLogSnapshot,
    scope: &ArchivedSubagentScope<'_>,
) -> Vec<crate::domain::session::SubagentSnapshot> {
    let relationship_hints = load_thread_subagent_hints(scope.codex_home).unwrap_or_default();

    load_snapshot_subagents(
        SnapshotSubagentSearch {
            snapshot,
            search_root: scope.archived_root,
            selected_file: scope.canonical_path,
        },
        &relationship_hints,
    )
    .unwrap_or_default()
}

fn collect_archived_session_files(archived_root: &Path) -> io::Result<Vec<PathBuf>> {
    let mut archived_files = Vec::new();
    collect_jsonl_files(archived_root, &mut archived_files)?;
    archived_files.sort_by(|left, right| right.cmp(left));
    Ok(archived_files)
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

#[cfg(test)]
mod tests {
    use super::{
        load_archived_session_snapshot_from_disk, load_archived_subagents_best_effort,
        ArchivedSubagentScope,
    };
    use crate::domain::session::SessionLogSnapshot;
    use crate::test_support::{
        session_meta_line_with_fork, write_session_lines, write_worker_subagent_session,
        RecentSessionTestContext,
    };
    use std::path::Path;

    fn write_archived_nested_subagent_fixture(
        selected_file: &Path,
        nested_subagent_file: &Path,
        workspace_path: &Path,
    ) {
        write_session_lines(
            selected_file,
            vec![
                session_meta_line_with_fork("archived-parent", workspace_path, Some("fork-root")),
                r#"{"timestamp":"2026-03-21T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Inspect archived snapshot"}]}}"#
                    .to_owned(),
            ],
        );
        write_worker_subagent_session(
            nested_subagent_file,
            "archived-child",
            "fork-root",
            "Turing",
            "Nested archived child",
        );
    }

    #[test]
    fn loads_archived_subagents_from_nested_paths_with_shared_relationship_resolution() {
        let ctx = RecentSessionTestContext::new("archived-snapshot-subagents");
        let archived_root = ctx.codex_home.join("archived_sessions");
        let workspace_path = ctx.temp_root.join("Archives/demo-app");
        let selected_file = archived_root.join("2026/parent.jsonl");
        let nested_subagent_file = archived_root.join("2026/agents/nested-subagent.jsonl");

        write_archived_nested_subagent_fixture(
            &selected_file,
            &nested_subagent_file,
            &workspace_path,
        );

        let snapshot =
            load_archived_session_snapshot_from_disk(selected_file.to_string_lossy().as_ref())
                .expect("archived snapshot should load");

        assert_eq!(snapshot.session_id, "archived-parent");
        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(snapshot.subagents[0].session_id, "archived-child");
        assert_eq!(snapshot.subagents[0].parent_thread_id, "fork-root");
    }

    #[test]
    fn archived_subagent_loading_is_best_effort_on_resolver_errors() {
        let snapshot = SessionLogSnapshot {
            session_id: "archived-parent".to_owned(),
            forked_from_id: None,
            workspace_path: "/tmp/workspace".to_owned(),
            origin_path: "/tmp/workspace".to_owned(),
            display_name: "workspace".to_owned(),
            started_at: "2026-03-20T00:00:00.000Z".to_owned(),
            updated_at: "2026-03-20T00:00:00.000Z".to_owned(),
            model: None,
            entries: Vec::new(),
            subagents: Vec::new(),
            is_archived: true,
            prompt_assembly: Vec::new(),
        };

        let subagents = load_archived_subagents_best_effort(
            &snapshot,
            &ArchivedSubagentScope {
                archived_root: Path::new("/definitely/missing/archived-root"),
                canonical_path: Path::new("/definitely/missing/archived-root/parent.jsonl"),
                codex_home: Path::new("/definitely/missing/codex-home"),
            },
        );

        assert!(subagents.is_empty());
    }
}
