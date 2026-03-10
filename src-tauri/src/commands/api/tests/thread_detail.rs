use std::fs;

use rusqlite::Connection;
use serde_json::json;

use crate::index_db::init_monitor_db;

use super::super::thread_detail::{get_thread_detail_from_db, get_thread_drilldown_from_db};
use super::support::{
    build_test_state, insert_agent, insert_agent_with_role_and_rollout, insert_thread,
    insert_thread_with_rollout, insert_timeline_event, insert_tool_span, insert_wait_span,
    seed_live_session,
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
            .map(|span| span.call_id.as_str())
            .collect::<Vec<_>>(),
        vec!["wait-a", "wait-b"]
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
            .map(|span| span.call_id.as_str())
            .collect::<Vec<_>>(),
        vec!["tool-a", "tool-b"]
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

#[test]
fn get_thread_drilldown_returns_main_lane_raw_summary_tools_and_latest_waits() {
    let state = build_test_state("thread-drilldown-main");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let rollout_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/thread-main-1.jsonl");
    seed_live_session(
        &rollout_path,
        &[
            json!({
                "timestamp": "2026-03-10T02:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-main-1",
                    "timestamp": "2026-03-10T02:00:00Z",
                    "cwd": "/workspace",
                    "source": "vscode"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "root task"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:02Z",
                "type": "event_msg",
                "payload": {
                    "type": "agent_message",
                    "phase": "commentary",
                    "message": "first note"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:03Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-spawn",
                    "name": "spawn_agent",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:04Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-spawn",
                    "output": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:05Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-tool-1",
                    "name": "exec_command",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:06Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-tool-1",
                    "output": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:07Z",
                "type": "event_msg",
                "payload": {
                    "type": "agent_message",
                    "phase": "commentary",
                    "message": "latest note"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:08Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-tool-2",
                    "name": "request_user_input",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:09Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-tool-2",
                    "output": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:10Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-tool-3",
                    "name": "exec_command",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:11Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-tool-3",
                    "output": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:12Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-tool-4",
                    "name": "exec_command",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T02:00:13Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-tool-4",
                    "output": "{}"
                }
            }),
        ],
    );

    insert_thread_with_rollout(
        &connection,
        "thread-main-1",
        "inflight",
        0,
        Some("2026-03-10T02:00:13Z"),
        &rollout_path.to_string_lossy(),
    );
    insert_wait_span(
        &connection,
        "wait-1",
        "thread-main-1",
        "thread-main-1",
        Some("session-a"),
        "2026-03-10T02:00:05Z",
        Some("2026-03-10T02:00:06Z"),
        Some(1_000),
    );
    insert_wait_span(
        &connection,
        "wait-2",
        "thread-main-1",
        "thread-main-1",
        Some("session-b"),
        "2026-03-10T02:00:07Z",
        Some("2026-03-10T02:00:08Z"),
        Some(1_000),
    );
    insert_wait_span(
        &connection,
        "wait-3",
        "thread-main-1",
        "thread-main-1",
        Some("session-c"),
        "2026-03-10T02:00:09Z",
        Some("2026-03-10T02:00:10Z"),
        Some(1_000),
    );
    insert_wait_span(
        &connection,
        "wait-4",
        "thread-main-1",
        "thread-main-1",
        Some("session-d"),
        "2026-03-10T02:00:11Z",
        Some("2026-03-10T02:00:12Z"),
        Some(1_000),
    );

    let drilldown = get_thread_drilldown_from_db(&state, "thread-main-1", "thread-main-1")
        .expect("get_thread_drilldown should work")
        .expect("main lane drilldown should exist");

    assert_eq!(drilldown.lane_id, "thread-main-1");
    assert_eq!(drilldown.latest_commentary_summary.as_deref(), Some("latest note"));
    assert_eq!(
        drilldown.latest_commentary_at.map(|value| value.to_rfc3339()),
        Some("2026-03-10T02:00:07+00:00".to_string())
    );
    assert_eq!(
        drilldown
            .recent_tool_spans
            .iter()
            .map(|span| span.call_id.as_str())
            .collect::<Vec<_>>(),
        vec!["call-tool-4", "call-tool-3", "call-tool-2"]
    );
    assert_eq!(
        drilldown
            .recent_tool_spans
            .iter()
            .map(|span| span.tool_name.as_str())
            .collect::<Vec<_>>(),
        vec!["exec_command", "exec_command", "request_user_input"]
    );
    assert_eq!(
        drilldown
            .recent_tool_spans
            .iter()
            .map(|span| span.started_at.to_rfc3339())
            .collect::<Vec<_>>(),
        vec![
            "2026-03-10T02:00:12+00:00",
            "2026-03-10T02:00:10+00:00",
            "2026-03-10T02:00:08+00:00",
        ]
    );
    assert_eq!(
        drilldown
            .related_wait_spans
            .iter()
            .map(|span| span.call_id.as_str())
            .collect::<Vec<_>>(),
        vec!["wait-4", "wait-3", "wait-2"]
    );
    assert_eq!(
        drilldown
            .related_wait_spans
            .iter()
            .map(|span| span.child_session_id.as_deref())
            .collect::<Vec<_>>(),
        vec![Some("session-d"), Some("session-c"), Some("session-b")]
    );
    let raw_snippet = drilldown.raw_snippet.expect("raw snippet should exist");
    assert_eq!(raw_snippet.source_label, "thread-main-1.jsonl");
    assert_eq!(
        raw_snippet
            .lines
            .iter()
            .map(|line| line.line_number)
            .collect::<Vec<_>>(),
        vec![4, 5, 6, 7, 8, 9, 10, 11]
    );
    assert!(raw_snippet.truncated);
}

#[test]
fn get_thread_drilldown_uses_agent_rollout_path_and_filters_waits_by_lane() {
    let state = build_test_state("thread-drilldown-agent");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let root_rollout_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/thread-main-1.jsonl");
    let agent_rollout_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/session-child-1.jsonl");

    seed_live_session(
        &root_rollout_path,
        &[json!({
            "timestamp": "2026-03-10T03:00:00Z",
            "type": "session_meta",
            "payload": {
                "id": "thread-main-1",
                "timestamp": "2026-03-10T03:00:00Z",
                "cwd": "/workspace",
                "source": "vscode"
            }
        })],
    );
    seed_live_session(
        &agent_rollout_path,
        &[
            json!({
                "timestamp": "2026-03-10T03:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "session-child-1",
                    "timestamp": "2026-03-10T03:00:00Z",
                    "cwd": "/workspace",
                    "source": {
                        "subagent": {
                            "thread_spawn": {
                                "parent_thread_id": "thread-main-1",
                                "depth": 1
                            }
                        }
                    }
                }
            }),
            json!({
                "timestamp": "2026-03-10T03:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "agent_message",
                    "phase": "commentary",
                    "message": "child commentary"
                }
            }),
            json!({
                "timestamp": "2026-03-10T03:00:02Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "child-tool",
                    "name": "exec_command",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T03:00:04Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "child-tool",
                    "output": "{}"
                }
            }),
        ],
    );

    insert_thread_with_rollout(
        &connection,
        "thread-main-1",
        "inflight",
        0,
        Some("2026-03-10T03:00:05Z"),
        &root_rollout_path.to_string_lossy(),
    );
    insert_agent_with_role_and_rollout(
        &connection,
        "session-child-1",
        "thread-main-1",
        "worker",
        1,
        Some("2026-03-10T03:00:00Z"),
        &agent_rollout_path.to_string_lossy(),
    );
    insert_wait_span(
        &connection,
        "wait-a",
        "thread-main-1",
        "thread-main-1",
        Some("session-child-1"),
        "2026-03-10T03:00:03Z",
        Some("2026-03-10T03:00:04Z"),
        Some(1_000),
    );
    insert_wait_span(
        &connection,
        "wait-b",
        "thread-main-1",
        "thread-main-1",
        Some("session-child-1"),
        "2026-03-10T03:00:04Z",
        Some("2026-03-10T03:00:05Z"),
        Some(1_000),
    );
    insert_wait_span(
        &connection,
        "wait-c",
        "thread-main-1",
        "thread-main-1",
        Some("session-other"),
        "2026-03-10T03:00:05Z",
        Some("2026-03-10T03:00:06Z"),
        Some(1_000),
    );

    let drilldown = get_thread_drilldown_from_db(&state, "thread-main-1", "session-child-1")
        .expect("get_thread_drilldown should work")
        .expect("agent lane drilldown should exist");

    assert_eq!(drilldown.lane_id, "session-child-1");
    assert_eq!(
        drilldown
            .recent_tool_spans
            .iter()
            .map(|span| span.agent_session_id.as_deref())
            .collect::<Vec<_>>(),
        vec![Some("session-child-1")]
    );
    assert_eq!(
        drilldown
            .related_wait_spans
            .iter()
            .map(|span| span.child_session_id.as_deref())
            .collect::<Vec<_>>(),
        vec![Some("session-child-1"), Some("session-child-1")]
    );
    assert_eq!(
        drilldown
            .raw_snippet
            .as_ref()
            .map(|snippet| snippet.source_label.as_str()),
        Some("session-child-1.jsonl")
    );
}

#[test]
fn get_thread_drilldown_degrades_when_rollout_file_is_missing() {
    let state = build_test_state("thread-drilldown-missing");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let missing_rollout_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/missing.jsonl");

    insert_thread_with_rollout(
        &connection,
        "thread-main-1",
        "inflight",
        0,
        Some("2026-03-10T04:00:00Z"),
        &missing_rollout_path.to_string_lossy(),
    );

    let drilldown = get_thread_drilldown_from_db(&state, "thread-main-1", "thread-main-1")
        .expect("get_thread_drilldown should work")
        .expect("drilldown should still exist");

    assert_eq!(drilldown.latest_commentary_summary, None);
    assert!(drilldown.recent_tool_spans.is_empty());
    assert!(drilldown.related_wait_spans.is_empty());
    assert!(drilldown.raw_snippet.is_none());

    fs::remove_file(&missing_rollout_path).ok();
}
