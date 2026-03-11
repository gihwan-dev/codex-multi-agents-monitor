use chrono::{TimeZone, Utc};
use rusqlite::Connection;

use crate::domain::models::{BottleneckLevel, MiniTimelineItemKind, ThreadStatus};
use crate::index_db::init_monitor_db;

use super::super::live_overview::{
    list_live_threads_from_db, list_live_threads_from_db_at,
};
use super::support::{
    build_test_state, insert_agent_with_role, insert_thread, insert_timeline_event,
    insert_tool_span, insert_wait_span,
};

#[test]
fn list_live_threads_returns_unarchived_root_threads_even_when_completed() {
    let state = build_test_state("list-live");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(
        &connection,
        "thread-live-new",
        "inflight",
        0,
        Some("2026-03-10T03:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-completed",
        "completed",
        0,
        Some("2026-03-10T04:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-archived",
        "inflight",
        1,
        Some("2026-03-10T05:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-live-old",
        "inflight",
        0,
        Some("2026-03-10T01:00:00Z"),
    );

    let threads = list_live_threads_from_db(&state).expect("list_live_threads should work");
    let ids = threads
        .iter()
        .map(|thread| thread.thread_id.as_str())
        .collect::<Vec<_>>();

    assert_eq!(
        ids,
        vec!["thread-completed", "thread-live-new", "thread-live-old"]
    );
}

#[test]
fn list_live_threads_excludes_archived_threads_but_preserves_completed_status() {
    let state = build_test_state("list-live-completed");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(
        &connection,
        "thread-completed",
        "completed",
        0,
        Some("2026-03-10T04:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-archived",
        "completed",
        1,
        Some("2026-03-10T05:00:00Z"),
    );

    let threads = list_live_threads_from_db(&state).expect("list_live_threads should work");

    assert_eq!(threads.len(), 1);
    assert_eq!(threads[0].thread_id, "thread-completed");
    assert_eq!(threads[0].status, ThreadStatus::Completed);
}

#[test]
fn list_live_threads_calculates_overview_fields_and_clips_mini_timeline() {
    let state = build_test_state("list-live-overview");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(
        &connection,
        "thread-critical",
        "inflight",
        0,
        Some("2026-03-10T09:59:40Z"),
    );
    insert_thread(
        &connection,
        "thread-tool-warning",
        "inflight",
        0,
        Some("2026-03-10T09:59:20Z"),
    );
    insert_thread(
        &connection,
        "thread-normal",
        "inflight",
        0,
        Some("2026-03-10T09:58:00Z"),
    );
    insert_agent_with_role(
        &connection,
        "session-reviewer-a",
        "thread-critical",
        "reviewer",
        1,
        Some("2026-03-10T09:50:10Z"),
    );
    insert_agent_with_role(
        &connection,
        "session-reviewer-b",
        "thread-critical",
        "reviewer",
        2,
        Some("2026-03-10T09:50:20Z"),
    );
    insert_agent_with_role(
        &connection,
        "session-implementer",
        "thread-critical",
        "implementer",
        1,
        Some("2026-03-10T09:50:30Z"),
    );
    insert_wait_span(
        &connection,
        "wait-open-critical",
        "thread-critical",
        "thread-critical",
        Some("session-reviewer-a"),
        "2026-03-10T09:48:00Z",
        None,
        None,
    );
    insert_tool_span(
        &connection,
        "tool-closed-critical",
        "thread-critical",
        Some("session-reviewer-a"),
        "spawn_agent",
        "2026-03-10T09:55:00Z",
        Some("2026-03-10T09:55:12Z"),
        Some(12_000),
    );
    insert_tool_span(
        &connection,
        "tool-open-critical",
        "thread-critical",
        Some("session-reviewer-b"),
        "exec_command",
        "2026-03-10T09:59:30Z",
        None,
        None,
    );
    insert_timeline_event(
        &connection,
        "spawn-critical",
        "thread-critical",
        "spawn",
        "2026-03-10T09:50:15Z",
        None,
        Some("spawned reviewer"),
    );
    insert_timeline_event(
        &connection,
        "commentary-critical-old",
        "thread-critical",
        "commentary",
        "2026-03-10T09:49:00Z",
        None,
        Some("too old"),
    );
    insert_timeline_event(
        &connection,
        "commentary-critical",
        "thread-critical",
        "commentary",
        "2026-03-10T09:59:50Z",
        None,
        Some("recent update"),
    );
    insert_timeline_event(
        &connection,
        "final-critical",
        "thread-critical",
        "final",
        "2026-03-10T09:59:59Z",
        None,
        Some("done"),
    );
    insert_tool_span(
        &connection,
        "tool-open-warning",
        "thread-tool-warning",
        None,
        "exec_command",
        "2026-03-10T09:59:35Z",
        None,
        None,
    );

    let now = Utc
        .with_ymd_and_hms(2026, 3, 10, 10, 0, 0)
        .single()
        .expect("fixed timestamp should exist");
    let threads = list_live_threads_from_db_at(&state, now).expect("list live threads");

    assert_eq!(
        threads
            .iter()
            .map(|thread| thread.thread_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-critical", "thread-tool-warning", "thread-normal"]
    );

    let critical = &threads[0];
    assert_eq!(critical.status, ThreadStatus::Inflight);
    assert_eq!(critical.agent_roles, vec!["implementer", "reviewer"]);
    assert_eq!(critical.bottleneck_level, BottleneckLevel::Critical);
    assert_eq!(critical.longest_wait_ms, Some(720_000));
    assert_eq!(critical.active_tool_name.as_deref(), Some("exec_command"));
    assert_eq!(critical.active_tool_ms, Some(30_000));
    assert_eq!(
        critical.mini_timeline_window_started_at,
        Utc.with_ymd_and_hms(2026, 3, 10, 9, 50, 0)
            .single()
            .expect("window start should exist")
    );
    assert_eq!(critical.mini_timeline_window_ended_at, now);
    assert_eq!(
        critical
            .mini_timeline
            .iter()
            .map(|item| item.kind.clone())
            .collect::<Vec<_>>(),
        vec![
            MiniTimelineItemKind::Wait,
            MiniTimelineItemKind::Spawn,
            MiniTimelineItemKind::Tool,
            MiniTimelineItemKind::Tool,
            MiniTimelineItemKind::Message,
            MiniTimelineItemKind::Complete,
        ]
    );
    assert_eq!(
        critical.mini_timeline[0].started_at,
        Utc.with_ymd_and_hms(2026, 3, 10, 9, 50, 0)
            .single()
            .expect("window start should exist")
    );
    assert_eq!(critical.mini_timeline[0].ended_at, Some(now));

    let warning = threads
        .iter()
        .find(|thread| thread.thread_id == "thread-tool-warning")
        .expect("tool warning thread should exist");
    assert_eq!(warning.agent_roles, Vec::<String>::new());
    assert_eq!(warning.longest_wait_ms, None);
    assert_eq!(warning.active_tool_name.as_deref(), Some("exec_command"));
    assert_eq!(warning.active_tool_ms, Some(25_000));
    assert_eq!(warning.bottleneck_level, BottleneckLevel::Warning);
}
