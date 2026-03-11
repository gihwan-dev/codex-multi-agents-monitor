use std::fs;

use chrono::{TimeZone, Utc};
use rusqlite::Connection;
use serde_json::json;

use crate::domain::HistorySourceKey;
use crate::ingest::run_incremental_ingest;
use crate::index_db::init_monitor_db;

use super::super::history_summary::build_history_summary_at;
use super::support::{
    build_test_state, insert_agent_with_role_and_times, insert_thread, insert_thread_with_rollout,
    seed_live_session,
};

#[test]
fn build_history_summary_limits_to_recent_completed_root_threads() {
    let state = build_test_state("history-window");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let rollout_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/history-window.jsonl");
    if let Some(parent) = rollout_path.parent() {
        fs::create_dir_all(parent).expect("create rollout dir");
    }
    fs::write(&rollout_path, "").expect("write empty rollout");

    insert_thread_with_rollout(
        &connection,
        "thread-recent",
        "completed",
        0,
        Some("2026-03-10T10:00:00Z"),
        &rollout_path.display().to_string(),
    );
    insert_thread(
        &connection,
        "thread-old",
        "completed",
        1,
        Some("2026-03-03T10:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-inflight",
        "inflight",
        0,
        Some("2026-03-10T11:00:00Z"),
    );

    let now = Utc
        .with_ymd_and_hms(2026, 3, 10, 12, 0, 0)
        .single()
        .expect("fixed timestamp should exist");
    let summary = build_history_summary_at(&state, now).expect("history summary should build");

    assert_eq!(summary.history.from_date, "2026-03-04");
    assert_eq!(summary.history.to_date, "2026-03-10");
    assert_eq!(summary.history.thread_count, 1);
    assert_eq!(summary.history.average_duration_ms, Some(36_000_000));
    assert_eq!(summary.history.timeout_count, 0);
    assert_eq!(summary.history.spawn_count, 0);
    assert!(summary.health.missing_sources.is_empty());
    assert_eq!(summary.health.degraded_rollout_threads, 0);
    assert!(summary.roles.is_empty());
    assert_eq!(summary.slow_threads.len(), 1);
    assert_eq!(summary.slow_threads[0].thread_id, "thread-recent");
}

#[test]
fn build_history_summary_aggregates_role_duration_spawn_and_timeout_metrics() {
    let state = build_test_state("history-role-metrics");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let rollout_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/history-role-metrics.jsonl");

    seed_live_session(
        &rollout_path,
        &[
            json!({
                "timestamp": "2026-03-10T01:00:00Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-spawn-1",
                    "name": "spawn_agent",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T01:00:05Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-spawn-2",
                    "name": "spawn_agent",
                    "arguments": "{}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T01:05:00Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-wait-single",
                    "name": "wait",
                    "arguments": "{\"ids\":[\"session-reviewer\"]}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T01:05:05Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-wait-single",
                    "output": "{\"status\":{\"session-reviewer\":{\"running\":true}},\"timed_out\":true}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T01:06:00Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-wait-multi",
                    "name": "wait",
                    "arguments": "{\"ids\":[\"session-reviewer\",\"session-implementer\"]}"
                }
            }),
            json!({
                "timestamp": "2026-03-10T01:06:10Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-wait-multi",
                    "output": "{\"status\":{\"session-reviewer\":{\"running\":true},\"session-implementer\":{\"running\":true}},\"timed_out\":true}"
                }
            }),
        ],
    );

    insert_thread_with_rollout(
        &connection,
        "thread-role-metrics",
        "completed",
        1,
        Some("2026-03-10T02:00:00Z"),
        &rollout_path.display().to_string(),
    );
    insert_agent_with_role_and_times(
        &connection,
        "session-reviewer",
        "thread-role-metrics",
        "reviewer",
        1,
        Some("2026-03-10T00:30:00Z"),
        Some("2026-03-10T01:30:00Z"),
    );
    insert_agent_with_role_and_times(
        &connection,
        "session-implementer",
        "thread-role-metrics",
        "implementer",
        1,
        Some("2026-03-10T00:45:00Z"),
        Some("2026-03-10T01:15:00Z"),
    );

    let now = Utc
        .with_ymd_and_hms(2026, 3, 10, 12, 0, 0)
        .single()
        .expect("fixed timestamp should exist");
    let summary = build_history_summary_at(&state, now).expect("history summary should build");

    assert_eq!(summary.history.thread_count, 1);
    assert_eq!(summary.history.spawn_count, 2);
    assert_eq!(summary.history.timeout_count, 2);
    assert!(summary.health.missing_sources.is_empty());
    assert_eq!(summary.health.degraded_rollout_threads, 0);
    assert_eq!(summary.roles.len(), 2);
    assert_eq!(summary.roles[0].agent_role, "reviewer");
    assert_eq!(summary.roles[0].session_count, 1);
    assert_eq!(summary.roles[0].spawn_count, 1);
    assert_eq!(summary.roles[0].timeout_count, 1);
    assert_eq!(summary.roles[0].average_duration_ms, Some(3_600_000));
    assert_eq!(summary.roles[1].agent_role, "implementer");
    assert_eq!(summary.roles[1].timeout_count, 0);
    assert_eq!(summary.roles[1].average_duration_ms, Some(1_800_000));
    assert_eq!(summary.slow_threads.len(), 1);
    assert_eq!(summary.slow_threads[0].spawn_count, 2);
    assert_eq!(summary.slow_threads[0].timeout_count, 2);
    let expected_rollout_path = rollout_path.display().to_string();
    assert_eq!(
        summary.slow_threads[0].agent_roles,
        vec!["implementer".to_string(), "reviewer".to_string()]
    );
    assert_eq!(
        summary.slow_threads[0].rollout_path.as_deref(),
        Some(expected_rollout_path.as_str())
    );
}

#[test]
fn build_history_summary_reports_missing_sources() {
    let state = build_test_state("history-missing-sources");
    init_monitor_db(&state).expect("failed to initialize monitor db");

    fs::remove_dir_all(&state.source_paths.live_sessions_dir).expect("remove live sessions dir");
    fs::remove_dir_all(&state.source_paths.archived_sessions_dir)
        .expect("remove archived sessions dir");
    fs::remove_file(&state.source_paths.state_db_path).expect("remove state db file");

    let now = Utc
        .with_ymd_and_hms(2026, 3, 10, 12, 0, 0)
        .single()
        .expect("fixed timestamp should exist");
    let summary = build_history_summary_at(&state, now).expect("history summary should build");

    assert_eq!(
        summary.health.missing_sources,
        vec![
            HistorySourceKey::LiveSessions,
            HistorySourceKey::ArchivedSessions,
            HistorySourceKey::StateDb,
        ]
    );
    assert_eq!(summary.health.degraded_rollout_threads, 0);
    assert_eq!(summary.history.thread_count, 0);
}

#[test]
fn run_incremental_ingest_degrades_when_state_db_is_missing() {
    let state = build_test_state("history-missing-state-db");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    fs::remove_file(&state.source_paths.state_db_path).expect("remove state db file");

    run_incremental_ingest(&state).expect("ingest should tolerate missing state db");

    let now = Utc
        .with_ymd_and_hms(2026, 3, 10, 12, 0, 0)
        .single()
        .expect("fixed timestamp should exist");
    let summary = build_history_summary_at(&state, now).expect("history summary should build");

    assert_eq!(summary.health.missing_sources, vec![HistorySourceKey::StateDb]);
    assert_eq!(summary.history.thread_count, 0);
}

#[test]
fn build_history_summary_degrades_when_rollout_is_missing_unreadable_or_malformed() {
    let state = build_test_state("history-rollout-degrade");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
    let malformed_path = state
        .source_paths
        .live_sessions_dir
        .join("2026/03/10/history-malformed.jsonl");
    if let Some(parent) = malformed_path.parent() {
        fs::create_dir_all(parent).expect("create malformed rollout dir");
    }
    fs::write(
        &malformed_path,
        concat!(
            "not-json\n",
            "{\"type\":\"response_item\",\"payload\":{\"type\":\"function_call\",\"call_id\":\"call-spawn\",\"name\":\"spawn_agent\",\"arguments\":\"{}\"}}\n"
        ),
    )
    .expect("write malformed rollout");
    let unreadable_path = state
        .source_paths
        .live_sessions_dir
        .join("history-unreadable");
    fs::create_dir_all(&unreadable_path).expect("create unreadable rollout dir");

    insert_thread_with_rollout(
        &connection,
        "thread-missing",
        "completed",
        1,
        Some("2026-03-10T03:00:00Z"),
        "",
    );
    insert_thread_with_rollout(
        &connection,
        "thread-unreadable",
        "completed",
        1,
        Some("2026-03-10T04:00:00Z"),
        &unreadable_path.display().to_string(),
    );
    insert_thread_with_rollout(
        &connection,
        "thread-malformed",
        "completed",
        1,
        Some("2026-03-10T05:00:00Z"),
        &malformed_path.display().to_string(),
    );

    let now = Utc
        .with_ymd_and_hms(2026, 3, 10, 12, 0, 0)
        .single()
        .expect("fixed timestamp should exist");
    let summary = build_history_summary_at(&state, now).expect("history summary should build");

    assert_eq!(summary.history.thread_count, 3);
    assert_eq!(summary.history.spawn_count, 1);
    assert_eq!(summary.history.timeout_count, 0);
    assert!(summary.health.missing_sources.is_empty());
    assert_eq!(summary.health.degraded_rollout_threads, 3);
    let missing_thread = summary
        .slow_threads
        .iter()
        .find(|thread| thread.thread_id == "thread-missing")
        .expect("missing thread should be included");
    assert_eq!(missing_thread.rollout_path, None);
}
