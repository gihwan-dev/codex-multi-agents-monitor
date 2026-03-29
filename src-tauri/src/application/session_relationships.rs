use crate::{
    domain::session::{SessionLogSnapshot, SubagentSnapshot},
    infrastructure::{
        filesystem::collect_jsonl_files, session_jsonl::read_subagent_snapshot,
        state_sqlite::ThreadSubagentHint,
    },
};
use std::{
    collections::HashSet,
    fs, io,
    path::{Path, PathBuf},
};

pub(crate) fn load_snapshot_subagents(
    snapshot: &SessionLogSnapshot,
    search_root: &Path,
    selected_file: &Path,
    relationship_hints: &[ThreadSubagentHint],
) -> io::Result<Vec<SubagentSnapshot>> {
    let canonical_root = fs::canonicalize(search_root)?;
    let canonical_selected = fs::canonicalize(selected_file)?;
    let edge_candidates = hinted_candidate_paths(
        snapshot,
        relationship_hints,
        &canonical_root,
        HintSource::Edge,
    );
    let source_candidates = hinted_candidate_paths(
        snapshot,
        relationship_hints,
        &canonical_root,
        HintSource::Source,
    );
    let mut attached_session_ids = HashSet::new();
    let mut visited_paths = HashSet::new();
    let mut subagents = Vec::new();

    for candidate_path in edge_candidates.into_iter().chain(source_candidates) {
        append_subagent_if_related(
            snapshot,
            &canonical_selected,
            candidate_path,
            &mut visited_paths,
            &mut attached_session_ids,
            &mut subagents,
        );
    }

    let mut fallback_files = Vec::new();
    collect_jsonl_files(&canonical_root, &mut fallback_files)?;
    fallback_files.sort();

    for candidate_path in fallback_files {
        append_subagent_if_related(
            snapshot,
            &canonical_selected,
            candidate_path,
            &mut visited_paths,
            &mut attached_session_ids,
            &mut subagents,
        );
    }

    Ok(subagents)
}

#[derive(Clone, Copy)]
enum HintSource {
    Edge,
    Source,
}

fn hinted_candidate_paths(
    snapshot: &SessionLogSnapshot,
    relationship_hints: &[ThreadSubagentHint],
    canonical_root: &Path,
    hint_source: HintSource,
) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut seen_paths = HashSet::new();

    for hint in relationship_hints {
        let parent_thread_id = match hint_source {
            HintSource::Edge => hint.edge_parent_thread_id.as_deref(),
            HintSource::Source => hint.source_parent_thread_id.as_deref(),
        };
        if !matches_related_parent(snapshot, parent_thread_id) {
            continue;
        }

        let Ok(canonical_path) = fs::canonicalize(Path::new(&hint.rollout_path)) else {
            continue;
        };
        if !canonical_path.starts_with(canonical_root) {
            continue;
        }
        if canonical_path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }
        if !seen_paths.insert(canonical_path.clone()) {
            continue;
        }

        paths.push(canonical_path);
    }

    paths
}

fn append_subagent_if_related(
    snapshot: &SessionLogSnapshot,
    canonical_selected: &Path,
    candidate_path: PathBuf,
    visited_paths: &mut HashSet<PathBuf>,
    attached_session_ids: &mut HashSet<String>,
    subagents: &mut Vec<SubagentSnapshot>,
) {
    if candidate_path == canonical_selected || !visited_paths.insert(candidate_path.clone()) {
        return;
    }

    let Ok(Some(subagent)) = read_subagent_snapshot(&candidate_path) else {
        return;
    };
    if !matches_parent_thread_id(snapshot, &subagent.parent_thread_id) {
        return;
    }
    if !attached_session_ids.insert(subagent.session_id.clone()) {
        return;
    }

    subagents.push(subagent);
}

fn matches_related_parent(snapshot: &SessionLogSnapshot, parent_thread_id: Option<&str>) -> bool {
    parent_thread_id
        .is_some_and(|parent_thread_id| matches_parent_thread_id(snapshot, parent_thread_id))
}

fn matches_parent_thread_id(snapshot: &SessionLogSnapshot, parent_thread_id: &str) -> bool {
    parent_thread_id == snapshot.session_id
        || snapshot
            .forked_from_id
            .as_ref()
            .is_some_and(|forked_from_id| parent_thread_id == forked_from_id)
}

#[cfg(test)]
mod tests {
    use super::load_snapshot_subagents;
    use crate::{
        domain::session::SessionLogSnapshot,
        infrastructure::state_sqlite::ThreadSubagentHint,
        test_support::{write_session_lines, TempDir},
    };

    fn test_snapshot(session_id: &str) -> SessionLogSnapshot {
        SessionLogSnapshot {
            session_id: session_id.to_owned(),
            forked_from_id: None,
            workspace_path: "/tmp/workspace".to_owned(),
            origin_path: "/tmp/workspace".to_owned(),
            display_name: "workspace".to_owned(),
            started_at: "2026-03-20T00:00:00.000Z".to_owned(),
            updated_at: "2026-03-20T00:00:00.000Z".to_owned(),
            model: None,
            entries: Vec::new(),
            subagents: Vec::new(),
            is_archived: false,
            prompt_assembly: Vec::new(),
        }
    }

    fn write_subagent_file(
        path: &std::path::Path,
        session_id: &str,
        parent_thread_id: &str,
        nickname: &str,
    ) {
        write_session_lines(
            path,
            [
                format!(
                    r#"{{"timestamp":"2026-03-20T00:01:00.000Z","type":"session_meta","payload":{{"id":"{session_id}","source":{{"subagent":{{"thread_spawn":{{"parent_thread_id":"{parent_thread_id}","depth":1,"agent_nickname":"{nickname}","agent_role":"worker"}}}}}},"cwd":"/tmp/workspace","timestamp":"2026-03-20T00:01:00.000Z"}}}}"#
                ),
                r#"{"timestamp":"2026-03-20T00:01:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-20T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Child output"}]}}"#.to_owned(),
                r#"{"timestamp":"2026-03-20T00:01:03.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub","last_agent_message":"done"}}"#.to_owned(),
            ],
        );
    }

    #[test]
    fn supplements_sparse_sqlite_hints_with_full_jsonl_scan() {
        let temp_dir = TempDir::new("session-relationships-sparse");
        let search_root = temp_dir.path.join("sessions");
        let selected_file = search_root.join("parent.jsonl");
        let hinted_child_file = search_root.join("child-hinted.jsonl");
        let jsonl_only_child_file = search_root.join("nested/child-jsonl-only.jsonl");
        let snapshot = test_snapshot("parent-001");

        std::fs::create_dir_all(&search_root).expect("search root should be created");
        std::fs::create_dir_all(
            jsonl_only_child_file
                .parent()
                .expect("nested child dir should exist"),
        )
        .expect("nested child dir should be created");
        write_session_lines(
            &selected_file,
            [
                r#"{"timestamp":"2026-03-20T00:00:00.000Z","type":"session_meta","payload":{"id":"parent-001","source":"desktop","cwd":"/tmp/workspace","timestamp":"2026-03-20T00:00:00.000Z"}}"#,
            ],
        );
        write_subagent_file(&hinted_child_file, "child-hinted", "parent-001", "Euler");
        write_subagent_file(
            &jsonl_only_child_file,
            "child-jsonl-only",
            "parent-001",
            "Noether",
        );

        let subagents = load_snapshot_subagents(
            &snapshot,
            &search_root,
            &selected_file,
            &[ThreadSubagentHint {
                rollout_path: hinted_child_file.display().to_string(),
                edge_parent_thread_id: Some("parent-001".to_owned()),
                source_parent_thread_id: None,
            }],
        )
        .expect("subagents should load");

        assert_eq!(subagents.len(), 2);
        assert!(subagents
            .iter()
            .any(|subagent| subagent.session_id == "child-hinted"));
        assert!(subagents
            .iter()
            .any(|subagent| subagent.session_id == "child-jsonl-only"));
    }
}
