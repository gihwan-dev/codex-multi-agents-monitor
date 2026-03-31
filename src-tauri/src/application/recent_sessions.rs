use crate::{
    application::{
        session_context_window::resolve_snapshot_max_context_window_tokens,
        session_relationships::{load_snapshot_subagents, SnapshotSubagentSearch},
        workspace_identity::resolve_live_session_workspace_identity,
    },
    domain::{
        ingest_policy::{
            is_supported_live_session_source, should_hide_recent_boot_thread, LIVE_SESSION_SOURCES,
            MAX_RECENT_SESSIONS, RECENT_INDEX_PREFIX_SCAN_LIMIT, RECENT_INDEX_TAIL_BYTES,
            RECENT_INDEX_TAIL_ENTRY_LIMIT,
        },
        session::{RecentSessionIndexItem, SessionLogSnapshot},
        workspace::WorkspaceIdentity,
    },
    infrastructure::{
        filesystem::{resolve_codex_home, resolve_projects_root},
        session_jsonl::{
            parse_live_session_snapshot, parse_recent_index_entry, RecentIndexParseOptions,
        },
        state_sqlite::{load_live_thread_rows, load_thread_subagent_hints, LiveThreadRow},
    },
};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LiveSessionCandidate {
    pub(crate) session_id: String,
    pub(crate) file_path: PathBuf,
    pub(crate) workspace_path: String,
    pub(crate) workspace_identity: WorkspaceIdentity,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct RecentSnapshotSelection {
    pub(crate) candidate: LiveSessionCandidate,
    pub(crate) codex_home: PathBuf,
    pub(crate) sessions_root: PathBuf,
    pub(crate) projects_root: PathBuf,
}

pub(crate) fn load_recent_session_index_from_disk() -> io::Result<Vec<RecentSessionIndexItem>> {
    let codex_home = resolve_codex_home()?;
    let projects_root = resolve_projects_root()?;
    let sessions_root = codex_home.join("sessions");
    let candidates = load_live_session_candidates(&codex_home, &sessions_root, &projects_root)?;

    let mut items = Vec::new();

    for candidate in candidates {
        if items.len() >= MAX_RECENT_SESSIONS {
            break;
        }

        let item = match build_recent_index_item(&candidate) {
            Ok(Some(item)) => item,
            Ok(None) => continue,
            Err(_) => continue,
        };
        if should_hide_recent_boot_thread(&item) {
            continue;
        }

        items.push(item);
    }

    Ok(items)
}

pub(crate) fn load_recent_session_snapshot_from_disk(
    file_path: &str,
) -> Option<SessionLogSnapshot> {
    let selection = resolve_recent_snapshot_selection(file_path)?;
    load_recent_session_snapshot(&selection)
}

fn load_live_session_candidates(
    codex_home: &Path,
    sessions_root: &Path,
    projects_root: &Path,
) -> io::Result<Vec<LiveSessionCandidate>> {
    let rows = load_live_thread_rows(codex_home)?;
    let canonical_sessions_root = fs::canonicalize(sessions_root)?;
    let mut candidates = Vec::new();
    for row in rows {
        let Some(candidate) =
            build_live_session_candidate(row, &canonical_sessions_root, projects_root)?
        else {
            continue;
        };
        candidates.push(candidate);
    }

    Ok(candidates)
}

fn build_live_session_candidate(
    row: LiveThreadRow,
    canonical_sessions_root: &Path,
    projects_root: &Path,
) -> io::Result<Option<LiveSessionCandidate>> {
    if !is_supported_live_session_source(&row.source) {
        return Ok(None);
    }
    if row.workspace_path.trim().is_empty() || row.rollout_path.trim().is_empty() {
        return Ok(None);
    }

    let canonical_file_path = match fs::canonicalize(Path::new(&row.rollout_path)) {
        Ok(path) => path,
        Err(_) => return Ok(None),
    };
    if !canonical_file_path.starts_with(canonical_sessions_root) {
        return Ok(None);
    }

    let workspace_identity = match resolve_live_session_workspace_identity(
        Path::new(&row.workspace_path),
        projects_root,
    ) {
        Ok(identity) => identity,
        Err(_) => return Ok(None),
    };

    Ok(Some(LiveSessionCandidate {
        session_id: row.session_id,
        file_path: canonical_file_path,
        workspace_path: row.workspace_path,
        workspace_identity,
    }))
}

fn build_recent_index_item(
    candidate: &LiveSessionCandidate,
) -> io::Result<Option<RecentSessionIndexItem>> {
    let parsed = parse_recent_index_entry(
        &candidate.file_path,
        RecentIndexParseOptions {
            prefix_scan_limit: RECENT_INDEX_PREFIX_SCAN_LIMIT,
            tail_bytes: RECENT_INDEX_TAIL_BYTES,
            tail_entry_limit: RECENT_INDEX_TAIL_ENTRY_LIMIT,
        },
    )?;

    Ok(parsed.map(|parsed| RecentSessionIndexItem {
        session_id: candidate.session_id.clone(),
        workspace_path: candidate.workspace_path.clone(),
        origin_path: candidate.workspace_identity.origin_path.clone(),
        display_name: candidate.workspace_identity.display_name.clone(),
        started_at: parsed.started_at,
        updated_at: parsed.updated_at,
        model: parsed.model,
        file_path: candidate.file_path.display().to_string(),
        first_user_message: parsed.first_user_message,
        title: parsed.title,
        status: parsed.status,
        last_event_summary: parsed.last_event_summary,
    }))
}

fn build_recent_session_snapshot(
    session_file: &Path,
    projects_root: &Path,
) -> io::Result<Option<SessionLogSnapshot>> {
    let parsed = parse_live_session_snapshot(session_file, LIVE_SESSION_SOURCES)?;
    let Some(parsed) = parsed else {
        return Ok(None);
    };

    let workspace_identity =
        resolve_live_session_workspace_identity(Path::new(&parsed.workspace_path), projects_root)
            .ok();
    let Some(workspace_identity) = workspace_identity else {
        return Ok(None);
    };

    Ok(Some(SessionLogSnapshot {
        session_id: parsed.session_id,
        forked_from_id: parsed.forked_from_id,
        workspace_path: parsed.workspace_path,
        origin_path: workspace_identity.origin_path,
        display_name: workspace_identity.display_name,
        started_at: parsed.started_at,
        updated_at: parsed.updated_at,
        model: parsed.model,
        max_context_window_tokens: parsed.max_context_window_tokens,
        entries: parsed.entries,
        subagents: Vec::new(),
        is_archived: false,
        prompt_assembly: parsed.prompt_assembly,
    }))
}

pub(crate) fn load_recent_session_snapshot(
    selection: &RecentSnapshotSelection,
) -> Option<SessionLogSnapshot> {
    let mut snapshot =
        build_recent_session_snapshot(&selection.candidate.file_path, &selection.projects_root)
            .ok()??;
    let relationship_hints = load_thread_subagent_hints(&selection.codex_home).unwrap_or_default();
    snapshot.subagents = load_snapshot_subagents(
        SnapshotSubagentSearch {
            snapshot: &snapshot,
            search_root: &selection.sessions_root,
            selected_file: &selection.candidate.file_path,
        },
        &relationship_hints,
    )
    .ok()?;
    snapshot.max_context_window_tokens =
        resolve_snapshot_max_context_window_tokens(&snapshot, &selection.codex_home);

    Some(snapshot)
}

pub(crate) fn resolve_recent_snapshot_selection(file_path: &str) -> Option<RecentSnapshotSelection> {
    let codex_home = resolve_codex_home().ok()?;
    let projects_root = resolve_projects_root().ok()?;
    let sessions_root = codex_home.join("sessions");
    let canonical_path = resolve_recent_snapshot_path(file_path, &sessions_root)?;
    let candidates =
        load_live_session_candidates(&codex_home, &sessions_root, &projects_root).ok()?;
    let candidate = candidates
        .into_iter()
        .find(|item| item.file_path == canonical_path)?;

    Some(RecentSnapshotSelection {
        candidate,
        codex_home,
        sessions_root,
        projects_root,
    })
}

fn resolve_recent_snapshot_path(file_path: &str, sessions_root: &Path) -> Option<PathBuf> {
    let canonical_path = fs::canonicalize(Path::new(file_path)).ok()?;
    let canonical_root = fs::canonicalize(sessions_root).ok()?;

    if canonical_path.starts_with(&canonical_root) {
        Some(canonical_path)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{load_recent_session_index_from_disk, load_recent_session_snapshot_from_disk};
    use crate::{
        domain::ingest_policy::DEFAULT_THREAD_TITLE,
        domain::session::RecentSessionIndexItem,
        test_support::{
            create_git_workspace, create_linked_worktree, create_state_database, insert_thread_row,
            insert_thread_row_with_archive_flag, insert_thread_spawn_edge,
            persist_live_thread_fixture, session_meta_line, session_meta_line_with_fork,
            session_meta_line_with_source,
            session_meta_line_with_source_and_fork, write_late_subagent_resume_session,
            write_session_lines, write_worker_subagent_session, RecentSessionTestContext,
        },
    };
    use std::{
        fs,
        path::{Path, PathBuf},
    };

    const LIGHTWEIGHT_SCAN_EVENTS: &[&str] = &[
        r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#,
        r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Ship the recent-index flow"}]}}"#,
        r#"{"timestamp":"2026-03-20T00:00:03.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Working on the lightweight summary."}]}}"#,
    ];

    const NESTED_PROJECT_EVENTS: &[&str] = &[
        r##"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"# AGENTS.md instructions for /Users/choegihwan/Documents/Projects/exem-ui"}]}}"##,
        r##"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<environment_context> <cwd>/Users/choegihwan/Documents/Projects/exem-ui/packages/ui</cwd> <shell>zsh</shell> </environment_context>"}]}}"##,
        r##"{"timestamp":"2026-03-20T00:00:03.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"List the instruction sources you loaded."}]}}"##,
    ];

    const ARCHIVED_THREAD_MESSAGE: &[&str] = &[
        r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Archived thread should stay hidden"}]}}"#,
    ];
    const VISIBLE_THREAD_MESSAGE: &[&str] = &[
        r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Visible thread should remain"}]}}"#,
    ];
    const SELECTED_SESSION_EVENTS: &[&str] = &[
        r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#,
        r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Inspect only this session"}]}}"#,
    ];
    const MATCHED_SUBAGENT_EVENTS: &[&str] = &[
        r#"{"timestamp":"2026-03-20T00:01:00.000Z","type":"session_meta","payload":{"id":"sub-001","source":{"subagent":{"thread_spawn":{"parent_thread_id":"session-001","depth":1,"agent_nickname":"Euler","agent_role":"worker"}}},"cwd":"/tmp/test","timestamp":"2026-03-20T00:01:00.000Z"}}"#,
        r#"{"timestamp":"2026-03-20T00:01:01.000Z","type":"turn_context","payload":{"model":"gpt-5-mini"}}"#,
        r#"{"timestamp":"2026-03-20T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Matched child"}]}}"#,
    ];
    const UNRELATED_SUBAGENT_EVENTS: &[&str] = &[
        r#"{"timestamp":"2026-03-20T00:02:00.000Z","type":"session_meta","payload":{"id":"sub-999","source":{"subagent":{"thread_spawn":{"parent_thread_id":"other-parent","depth":1,"agent_nickname":"Noether","agent_role":"worker"}}},"cwd":"/tmp/test","timestamp":"2026-03-20T00:02:00.000Z"}}"#,
        r#"{"timestamp":"2026-03-20T00:02:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Unrelated child"}]}}"#,
    ];

    struct ThreadFixture<'a> {
        header: String,
        session_id: &'a str,
        session_file: &'a Path,
        source: &'a str,
        workspace_path: &'a Path,
        updated_at: i64,
        archived: bool,
        events: &'a [&'a str],
    }

    fn session_lines(header: String, events: &[&str]) -> Vec<String> {
        std::iter::once(header)
            .chain(events.iter().map(|line| (*line).to_owned()))
            .collect()
    }

    fn owned_lines(events: &[&str]) -> Vec<String> {
        events.iter().map(|line| (*line).to_owned()).collect()
    }

    fn persist_thread_fixture(state_database: &Path, fixture: ThreadFixture<'_>) {
        write_session_lines(
            fixture.session_file,
            session_lines(fixture.header, fixture.events),
        );

        if fixture.archived {
            insert_thread_row_with_archive_flag(
                state_database,
                fixture.session_id,
                fixture.session_file,
                fixture.source,
                fixture.workspace_path,
                fixture.updated_at,
                true,
            );
        } else {
            insert_thread_row(
                state_database,
                fixture.session_id,
                fixture.session_file,
                fixture.source,
                fixture.workspace_path,
                fixture.updated_at,
            );
        }
    }

    fn first_recent_item() -> RecentSessionIndexItem {
        load_recent_session_index_from_disk()
            .expect("recent index should load")
            .into_iter()
            .next()
            .expect("recent index entry should exist")
    }

    fn load_recent_snapshot(path: &Path) -> crate::domain::session::SessionLogSnapshot {
        load_recent_session_snapshot_from_disk(path.to_string_lossy().as_ref())
            .expect("selected recent snapshot should exist")
    }

    fn prepare_recent_snapshot_fixture(
        test_name: &str,
        session_file_name: &str,
        state_file_name: &str,
    ) -> (RecentSessionTestContext, PathBuf, PathBuf, PathBuf) {
        let ctx = RecentSessionTestContext::new(test_name);
        let workspace_path = ctx.projects_root.join("demo-app");
        let selected_file = ctx.sessions_root.join(session_file_name);
        let state_database = ctx.codex_home.join(state_file_name);

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        (ctx, workspace_path, selected_file, state_database)
    }

    struct RecentSnapshotFixture<'a> {
        state_database: &'a Path,
        selected_file: &'a Path,
        session_id: &'a str,
        workspace_path: &'a Path,
        events: &'a [&'a str],
    }

    fn persist_recent_snapshot_fixture(fixture: RecentSnapshotFixture<'_>) {
        persist_thread_fixture(
            fixture.state_database,
            ThreadFixture {
                header: session_meta_line(fixture.session_id, fixture.workspace_path),
                session_id: fixture.session_id,
                session_file: fixture.selected_file,
                source: "desktop",
                workspace_path: fixture.workspace_path,
                updated_at: 1_742_428_803,
                archived: false,
                events: fixture.events,
            },
        );
    }

    fn write_subagent_runtime_window_fixture(path: &Path, parent_session_id: &str) {
        write_session_lines(
            path,
            vec![
                format!(
                    r#"{{"timestamp":"2026-03-20T00:01:00.000Z","type":"session_meta","payload":{{"id":"sub-window-001","source":{{"subagent":{{"thread_spawn":{{"parent_thread_id":"{parent_session_id}","depth":1,"agent_nickname":"Euler","agent_role":"worker"}}}}}},"cwd":"/tmp/workspace","timestamp":"2026-03-20T00:01:00.000Z"}}}}"#
                ),
                r#"{"timestamp":"2026-03-20T00:01:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub","model_context_window":258400}}"#.to_owned(),
                r#"{"timestamp":"2026-03-20T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Child session carries the runtime window."}]}}"#.to_owned(),
            ],
        );
    }

    #[test]
    fn recent_snapshot_prefers_runtime_context_window_over_config() {
        let (ctx, workspace_path, selected_file, state_database) =
            prepare_recent_snapshot_fixture(
                "recent-detail-runtime-window",
                "runtime-window.jsonl",
                "state_runtime_window.sqlite",
            );
        fs::write(
            ctx.codex_home.join("config.toml"),
            "model_context_window = 999999\n",
        )
        .expect("config should be written");
        write_session_lines(
            &selected_file,
            session_lines(
                session_meta_line("session-runtime-window", &workspace_path),
                &[
                    r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1","model_context_window":258400}}"#,
                    r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Runtime window should win."}]}}"#,
                ],
            ),
        );
        insert_thread_row(
            &state_database,
            "session-runtime-window",
            &selected_file,
            "desktop",
            &workspace_path,
            1_742_428_803,
        );

        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.max_context_window_tokens, Some(258_400));
    }

    #[test]
    fn recent_snapshot_uses_config_context_window_when_runtime_is_missing() {
        let (ctx, workspace_path, selected_file, state_database) =
            prepare_recent_snapshot_fixture(
                "recent-detail-config-window",
                "config-window.jsonl",
                "state_config_window.sqlite",
            );
        fs::write(
            ctx.codex_home.join("config.toml"),
            "model_context_window = 258400\n",
        )
        .expect("config should be written");
        write_session_lines(
            &selected_file,
            session_lines(
                session_meta_line("session-config-window", &workspace_path),
                &[
                    r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1"}}"#,
                    r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Config window should be used."}]}}"#,
                ],
            ),
        );
        insert_thread_row(
            &state_database,
            "session-config-window",
            &selected_file,
            "desktop",
            &workspace_path,
            1_742_428_803,
        );

        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.max_context_window_tokens, Some(258_400));
    }

    #[test]
    fn recent_snapshot_does_not_promote_subagent_runtime_context_window_to_main_run() {
        let (ctx, workspace_path, selected_file, state_database) =
            prepare_recent_snapshot_fixture(
                "recent-detail-subagent-window",
                "subagent-window.jsonl",
                "state_subagent_window.sqlite",
            );
        let child_file = ctx.sessions_root.join("subagent-window-child.jsonl");

        persist_recent_snapshot_fixture(RecentSnapshotFixture {
            state_database: &state_database,
            selected_file: &selected_file,
            session_id: "session-subagent-window",
            workspace_path: &workspace_path,
            events: &[
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1"}}"#,
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Main session has no runtime window."}]}}"#,
            ],
        });
        write_subagent_runtime_window_fixture(&child_file, "session-subagent-window");

        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.max_context_window_tokens, None);
        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(
            snapshot.subagents[0].max_context_window_tokens,
            Some(258_400)
        );
    }

    #[test]
    fn builds_recent_index_entry_from_lightweight_session_scan() {
        let ctx = RecentSessionTestContext::new("recent-index");
        let workspace_path = ctx.projects_root.join("demo-app");
        let session_file = ctx.sessions_root.join("session.jsonl");
        let state_database = ctx.codex_home.join("state_1.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            session_lines(
                session_meta_line("session-001", &workspace_path),
                LIGHTWEIGHT_SCAN_EVENTS,
            ),
        );
        insert_thread_row(
            &state_database,
            "session-001",
            &session_file,
            "desktop",
            &workspace_path,
            1_742_428_803,
        );

        let item = first_recent_item();

        assert_eq!(item.session_id, "session-001");
        assert_eq!(item.display_name, "demo-app");
        assert_eq!(item.model.as_deref(), Some("gpt-5"));
        assert_eq!(item.title, "Ship the recent-index flow");
        assert_eq!(item.status, "done");
        assert_eq!(
            item.last_event_summary,
            "Working on the lightweight summary."
        );
        assert_eq!(
            item.first_user_message.as_deref(),
            Some("Ship the recent-index flow")
        );
    }

    #[test]
    fn skips_conductor_recent_index_entries() {
        let ctx = RecentSessionTestContext::new("recent-index-conductor");
        let workspace_path = ctx
            .temp_root
            .join("conductor/workspaces/React-Dashboard/kyiv");
        let session_file = ctx.sessions_root.join("conductor.jsonl");
        let state_database = ctx.codex_home.join("state_2.sqlite");

        fs::create_dir_all(&workspace_path).expect("workspace path should exist");
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-conductor", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Should never appear"}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-conductor",
            &session_file,
            "desktop",
            &workspace_path,
            1_742_428_801,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn skips_recent_index_entries_when_origin_workspace_is_missing() {
        let ctx = RecentSessionTestContext::new("recent-index-missing-origin");
        let workspace_path = ctx.temp_root.join("tmp/ghost-workspace");
        let session_file = ctx.sessions_root.join("missing-origin.jsonl");
        let state_database = ctx.codex_home.join("state_3.sqlite");

        fs::create_dir_all(&workspace_path).expect("workspace path should exist");
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-missing-origin", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"This workspace should be rejected"}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-missing-origin",
            &session_file,
            "desktop",
            &workspace_path,
            1_742_428_801,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn keeps_recent_automation_sessions_when_workspace_identity_is_valid() {
        let ctx = RecentSessionTestContext::new("recent-index-automation");
        let workspace_path = ctx.projects_root.join("automation-demo");
        let session_file = ctx.sessions_root.join("automation.jsonl");
        let state_database = ctx.codex_home.join("state_4.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("automation-session", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Automation: Daily Diary Automation\n# Daily Diary\nAI 에이전트 활동 로그와 Obsidian 볼트 변경사항을 종합한다."}]}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:03.000Z","type":"event_msg","payload":{"type":"task_complete","last_agent_message":"done"}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "automation-session",
            &session_file,
            "desktop",
            &workspace_path,
            1_742_428_803,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");
        let item = items
            .into_iter()
            .next()
            .expect("automation session should remain visible");

        assert_eq!(item.session_id, "automation-session");
        assert_eq!(item.display_name, "automation-demo");
        assert_eq!(item.title, DEFAULT_THREAD_TITLE);
        assert!(item.first_user_message.is_none());
    }

    #[test]
    fn skips_exec_recent_index_entries() {
        let ctx = RecentSessionTestContext::new("recent-index-exec");
        let workspace_path = ctx.projects_root.join("demo-app");
        let session_file = ctx.sessions_root.join("exec-session.jsonl");
        let state_database = ctx.codex_home.join("state_5.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line_with_source("session-exec", &workspace_path, "exec"),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"This exec session should stay hidden"}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-exec",
            &session_file,
            "exec",
            &workspace_path,
            1_742_428_802,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn keeps_recent_index_entries_from_existing_codex_worktrees() {
        let ctx = RecentSessionTestContext::new("recent-index-worktree-live");
        let origin_workspace = ctx.projects_root.join("Obsidian-frontend-journey");
        let workspace_path = ctx
            .temp_root
            .join(".codex/worktrees/5594/Obsidian-frontend-journey");
        let session_file = ctx.sessions_root.join("live-worktree-session.jsonl");
        let state_database = ctx.codex_home.join("state_6.sqlite");

        create_linked_worktree(&origin_workspace, &workspace_path, "5594");
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line_with_source("session-worktree", &workspace_path, "vscode"),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Automation: Dialy Diary Automation\n# Daily Diary\nCodex app live sessions should keep valid worktrees visible."}]}}"#
                    .to_owned(),
                r#"{"timestamp":"2026-03-20T00:00:03.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Prepared the daily diary draft."}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-worktree",
            &session_file,
            "vscode",
            &workspace_path,
            1_742_428_802,
        );

        let item = load_recent_session_index_from_disk()
            .expect("recent index should load")
            .into_iter()
            .next()
            .expect("existing worktree session should remain visible");

        assert_eq!(item.session_id, "session-worktree");
        assert_eq!(item.display_name, "Obsidian-frontend-journey");
        assert_eq!(item.origin_path, origin_workspace.display().to_string());
    }

    #[test]
    fn skips_stale_codex_worktree_recent_index_entries() {
        let ctx = RecentSessionTestContext::new("recent-index-worktree-stale");
        let workspace_path = ctx.temp_root.join(".codex/worktrees/6971/exem-ui");
        let session_file = ctx.sessions_root.join("stale-worktree-session.jsonl");
        let state_database = ctx.codex_home.join("state_6.sqlite");

        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line_with_source("session-stale-worktree", &workspace_path, "vscode"),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"This stale worktree session should stay hidden"}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-stale-worktree",
            &session_file,
            "vscode",
            &workspace_path,
            1_742_428_802,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn collapses_nested_project_workspace_and_skips_environment_context_titles() {
        let ctx = RecentSessionTestContext::new("recent-index-nested-project");
        let workspace_root = ctx.projects_root.join("exem-ui");
        let nested_workspace = workspace_root.join("packages/ui");
        let session_file = ctx.sessions_root.join("nested-project.jsonl");
        let state_database = ctx.codex_home.join("state_7.sqlite");

        create_git_workspace(&workspace_root);
        fs::create_dir_all(&nested_workspace).expect("nested workspace path should exist");
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            session_lines(
                session_meta_line("session-nested", &nested_workspace),
                NESTED_PROJECT_EVENTS,
            ),
        );
        insert_thread_row(
            &state_database,
            "session-nested",
            &session_file,
            "desktop",
            &nested_workspace,
            1_742_428_803,
        );

        let item = load_recent_session_index_from_disk()
            .expect("recent index should load")
            .into_iter()
            .next()
            .expect("recent index entry should exist");

        assert_eq!(item.display_name, "exem-ui");
        assert_eq!(item.origin_path, workspace_root.display().to_string());
        assert_eq!(item.title, "List the instruction sources you loaded.");
        assert_eq!(
            item.first_user_message.as_deref(),
            Some("List the instruction sources you loaded.")
        );
    }

    #[test]
    fn skips_recent_index_entries_from_archived_projects_workspace_paths() {
        let ctx = RecentSessionTestContext::new("recent-index-archived-projects");
        let workspace_path = ctx
            .temp_root
            .join("Documents/Archives/Projects/mfo_v5_starter");
        let session_file = ctx.sessions_root.join("archived-project.jsonl");
        let state_database = ctx.codex_home.join("state_8.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line_with_source("session-archived-project", &workspace_path, "vscode"),
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Archived workspace should stay hidden"}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-archived-project",
            &session_file,
            "vscode",
            &workspace_path,
            1_742_428_802,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn skips_boot_only_recent_threads_without_meaningful_activity() {
        let ctx = RecentSessionTestContext::new("recent-index-boot-only");
        let workspace_path = ctx.projects_root.join("exem-ui");
        let session_file = ctx.sessions_root.join("boot-only.jsonl");
        let state_database = ctx.codex_home.join("state_10.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![session_meta_line_with_source(
                "session-boot-only",
                &workspace_path,
                "cli",
            )],
        );
        insert_thread_row(
            &state_database,
            "session-boot-only",
            &session_file,
            "cli",
            &workspace_path,
            1_742_428_800,
        );

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert!(items.is_empty());
    }

    #[test]
    fn excludes_archived_threads_from_recent_index() {
        let ctx = RecentSessionTestContext::new("recent-index-archived");
        setup_archived_recent_index_fixture(&ctx);

        let items = load_recent_session_index_from_disk().expect("recent index should load");

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].session_id, "session-visible");
    }

    #[test]
    fn rejects_archived_threads_from_recent_snapshot_loading() {
        let ctx = RecentSessionTestContext::new("recent-snapshot-archived");
        let workspace_path = ctx.projects_root.join("demo-app");
        let session_file = ctx.sessions_root.join("archived-selected.jsonl");
        let state_database = ctx.codex_home.join("state_11.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &session_file,
            vec![
                session_meta_line("session-archived", &workspace_path),
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Archived thread should not hydrate"}]}}"#
                    .to_owned(),
            ],
        );
        insert_thread_row_with_archive_flag(
            &state_database,
            "session-archived",
            &session_file,
            "desktop",
            &workspace_path,
            1_742_428_801,
            true,
        );

        let snapshot =
            load_recent_session_snapshot_from_disk(session_file.to_string_lossy().as_ref());

        assert!(snapshot.is_none());
    }

    fn setup_archived_recent_index_fixture(ctx: &RecentSessionTestContext) {
        let workspace_path = ctx.projects_root.join("demo-app");
        let archived_session_file = ctx.sessions_root.join("archived-live.jsonl");
        let visible_session_file = ctx.sessions_root.join("visible-live.jsonl");
        let state_database = ctx.codex_home.join("state_9.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        persist_thread_fixture(
            &state_database,
            ThreadFixture {
                header: session_meta_line("session-archived", &workspace_path),
                session_id: "session-archived",
                session_file: &archived_session_file,
                source: "desktop",
                workspace_path: &workspace_path,
                updated_at: 1_742_428_801,
                archived: true,
                events: ARCHIVED_THREAD_MESSAGE,
            },
        );
        persist_thread_fixture(
            &state_database,
            ThreadFixture {
                header: session_meta_line("session-visible", &workspace_path),
                session_id: "session-visible",
                session_file: &visible_session_file,
                source: "desktop",
                workspace_path: &workspace_path,
                updated_at: 1_742_428_802,
                archived: false,
                events: VISIBLE_THREAD_MESSAGE,
            },
        );
    }

    #[test]
    fn loads_selected_recent_snapshot_and_matching_subagents_only() {
        let ctx = RecentSessionTestContext::new("recent-detail");
        let workspace_path = ctx.projects_root.join("demo-app");
        let selected_file = ctx.sessions_root.join("selected.jsonl");
        let matched_subagent_file = ctx.sessions_root.join("matched-sub.jsonl");
        let unrelated_subagent_file = ctx.sessions_root.join("other-sub.jsonl");
        let state_database = ctx.codex_home.join("state_12.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &selected_file,
            session_lines(
                session_meta_line_with_fork("session-001", &workspace_path, Some("fork-001")),
                SELECTED_SESSION_EVENTS,
            ),
        );
        write_session_lines(&matched_subagent_file, owned_lines(MATCHED_SUBAGENT_EVENTS));
        write_session_lines(
            &unrelated_subagent_file,
            owned_lines(UNRELATED_SUBAGENT_EVENTS),
        );
        insert_thread_row(
            &state_database,
            "session-001",
            &selected_file,
            "desktop",
            &workspace_path,
            1_742_428_802,
        );
        insert_thread_spawn_edge(&state_database, "session-001", "sub-001");

        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.session_id, "session-001");
        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(snapshot.subagents[0].session_id, "sub-001");
        assert_eq!(snapshot.subagents[0].agent_nickname, "Euler");
    }

    #[test]
    fn attaches_subagent_when_parent_matches_fork_origin() {
        let ctx = RecentSessionTestContext::new("recent-detail-fork-origin");
        let workspace_path = ctx.projects_root.join("demo-app");
        let selected_file = ctx.sessions_root.join("selected-fork-origin.jsonl");
        let matched_subagent_file = ctx.sessions_root.join("matched-fork-origin-sub.jsonl");
        let state_database = ctx.codex_home.join("state_13.sqlite");

        create_git_workspace(&workspace_path);
        create_state_database(&state_database, &[]);
        write_session_lines(
            &selected_file,
            session_lines(
                session_meta_line_with_fork("session-001", &workspace_path, Some("fork-001")),
                SELECTED_SESSION_EVENTS,
            ),
        );
        write_session_lines(
            &matched_subagent_file,
            [
                r#"{"timestamp":"2026-03-20T00:01:00.000Z","type":"session_meta","payload":{"id":"sub-forked","source":{"subagent":{"thread_spawn":{"parent_thread_id":"fork-001","depth":1,"agent_nickname":"Curie","agent_role":"worker"}}},"cwd":"/tmp/test","timestamp":"2026-03-20T00:01:00.000Z"}}"#,
                r#"{"timestamp":"2026-03-20T00:01:01.000Z","type":"turn_context","payload":{"model":"gpt-5-mini"}}"#,
                r#"{"timestamp":"2026-03-20T00:01:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Fork-origin child"}]}}"#,
            ],
        );
        insert_thread_row(
            &state_database,
            "session-001",
            &selected_file,
            "desktop",
            &workspace_path,
            1_742_428_803,
        );

        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(snapshot.subagents[0].session_id, "sub-forked");
        assert_eq!(snapshot.subagents[0].parent_thread_id, "fork-001");
    }

    #[test]
    fn attaches_subagent_from_sqlite_source_provenance_when_edges_are_missing() {
        let (ctx, workspace_path, selected_file, state_database) = prepare_recent_snapshot_fixture(
            "recent-detail-sqlite-source",
            "selected-source-provenance.jsonl",
            "state_14.sqlite",
        );
        let matched_subagent_file = ctx.sessions_root.join("sqlite-source-sub.jsonl");
        let serialized_source = r#"{"subagent":{"thread_spawn":{"parent_thread_id":"session-001","depth":1,"agent_nickname":"Gauss","agent_role":"worker"}}}"#;
        persist_live_thread_fixture((
            &state_database,
            "session-001",
            &selected_file,
            "desktop",
            &workspace_path,
            1_742_428_803,
            session_meta_line_with_source_and_fork("session-001", &workspace_path, "desktop", None),
            SELECTED_SESSION_EVENTS,
        ));
        write_worker_subagent_session(
            &matched_subagent_file,
            "sub-sqlite-source",
            "session-001",
            "Gauss",
            "SQLite provenance child",
        );
        insert_thread_row(
            &state_database,
            "sub-sqlite-source",
            &matched_subagent_file,
            serialized_source,
            &workspace_path,
            1_742_428_804,
        );
        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(snapshot.subagents[0].session_id, "sub-sqlite-source");
        assert_eq!(snapshot.subagents[0].agent_nickname, "Gauss");
    }

    #[test]
    fn attaches_late_subagent_without_absorbing_resumed_parent_entries() {
        let (ctx, workspace_path, selected_file, state_database) = prepare_recent_snapshot_fixture(
            "recent-detail-late-subagent",
            "selected-late-subagent.jsonl",
            "state_15.sqlite",
        );
        let late_subagent_file = ctx.sessions_root.join("late-subagent.jsonl");

        persist_live_thread_fixture((
            &state_database,
            "session-001",
            &selected_file,
            "desktop",
            &workspace_path,
            1_742_428_805,
            session_meta_line("session-001", &workspace_path),
            SELECTED_SESSION_EVENTS,
        ));
        write_late_subagent_resume_session(
            &late_subagent_file,
            "sub-late-live",
            "session-001",
            "session-001",
            "Ada",
            "Child work",
        );

        let snapshot = load_recent_snapshot(&selected_file);

        assert_eq!(snapshot.subagents.len(), 1);
        assert_eq!(snapshot.subagents[0].session_id, "sub-late-live");
        assert_eq!(snapshot.subagents[0].entries.len(), 3);
        assert_eq!(
            snapshot.subagents[0].entries[1].text.as_deref(),
            Some("Child work")
        );
    }
}
