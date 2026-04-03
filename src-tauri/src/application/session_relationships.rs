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

pub(crate) struct SnapshotSubagentSearch<'a> {
    pub(crate) snapshot: &'a SessionLogSnapshot,
    pub(crate) search_root: &'a Path,
    pub(crate) selected_file: &'a Path,
}

pub(crate) fn load_snapshot_subagents(
    search: SnapshotSubagentSearch<'_>,
    relationship_hints: &[ThreadSubagentHint],
) -> io::Result<Vec<SubagentSnapshot>> {
    let canonical_root = fs::canonicalize(search.search_root)?;
    let canonical_selected = fs::canonicalize(search.selected_file)?;
    let lookup = HintLookup {
        snapshot: search.snapshot,
        relationship_hints,
        canonical_root: &canonical_root,
    };
    let mut collector = SnapshotSubagentCollector::new(search.snapshot, canonical_selected);

    collector.append_candidate_paths(
        hinted_candidate_paths(&lookup, HintSource::Edge)
            .into_iter()
            .chain(hinted_candidate_paths(&lookup, HintSource::Source)),
    );
    collector.append_candidate_paths(collect_fallback_files(&canonical_root)?);

    Ok(collector.finish())
}

#[derive(Clone, Copy)]
enum HintSource {
    Edge,
    Source,
}

struct HintLookup<'a> {
    snapshot: &'a SessionLogSnapshot,
    relationship_hints: &'a [ThreadSubagentHint],
    canonical_root: &'a Path,
}

struct SnapshotSubagentCollector<'a> {
    snapshot: &'a SessionLogSnapshot,
    canonical_selected: PathBuf,
    attached_session_ids: HashSet<String>,
    visited_paths: HashSet<PathBuf>,
    subagents: Vec<SubagentSnapshot>,
}

impl<'a> SnapshotSubagentCollector<'a> {
    fn new(snapshot: &'a SessionLogSnapshot, canonical_selected: PathBuf) -> Self {
        Self {
            snapshot,
            canonical_selected,
            attached_session_ids: HashSet::new(),
            visited_paths: HashSet::new(),
            subagents: Vec::new(),
        }
    }

    fn append_candidate_paths<I>(&mut self, candidate_paths: I)
    where
        I: IntoIterator<Item = PathBuf>,
    {
        for candidate_path in candidate_paths {
            self.append_candidate_path(candidate_path);
        }
    }

    fn append_candidate_path(&mut self, candidate_path: PathBuf) {
        if candidate_path == self.canonical_selected
            || !self.visited_paths.insert(candidate_path.clone())
        {
            return;
        }

        let Ok(Some(subagent)) = read_subagent_snapshot(&candidate_path) else {
            return;
        };
        if !matches_parent_thread_id(self.snapshot, &subagent.parent_thread_id) {
            return;
        }
        if !self
            .attached_session_ids
            .insert(subagent.session_id.clone())
        {
            return;
        }

        self.subagents.push(subagent);
    }

    fn finish(self) -> Vec<SubagentSnapshot> {
        self.subagents
    }
}

fn hinted_candidate_paths(lookup: &HintLookup<'_>, hint_source: HintSource) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut seen_paths = HashSet::new();

    for hint in lookup.relationship_hints {
        if !matches_related_parent(lookup.snapshot, hint_parent_thread_id(hint, hint_source)) {
            continue;
        }

        let Some(canonical_path) = canonical_hint_path(hint, lookup.canonical_root) else {
            continue;
        };
        if !seen_paths.insert(canonical_path.clone()) {
            continue;
        }

        paths.push(canonical_path);
    }

    paths
}

fn collect_fallback_files(canonical_root: &Path) -> io::Result<Vec<PathBuf>> {
    let mut fallback_files = Vec::new();
    collect_jsonl_files(canonical_root, &mut fallback_files)?;
    fallback_files.sort();
    Ok(fallback_files)
}

fn hint_parent_thread_id(hint: &ThreadSubagentHint, hint_source: HintSource) -> Option<&str> {
    match hint_source {
        HintSource::Edge => hint.edge_parent_thread_id.as_deref(),
        HintSource::Source => hint.source_parent_thread_id.as_deref(),
    }
}

fn canonical_hint_path(hint: &ThreadSubagentHint, canonical_root: &Path) -> Option<PathBuf> {
    let canonical_path = fs::canonicalize(Path::new(&hint.rollout_path)).ok()?;
    if !canonical_path.starts_with(canonical_root) {
        return None;
    }
    if canonical_path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
        return None;
    }

    Some(canonical_path)
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
    use super::{load_snapshot_subagents, SnapshotSubagentSearch};
    use crate::{
        domain::session::SessionLogSnapshot,
        infrastructure::state_sqlite::ThreadSubagentHint,
        test_support::{write_session_lines, write_worker_subagent_session, TempDir},
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
            max_context_window_tokens: None,
            entries: Vec::new(),
            subagents: Vec::new(),
            is_archived: false,
            prompt_assembly: Vec::new(),
        }
    }

    fn write_sparse_snapshot_fixture(
        search_root: &std::path::Path,
    ) -> (std::path::PathBuf, std::path::PathBuf, std::path::PathBuf) {
        let selected_file = search_root.join("parent.jsonl");
        let hinted_child_file = search_root.join("child-hinted.jsonl");
        let jsonl_only_child_file = search_root.join("nested/child-jsonl-only.jsonl");

        write_session_lines(
            &selected_file,
            [
                r#"{"timestamp":"2026-03-20T00:00:00.000Z","type":"session_meta","payload":{"id":"parent-001","source":"desktop","cwd":"/tmp/workspace","timestamp":"2026-03-20T00:00:00.000Z"}}"#,
            ],
        );
        write_worker_subagent_session(
            &hinted_child_file,
            "child-hinted",
            "parent-001",
            "Euler",
            "Child output",
        );
        write_worker_subagent_session(
            &jsonl_only_child_file,
            "child-jsonl-only",
            "parent-001",
            "Noether",
            "Child output",
        );

        (selected_file, hinted_child_file, jsonl_only_child_file)
    }

    #[test]
    fn supplements_sparse_sqlite_hints_with_full_jsonl_scan() {
        let temp_dir = TempDir::new("session-relationships-sparse");
        let search_root = temp_dir.path.join("sessions");
        let (selected_file, hinted_child_file, _jsonl_only_child_file) =
            write_sparse_snapshot_fixture(&search_root);
        let snapshot = test_snapshot("parent-001");

        let subagents = load_snapshot_subagents(
            SnapshotSubagentSearch {
                snapshot: &snapshot,
                search_root: &search_root,
                selected_file: &selected_file,
            },
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
