use rusqlite::Connection;

use crate::index_db::init_monitor_db;

use super::super::thread_detail::get_thread_detail_from_db;
use super::support::{
    build_test_state, insert_agent, insert_thread, insert_timeline_event, insert_tool_span,
    insert_wait_span,
};

#[test]
fn get_thread_detail_returns_sorted_agents_and_timeline_arrays() {
    let state = build_test_state("thread-detail");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(
        &connection,
        "thread-main-1",
        "inflight",
        0,
        Some("2026-03-10T02:00:00Z"),
    );
    insert_agent(
        &connection,
        "session-depth2",
        "thread-main-1",
        2,
        Some("2026-03-10T02:10:00Z"),
    );
    insert_agent(
        &connection,
        "session-depth1-b",
        "thread-main-1",
        1,
        Some("2026-03-10T02:05:00Z"),
    );
    insert_agent(
        &connection,
        "session-depth1-a",
        "thread-main-1",
        1,
        Some("2026-03-10T02:05:00Z"),
    );
    insert_timeline_event(
        &connection,
        "event-late",
        "thread-main-1",
        "tool",
        "2026-03-10T02:08:00Z",
        Some("2026-03-10T02:09:00Z"),
        Some("late"),
    );
    insert_timeline_event(
        &connection,
        "event-early-b",
        "thread-main-1",
        "commentary",
        "2026-03-10T02:04:00Z",
        None,
        Some("second same-time event"),
    );
    insert_timeline_event(
        &connection,
        "event-early-a",
        "thread-main-1",
        "commentary",
        "2026-03-10T02:04:00Z",
        None,
        Some("first same-time event"),
    );
    insert_wait_span(
        &connection,
        "wait-b",
        "thread-main-1",
        "thread-main-1",
        Some("session-depth2"),
        "2026-03-10T02:07:00Z",
        Some("2026-03-10T02:09:00Z"),
        Some(2_000),
    );
    insert_wait_span(
        &connection,
        "wait-a",
        "thread-main-1",
        "thread-main-1",
        Some("session-depth1-a"),
        "2026-03-10T02:07:00Z",
        Some("2026-03-10T02:08:00Z"),
        Some(1_000),
    );
    insert_tool_span(
        &connection,
        "tool-b",
        "thread-main-1",
        None,
        "exec_command",
        "2026-03-10T02:06:00Z",
        Some("2026-03-10T02:10:00Z"),
        Some(4_000),
    );
    insert_tool_span(
        &connection,
        "tool-a",
        "thread-main-1",
        None,
        "spawn_agent",
        "2026-03-10T02:06:00Z",
        Some("2026-03-10T02:06:30Z"),
        Some(500),
    );

    let detail = get_thread_detail_from_db(&state, "thread-main-1")
        .expect("get_thread_detail should work")
        .expect("thread detail should exist");

    assert_eq!(detail.thread.thread_id, "thread-main-1");
    let session_ids = detail
        .agents
        .iter()
        .map(|agent| agent.session_id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        session_ids,
        vec!["session-depth1-a", "session-depth1-b", "session-depth2"]
    );
    assert_eq!(
        detail
            .timeline_events
            .iter()
            .map(|event| event.event_id.as_str())
            .collect::<Vec<_>>(),
        vec!["event-early-a", "event-early-b", "event-late"]
    );
    assert_eq!(
        detail
            .wait_spans
            .iter()
            .map(|span| span.child_session_id.as_deref())
            .collect::<Vec<_>>(),
        vec![Some("session-depth1-a"), Some("session-depth2")]
    );
    assert_eq!(
        detail
            .tool_spans
            .iter()
            .map(|span| span.tool_name.as_str())
            .collect::<Vec<_>>(),
        vec!["spawn_agent", "exec_command"]
    );
}
