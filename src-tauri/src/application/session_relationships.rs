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
    let hinted_candidates_found = !edge_candidates.is_empty() || !source_candidates.is_empty();
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

    if !hinted_candidates_found || subagents.is_empty() {
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
