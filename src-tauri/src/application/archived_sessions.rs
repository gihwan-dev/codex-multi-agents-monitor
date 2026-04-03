use crate::{
    application::{
        session_context_window::resolve_snapshot_max_context_window_tokens,
        session_relationships::{load_snapshot_subagents, SnapshotSubagentSearch},
        workspace_identity::{
            is_conductor_workspace_path, resolve_archived_workspace_identity,
            resolve_session_workspace_identity,
        },
    },
    domain::{
        ingest_policy::{filter_archived_index, ArchivedIndexQuery, ARCHIVED_INDEX_SCAN_LIMIT},
        session::{ArchivedSessionIndex, ArchivedSessionIndexResult, SessionLogSnapshot},
    },
    infrastructure::{
        claude_session_discovery::{
            collect_claude_main_session_files, resolve_claude_projects_root,
        },
        claude_session_jsonl::{
            parse_claude_archived_index_entry, parse_claude_archived_session_snapshot,
            read_claude_subagent_snapshots,
        },
        filesystem::{collect_jsonl_files, resolve_codex_home, resolve_project_roots},
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
    let project_roots = resolve_project_roots(&codex_home).unwrap_or_default();
    let archived_root = codex_home.join("archived_sessions");
    let mut entries =
        build_codex_archived_index_entries(&archived_root, &project_roots).unwrap_or_default();
    entries.extend(build_claude_archived_index_entries(&project_roots).unwrap_or_default());
    entries.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.started_at.cmp(&left.started_at))
            .then_with(|| left.file_path.cmp(&right.file_path))
    });
    Ok(entries)
}

pub(crate) fn load_archived_session_snapshot_from_disk(
    file_path: &str,
) -> Option<SessionLogSnapshot> {
    let codex_home = resolve_codex_home().ok()?;
    let project_roots = resolve_project_roots(&codex_home).unwrap_or_default();
    let archived_root = codex_home.join("archived_sessions");
    let path = Path::new(file_path);
    let canonical_path = fs::canonicalize(path).ok()?;

    load_codex_archived_session_snapshot(
        path,
        &CodexArchivedSnapshotScope {
            canonical_path: &canonical_path,
            project_roots: &project_roots,
            archived_root: &archived_root,
            codex_home: &codex_home,
        },
    )
    .or_else(|| load_claude_archived_session_snapshot(path, &canonical_path, &project_roots))
}

struct ArchivedSubagentScope<'a> {
    archived_root: &'a Path,
    canonical_path: &'a Path,
    codex_home: &'a Path,
}

struct CodexArchivedSnapshotScope<'a> {
    canonical_path: &'a Path,
    project_roots: &'a [PathBuf],
    archived_root: &'a Path,
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

fn load_codex_archived_session_snapshot(
    path: &Path,
    scope: &CodexArchivedSnapshotScope<'_>,
) -> Option<SessionLogSnapshot> {
    let canonical_root = fs::canonicalize(scope.archived_root).ok()?;
    if !scope.canonical_path.starts_with(&canonical_root) {
        return None;
    }

    let mut snapshot = build_archived_session_snapshot(path, scope.project_roots).ok()??;
    snapshot.subagents = load_archived_subagents_best_effort(
        &snapshot,
        &ArchivedSubagentScope {
            archived_root: scope.archived_root,
            canonical_path: scope.canonical_path,
            codex_home: scope.codex_home,
        },
    );
    snapshot.max_context_window_tokens =
        resolve_snapshot_max_context_window_tokens(&snapshot, scope.codex_home);
    Some(snapshot)
}

fn load_claude_archived_session_snapshot(
    path: &Path,
    canonical_path: &Path,
    project_roots: &[PathBuf],
) -> Option<SessionLogSnapshot> {
    let claude_root = resolve_claude_projects_root().ok()?;
    let canonical_claude_root = fs::canonicalize(&claude_root).ok()?;
    if !canonical_path.starts_with(&canonical_claude_root) {
        return None;
    }

    let mut snapshot = build_claude_archived_session_snapshot(path, project_roots).ok()??;
    snapshot.subagents =
        read_claude_subagent_snapshots(canonical_path, &snapshot.session_id).ok()?;
    Some(snapshot)
}

fn collect_archived_session_files(archived_root: &Path) -> io::Result<Vec<PathBuf>> {
    let mut archived_files = Vec::new();
    collect_jsonl_files(archived_root, &mut archived_files)?;
    archived_files.sort_by(|left, right| right.cmp(left));
    Ok(archived_files)
}

fn build_codex_archived_index_entries(
    archived_root: &Path,
    project_roots: &[PathBuf],
) -> io::Result<Vec<ArchivedSessionIndex>> {
    let archived_files = collect_archived_session_files(archived_root)?;
    let mut entries = Vec::new();
    for file_path in &archived_files {
        if let Ok(Some(entry)) = build_archived_index_entry(file_path, project_roots) {
            entries.push(entry);
        }
    }

    Ok(entries)
}

fn build_claude_archived_index_entries(
    project_roots: &[PathBuf],
) -> io::Result<Vec<ArchivedSessionIndex>> {
    let claude_root = resolve_claude_projects_root()?;
    let session_files = collect_claude_main_session_files(&claude_root)?;
    let mut entries = Vec::new();

    for file_path in &session_files {
        if let Ok(Some(entry)) = build_claude_archived_index_entry(file_path, project_roots) {
            entries.push(entry);
        }
    }

    Ok(entries)
}

fn build_archived_index_entry(
    session_file: &Path,
    project_roots: &[PathBuf],
) -> io::Result<Option<ArchivedSessionIndex>> {
    let parsed =
        parse_archived_index_entry(session_file, ARCHIVED_INDEX_SCAN_LIMIT, |workspace_path| {
            is_conductor_workspace_path(Path::new(workspace_path))
        })?;

    Ok(parsed.map(|parsed| {
        let (origin_path, display_name) =
            resolve_archived_workspace_identity_with_roots(&parsed.workspace_path, project_roots);

        ArchivedSessionIndex {
            provider: parsed.provider,
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

fn build_claude_archived_index_entry(
    session_file: &Path,
    project_roots: &[PathBuf],
) -> io::Result<Option<ArchivedSessionIndex>> {
    let parsed = parse_claude_archived_index_entry(session_file, |workspace_path| {
        is_conductor_workspace_path(Path::new(workspace_path))
    })?;

    Ok(parsed.map(|parsed| {
        let (origin_path, display_name) =
            resolve_archived_workspace_identity_with_roots(&parsed.workspace_path, project_roots);

        ArchivedSessionIndex {
            provider: parsed.provider,
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

fn build_archived_session_snapshot(
    session_file: &Path,
    project_roots: &[PathBuf],
) -> io::Result<Option<SessionLogSnapshot>> {
    let parsed = parse_archived_session_snapshot(session_file, |workspace_path| {
        is_conductor_workspace_path(Path::new(workspace_path))
    })?;

    Ok(parsed.map(|parsed| {
        let (origin_path, display_name) =
            resolve_archived_workspace_identity_with_roots(&parsed.workspace_path, project_roots);

        SessionLogSnapshot {
            provider: parsed.provider,
            session_id: parsed.session_id,
            forked_from_id: parsed.forked_from_id,
            workspace_path: parsed.workspace_path,
            origin_path,
            display_name,
            started_at: parsed.started_at,
            updated_at: parsed.updated_at,
            model: parsed.model,
            max_context_window_tokens: parsed.max_context_window_tokens,
            entries: parsed.entries,
            subagents: Vec::new(),
            is_archived: true,
            prompt_assembly: parsed.prompt_assembly,
        }
    }))
}

fn build_claude_archived_session_snapshot(
    session_file: &Path,
    project_roots: &[PathBuf],
) -> io::Result<Option<SessionLogSnapshot>> {
    let parsed = parse_claude_archived_session_snapshot(session_file, |workspace_path| {
        is_conductor_workspace_path(Path::new(workspace_path))
    })?;

    Ok(parsed.map(|parsed| {
        let (origin_path, display_name) =
            resolve_archived_workspace_identity_with_roots(&parsed.workspace_path, project_roots);

        SessionLogSnapshot {
            provider: parsed.provider,
            session_id: parsed.session_id,
            forked_from_id: parsed.forked_from_id,
            workspace_path: parsed.workspace_path,
            origin_path,
            display_name,
            started_at: parsed.started_at,
            updated_at: parsed.updated_at,
            model: parsed.model,
            max_context_window_tokens: parsed.max_context_window_tokens,
            entries: parsed.entries,
            subagents: Vec::new(),
            is_archived: true,
            prompt_assembly: parsed.prompt_assembly,
        }
    }))
}

fn resolve_archived_workspace_identity_with_roots(
    workspace_path: &str,
    project_roots: &[PathBuf],
) -> (String, String) {
    let path = Path::new(workspace_path);

    for project_root in project_roots {
        if let Ok(identity) = resolve_session_workspace_identity(path, project_root) {
            return (identity.origin_path, identity.display_name);
        }
    }

    resolve_archived_workspace_identity(workspace_path)
}

#[cfg(test)]
mod tests {
    use super::{
        build_archived_index, load_archived_session_snapshot_from_disk,
        load_archived_subagents_best_effort, ArchivedSubagentScope,
    };
    use crate::domain::session::{SessionLogSnapshot, SessionProvider};
    use crate::test_support::{
        create_git_workspace, session_meta_line_with_fork, session_meta_line_with_source,
        write_session_lines, write_worker_subagent_session, RecentSessionTestContext,
    };
    use std::{fs, path::Path};

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

    fn write_archived_runtime_window_subagent_fixture(path: &Path, parent_thread_id: &str) {
        write_session_lines(
            path,
            [
                format!(
                    r#"{{"timestamp":"2026-03-21T00:01:00.000Z","type":"session_meta","payload":{{"id":"archived-child","source":{{"subagent":{{"thread_spawn":{{"parent_thread_id":"{parent_thread_id}","depth":1,"agent_nickname":"Turing","agent_role":"worker"}}}}}},"cwd":"/tmp/workspace","timestamp":"2026-03-21T00:01:00.000Z"}}}}"#
                ),
                r#"{"timestamp":"2026-03-21T00:01:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub","model_context_window":258400}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-21T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Archived child has its own runtime window."}]}}"#
                    .to_owned(),
            ],
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
            provider: SessionProvider::Codex,
            session_id: "archived-parent".to_owned(),
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

    #[test]
    fn archived_snapshot_does_not_promote_subagent_runtime_context_window_to_main_run() {
        let ctx = RecentSessionTestContext::new("archived-snapshot-main-window");
        let archived_root = ctx.codex_home.join("archived_sessions");
        let workspace_path = ctx.temp_root.join("Archives/demo-app");
        let selected_file = archived_root.join("2026/parent.jsonl");
        let child_file = archived_root.join("2026/agents/child.jsonl");

        write_session_lines(
            &selected_file,
            vec![
                session_meta_line_with_fork("archived-parent", &workspace_path, Some("fork-root")),
                r#"{"timestamp":"2026-03-21T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-main"}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-21T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Archived parent has no runtime window."}]}}"#
                    .to_owned(),
            ],
        );
        write_archived_runtime_window_subagent_fixture(&child_file, "fork-root");

        let snapshot =
            load_archived_session_snapshot_from_disk(selected_file.to_string_lossy().as_ref())
                .expect("archived snapshot should load");

        assert_eq!(snapshot.max_context_window_tokens, None);
        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(
            snapshot.subagents[0].max_context_window_tokens,
            Some(258_400)
        );
    }

    #[test]
    fn builds_archived_index_when_codex_home_uses_tilde_expansion() {
        let ctx = RecentSessionTestContext::new("archived-index-tilde");
        let archived_root = ctx.codex_home.join("archived_sessions");
        let workspace_path = ctx.projects_root.join("demo-app");
        let archived_file = archived_root.join("2026/archived.jsonl");

        create_git_workspace(&workspace_path);
        write_session_lines(
            &archived_file,
            vec![
                session_meta_line_with_source("archived-tilde", &workspace_path, "exec"),
                r#"{"timestamp":"2026-03-21T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Archived sessions should load when CODEX_HOME uses tilde."}]}}"#
                    .to_owned(),
            ],
        );
        std::env::set_var("CODEX_HOME", "~/.codex");

        let entries = build_archived_index().expect("archived index should build");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].session_id, "archived-tilde");
    }

    #[test]
    fn resolves_archived_identity_from_codex_configured_project_roots() {
        let ctx = RecentSessionTestContext::new("archived-index-config-project-root");
        let archived_root = ctx.codex_home.join("archived_sessions");
        let custom_projects_root = ctx.temp_root.join("Workspaces");
        let workspace_path = custom_projects_root.join("demo-app");
        let archived_file = archived_root.join("2026/config-root.jsonl");

        create_git_workspace(&workspace_path);
        fs::write(
            ctx.codex_home.join("config.toml"),
            format!(
                "[projects.\"{}\"]\ntrust_level = \"trusted\"\n",
                workspace_path.display()
            ),
        )
        .expect("config should be written");
        write_session_lines(
            &archived_file,
            vec![
                session_meta_line_with_source("archived-config-root", &workspace_path, "exec"),
                r#"{"timestamp":"2026-03-21T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Configured project roots should resolve archived workspaces."}]}}"#
                    .to_owned(),
            ],
        );

        let entries = build_archived_index().expect("archived index should build");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].display_name, "demo-app");
        assert_eq!(entries[0].origin_path, workspace_path.display().to_string());
    }
}
