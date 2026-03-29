use crate::{
    application::{
        session_relationships::load_snapshot_subagents,
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
        &archived_root,
        &canonical_path,
        &codex_home,
    );

    Some(snapshot)
}

fn load_archived_subagents_best_effort(
    snapshot: &SessionLogSnapshot,
    archived_root: &Path,
    canonical_path: &Path,
    codex_home: &Path,
) -> Vec<crate::domain::session::SubagentSnapshot> {
    let relationship_hints = load_thread_subagent_hints(codex_home).unwrap_or_default();

    load_snapshot_subagents(snapshot, archived_root, canonical_path, &relationship_hints)
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
    use super::{load_archived_session_snapshot_from_disk, load_archived_subagents_best_effort};
    use crate::domain::session::SessionLogSnapshot;
    use crate::test_support::{
        session_meta_line_with_fork, write_session_lines, RecentSessionTestContext,
    };
    use std::path::Path;

    #[test]
    fn loads_archived_subagents_from_nested_paths_with_shared_relationship_resolution() {
        let ctx = RecentSessionTestContext::new("archived-snapshot-subagents");
        let archived_root = ctx.codex_home.join("archived_sessions");
        let workspace_path = ctx.temp_root.join("Archives/demo-app");
        let selected_file = archived_root.join("2026/parent.jsonl");
        let nested_subagent_file = archived_root.join("2026/agents/nested-subagent.jsonl");

        std::fs::create_dir_all(selected_file.parent().expect("parent dir should exist"))
            .expect("selected parent dir should exist");
        std::fs::create_dir_all(
            nested_subagent_file
                .parent()
                .expect("nested parent dir should exist"),
        )
        .expect("nested subagent dir should exist");
        write_session_lines(
            &selected_file,
            vec![
                session_meta_line_with_fork("archived-parent", &workspace_path, Some("fork-root")),
                r#"{"timestamp":"2026-03-21T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Inspect archived snapshot"}]}}"#
                    .to_owned(),
            ],
        );
        write_session_lines(
            &nested_subagent_file,
            [
                r#"{"timestamp":"2026-03-21T00:01:00.000Z","type":"session_meta","payload":{"id":"archived-child","source":{"subagent":{"thread_spawn":{"parent_thread_id":"fork-root","depth":1,"agent_nickname":"Turing","agent_role":"worker"}}},"cwd":"/tmp/test","timestamp":"2026-03-21T00:01:00.000Z"}}"#,
                r#"{"timestamp":"2026-03-21T00:01:01.000Z","type":"turn_context","payload":{"model":"gpt-5-mini"}}"#,
                r#"{"timestamp":"2026-03-21T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Nested archived child"}]}}"#,
            ],
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
            Path::new("/definitely/missing/archived-root"),
            Path::new("/definitely/missing/archived-root/parent.jsonl"),
            Path::new("/definitely/missing/codex-home"),
        );

        assert!(subagents.is_empty());
    }
}
