use rusqlite::Connection;

use crate::domain::ArchiveListFilters;
use crate::domain::models::ThreadStatus;
use crate::index_db::init_monitor_db;

use super::super::archive_list::list_archived_sessions_from_db;
use super::support::{
    build_test_state, insert_agent_with_role, insert_thread, insert_thread_with_rollout,
};

#[test]
fn list_archived_sessions_filters_archived_root_sessions_and_collects_workspaces() {
    let state = build_test_state("archive-list");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread_with_rollout(
        &connection,
        "thread-archived-b",
        "completed",
        1,
        Some("2026-03-10T04:00:00Z"),
        "/rollout/b.jsonl",
    );
    insert_thread_with_rollout(
        &connection,
        "thread-archived-a",
        "completed",
        1,
        Some("2026-03-10T05:00:00Z"),
        "/rollout/a.jsonl",
    );
    insert_thread(
        &connection,
        "thread-live",
        "completed",
        0,
        Some("2026-03-10T06:00:00Z"),
    );

    insert_agent_with_role(
        &connection,
        "session-reviewer",
        "thread-archived-a",
        "reviewer",
        1,
        Some("2026-03-10T05:01:00Z"),
    );
    insert_agent_with_role(
        &connection,
        "session-reviewer-dup",
        "thread-archived-a",
        "reviewer",
        2,
        Some("2026-03-10T05:02:00Z"),
    );

    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, latest_activity_summary = ?3 where thread_id = ?4",
            ("Archive Alpha", "/workspace/alpha", Some("alpha summary"), "thread-archived-a"),
        )
        .expect("update thread a");
    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, latest_activity_summary = ?3 where thread_id = ?4",
            ("Archive Beta", "/workspace/beta", Some("beta summary"), "thread-archived-b"),
        )
        .expect("update thread b");

    let payload = list_archived_sessions_from_db(
        &state,
        Some(ArchiveListFilters {
            workspace: Some("/workspace/alpha".to_string()),
            query: Some("alpha".to_string()),
            from_date: Some("2026-03-10".to_string()),
            to_date: Some("2026-03-10".to_string()),
        }),
    )
    .expect("archive list should work");

    assert_eq!(
        payload.workspaces,
        vec!["/workspace/alpha".to_string(), "/workspace/beta".to_string()]
    );
    assert_eq!(payload.sessions.len(), 1);
    assert_eq!(payload.sessions[0].thread_id, "thread-archived-a");
    assert_eq!(payload.sessions[0].title, "Archive Alpha");
    assert_eq!(payload.sessions[0].status, ThreadStatus::Completed);
    assert_eq!(payload.sessions[0].agent_roles, vec!["reviewer".to_string()]);
    assert_eq!(
        payload.sessions[0].rollout_path.as_deref(),
        Some("/rollout/a.jsonl")
    );
}

#[test]
fn list_archived_sessions_returns_sorted_archived_sessions_without_filters() {
    let state = build_test_state("archive-list-all");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(
        &connection,
        "thread-old",
        "completed",
        1,
        Some("2026-03-10T03:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-new",
        "completed",
        1,
        Some("2026-03-10T05:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-live",
        "completed",
        0,
        Some("2026-03-10T06:00:00Z"),
    );

    let payload =
        list_archived_sessions_from_db(&state, None).expect("archive list should work");

    assert_eq!(
        payload
            .sessions
            .iter()
            .map(|session| session.thread_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-new", "thread-old"]
    );
}
