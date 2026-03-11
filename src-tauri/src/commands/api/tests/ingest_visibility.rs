use std::fs;

use rusqlite::{params, Connection};
use serde_json::json;

use crate::domain::models::{SessionFlowItemKind, SessionLaneRef, SessionScope};
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;

use super::super::session_flow::get_session_flow_from_db;
use super::super::session_list::list_sessions_from_db;
use super::support::{build_test_state, seed_live_session, seed_state_db, StateSeedRow};

#[test]
fn ingest_creates_live_only_root_visible_in_session_list_and_flow() {
    let state = build_test_state("live-only-root");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    seed_state_db(&state.source_paths.state_db_path, &[]);
    seed_live_session(
        &state
            .source_paths
            .live_sessions_dir
            .join("2026/03/10/thread-live-only.jsonl"),
        &[
            json!({
                "timestamp": "2026-03-10T06:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-live-only",
                    "timestamp": "2026-03-10T06:00:00Z",
                    "cwd": "/workspace/live-only",
                    "source": "vscode"
                }
            }),
            json!({
                "timestamp": "2026-03-10T06:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "Live Only Root Title"
                }
            }),
        ],
    );

    run_incremental_ingest(&state).expect("ingest should succeed for live-only root");

    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let metadata = connection
        .query_row(
            "
            select rollout_path, source_kind, archived
            from threads
            where thread_id = ?1
            ",
            params!["thread-live-only"],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .expect("live-only thread should be inserted");
    assert_eq!(metadata.0, "");
    assert_eq!(metadata.1, "live_session");
    assert_eq!(metadata.2, 0);

    let live_threads =
        list_sessions_from_db(&state, SessionScope::Live, None).expect("list live sessions");
    assert_eq!(
        live_threads
            .sessions
            .iter()
            .map(|thread| thread.session_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-live-only"]
    );
    assert_eq!(live_threads.sessions[0].workspace, "/workspace/live-only");

    let flow = get_session_flow_from_db(&state, "thread-live-only")
        .expect("flow query should succeed")
        .expect("live-only flow should exist");
    assert_eq!(flow.lanes.len(), 2);
    assert_eq!(
        flow.items
            .iter()
            .map(|item| {
                (
                    item.kind.clone(),
                    item.lane.clone(),
                    item.summary.clone(),
                    item.started_at.to_rfc3339(),
                )
            })
            .collect::<Vec<_>>(),
        vec![(
            SessionFlowItemKind::UserMessage,
            SessionLaneRef::User,
            Some("Live Only Root Title".to_string()),
            "2026-03-10T06:00:01+00:00".to_string(),
        )]
    );
}

#[test]
fn ingest_unarchives_archived_snapshot_root_for_live_session_views() {
    let state = build_test_state("live-unarchive");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    seed_state_db(
        &state.source_paths.state_db_path,
        &[StateSeedRow {
            id: "thread-archived-live",
            rollout_path: "/rollout/from-state",
            created_at: 1_778_200_000,
            updated_at: 1_778_200_100,
            source: "vscode",
            cwd: "/workspace/from-state",
            title: "State Title",
            archived: 1,
            agent_role: None,
            agent_nickname: None,
        }],
    );
    seed_live_session(
        &state
            .source_paths
            .live_sessions_dir
            .join("2026/03/10/thread-archived-live.jsonl"),
        &[
            json!({
                "timestamp": "2026-03-10T07:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-archived-live",
                    "timestamp": "2026-03-10T07:00:00Z",
                    "cwd": "/workspace/from-live",
                    "source": "vscode"
                }
            }),
            json!({
                "timestamp": "2026-03-10T07:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "Live Title"
                }
            }),
        ],
    );

    run_incremental_ingest(&state).expect("ingest should succeed for archived live root");

    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let archived_flag: i64 = connection
        .query_row(
            "select archived from threads where thread_id = ?1",
            params!["thread-archived-live"],
            |row| row.get(0),
        )
        .expect("thread should exist");
    assert_eq!(archived_flag, 0);

    let live_threads =
        list_sessions_from_db(&state, SessionScope::Live, None).expect("list live sessions");
    assert_eq!(
        live_threads
            .sessions
            .iter()
            .map(|thread| thread.session_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-archived-live"]
    );
    assert_eq!(live_threads.sessions[0].workspace, "/workspace/from-live");

    let flow = get_session_flow_from_db(&state, "thread-archived-live")
        .expect("flow query should succeed")
        .expect("archived-live flow should exist");
    assert!(!flow.session.archived);
    assert_eq!(flow.lanes.len(), 2);
    assert_eq!(
        flow.items
            .iter()
            .map(|item| {
                (
                    item.kind.clone(),
                    item.lane.clone(),
                    item.summary.clone(),
                    item.started_at.to_rfc3339(),
                )
            })
            .collect::<Vec<_>>(),
        vec![(
            SessionFlowItemKind::UserMessage,
            SessionLaneRef::User,
            Some("Live Title".to_string()),
            "2026-03-10T07:00:01+00:00".to_string(),
        )]
    );
}

#[test]
fn ingest_groups_main_repo_and_worktree_under_same_workspace_root() {
    let state = build_test_state("workspace-root-grouping");
    init_monitor_db(&state).expect("failed to initialize monitor db");

    let fixture_root = state
        .source_paths
        .state_db_path
        .parent()
        .expect("test root should exist");
    let repo_root = fixture_root.join("repo");
    let worktree_root = fixture_root.join(".codex/worktrees/1234/repo");
    let gitdir = repo_root.join(".git/worktrees/repo");

    fs::create_dir_all(repo_root.join(".git")).expect("create repo .git");
    fs::create_dir_all(&gitdir).expect("create worktree gitdir");
    fs::create_dir_all(&worktree_root).expect("create worktree root");
    fs::write(
        worktree_root.join(".git"),
        format!("gitdir: {}\n", gitdir.display()),
    )
    .expect("write worktree .git");
    fs::write(gitdir.join("commondir"), "../..\n").expect("write commondir");
    let repo_cwd = repo_root.to_string_lossy().into_owned();
    let worktree_cwd = worktree_root.to_string_lossy().into_owned();

    seed_state_db(
        &state.source_paths.state_db_path,
        &[
            StateSeedRow {
                id: "thread-main",
                rollout_path: "/rollout/main",
                created_at: 1_778_300_000,
                updated_at: 1_778_300_100,
                source: "vscode",
                cwd: repo_cwd.as_str(),
                title: "Main Repo",
                archived: 0,
                agent_role: None,
                agent_nickname: None,
            },
            StateSeedRow {
                id: "thread-worktree",
                rollout_path: "/rollout/worktree",
                created_at: 1_778_300_010,
                updated_at: 1_778_300_110,
                source: "vscode",
                cwd: worktree_cwd.as_str(),
                title: "Worktree Repo",
                archived: 0,
                agent_role: None,
                agent_nickname: None,
            },
        ],
    );

    run_incremental_ingest(&state).expect("ingest should succeed");

    let live_threads =
        list_sessions_from_db(&state, SessionScope::Live, None).expect("list live sessions");
    let expected_workspace = repo_root.display().to_string();
    let expected_hint = worktree_root.display().to_string();

    assert_eq!(live_threads.workspaces, vec![expected_workspace.clone()]);
    assert_eq!(live_threads.sessions.len(), 2);
    assert!(live_threads.sessions.iter().all(|session| session.workspace == expected_workspace));
    assert_eq!(
        live_threads
            .sessions
            .iter()
            .find(|session| session.session_id == "thread-main")
            .and_then(|session| session.workspace_hint.clone()),
        None
    );
    assert_eq!(
        live_threads
            .sessions
            .iter()
            .find(|session| session.session_id == "thread-worktree")
            .and_then(|session| session.workspace_hint.clone()),
        Some(expected_hint)
    );
}
