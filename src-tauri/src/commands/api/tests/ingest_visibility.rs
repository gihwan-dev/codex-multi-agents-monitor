use rusqlite::{params, Connection};
use serde_json::json;

use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;

use super::super::live_overview::list_live_threads_from_db;
use super::super::thread_detail::get_thread_detail_from_db;
use super::support::{build_test_state, seed_live_session, seed_state_db, StateSeedRow};

#[test]
fn ingest_creates_live_only_root_visible_in_overview_and_detail() {
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

    let live_threads = list_live_threads_from_db(&state).expect("list live threads");
    assert_eq!(
        live_threads
            .iter()
            .map(|thread| thread.thread_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-live-only"]
    );

    let detail = get_thread_detail_from_db(&state, "thread-live-only")
        .expect("detail query should succeed")
        .expect("live-only detail should exist");
    assert!(detail.agents.is_empty());
    assert!(detail.timeline_events.is_empty());
    assert!(detail.wait_spans.is_empty());
    assert!(detail.tool_spans.is_empty());
}

#[test]
fn ingest_unarchives_archived_snapshot_root_for_live_overview_and_detail() {
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

    let live_threads = list_live_threads_from_db(&state).expect("list live threads");
    assert_eq!(
        live_threads
            .iter()
            .map(|thread| thread.thread_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-archived-live"]
    );

    let detail = get_thread_detail_from_db(&state, "thread-archived-live")
        .expect("detail query should succeed")
        .expect("archived-live detail should exist");
    assert!(!detail.thread.archived);
    assert!(detail.agents.is_empty());
    assert!(detail.timeline_events.is_empty());
    assert!(detail.wait_spans.is_empty());
    assert!(detail.tool_spans.is_empty());
}
