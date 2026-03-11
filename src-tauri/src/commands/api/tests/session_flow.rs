use rusqlite::{params, Connection};

use crate::domain::models::{SessionFlowItemKind, SessionLaneRef};
use crate::index_db::init_monitor_db;

use super::super::session_flow::get_session_flow_from_db;
use super::support::{
    build_test_state, insert_agent_with_role_and_rollout, insert_thread_with_rollout,
    insert_tool_span, insert_wait_span,
};

fn insert_timeline_event_with_lane(
    connection: &Connection,
    event_id: &str,
    thread_id: &str,
    agent_session_id: Option<&str>,
    kind: &str,
    started_at: &str,
    ended_at: Option<&str>,
    summary: Option<&str>,
) {
    connection
        .execute(
            "
            insert into timeline_events (
              event_id,
              thread_id,
              agent_session_id,
              kind,
              started_at,
              ended_at,
              summary
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ",
            params![
                event_id,
                thread_id,
                agent_session_id,
                kind,
                started_at,
                ended_at,
                summary,
            ],
        )
        .expect("insert timeline event with lane");
}

#[test]
fn get_session_flow_maps_lanes_and_items_from_session_read_model() {
    let state = build_test_state("session-flow-main");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread_with_rollout(
        &connection,
        "thread-main",
        "completed",
        0,
        Some("2026-03-10T02:00:09Z"),
        "/rollout/root.jsonl",
    );
    insert_agent_with_role_and_rollout(
        &connection,
        "session-child-1",
        "thread-main",
        "reviewer",
        1,
        Some("2026-03-10T02:00:03Z"),
        "/rollout/child.jsonl",
    );

    insert_timeline_event_with_lane(
        &connection,
        "event-user",
        "thread-main",
        None,
        "user_message",
        "2026-03-10T02:00:01Z",
        None,
        Some("root ask"),
    );
    insert_timeline_event_with_lane(
        &connection,
        "event-commentary-main",
        "thread-main",
        None,
        "commentary",
        "2026-03-10T02:00:02Z",
        None,
        Some("main note"),
    );
    insert_timeline_event_with_lane(
        &connection,
        "event-commentary-child",
        "thread-main",
        Some("session-child-1"),
        "commentary",
        "2026-03-10T02:00:03Z",
        None,
        Some("child note"),
    );
    insert_timeline_event_with_lane(
        &connection,
        "event-spawn",
        "thread-main",
        None,
        "spawn",
        "2026-03-10T02:00:04Z",
        None,
        Some("spawn reviewer"),
    );
    insert_wait_span(
        &connection,
        "call-wait",
        "thread-main",
        "thread-main",
        Some("session-child-1"),
        "2026-03-10T02:00:05Z",
        Some("2026-03-10T02:00:06Z"),
        Some(1_000),
    );
    insert_tool_span(
        &connection,
        "call-tool",
        "thread-main",
        Some("session-child-1"),
        "exec_command",
        "2026-03-10T02:00:07Z",
        Some("2026-03-10T02:00:08Z"),
        Some(1_000),
    );
    insert_timeline_event_with_lane(
        &connection,
        "event-final",
        "thread-main",
        None,
        "final",
        "2026-03-10T02:00:09Z",
        None,
        Some("done"),
    );

    let payload = get_session_flow_from_db(&state, "thread-main")
        .expect("get_session_flow should work")
        .expect("session flow should exist");

    assert_eq!(payload.session.session_id, "thread-main");
    assert_eq!(payload.session.workspace, "/workspace");
    assert_eq!(
        payload
            .lanes
            .iter()
            .map(|lane| (lane.lane_ref.clone(), lane.label.clone()))
            .collect::<Vec<_>>(),
        vec![
            (SessionLaneRef::User, "User".to_string()),
            (
                SessionLaneRef::Main {
                    session_id: "thread-main".to_string(),
                },
                "Main".to_string(),
            ),
            (
                SessionLaneRef::Subagent {
                    agent_session_id: "session-child-1".to_string(),
                },
                "reviewer".to_string(),
            ),
        ]
    );
    assert_eq!(
        payload
            .items
            .iter()
            .map(|item| {
                (
                    item.item_id.clone(),
                    item.lane.clone(),
                    item.kind.clone(),
                    item.summary.clone(),
                    item.target_lane.clone(),
                )
            })
            .collect::<Vec<_>>(),
        vec![
            (
                "event-user".to_string(),
                SessionLaneRef::User,
                SessionFlowItemKind::UserMessage,
                Some("root ask".to_string()),
                None,
            ),
            (
                "event-commentary-main".to_string(),
                SessionLaneRef::Main {
                    session_id: "thread-main".to_string(),
                },
                SessionFlowItemKind::Commentary,
                Some("main note".to_string()),
                None,
            ),
            (
                "event-commentary-child".to_string(),
                SessionLaneRef::Subagent {
                    agent_session_id: "session-child-1".to_string(),
                },
                SessionFlowItemKind::Commentary,
                Some("child note".to_string()),
                None,
            ),
            (
                "event-spawn".to_string(),
                SessionLaneRef::Main {
                    session_id: "thread-main".to_string(),
                },
                SessionFlowItemKind::Spawn,
                Some("spawn reviewer".to_string()),
                None,
            ),
            (
                "call-wait".to_string(),
                SessionLaneRef::Main {
                    session_id: "thread-main".to_string(),
                },
                SessionFlowItemKind::Wait,
                Some("session-child-1".to_string()),
                Some(SessionLaneRef::Subagent {
                    agent_session_id: "session-child-1".to_string(),
                }),
            ),
            (
                "call-tool".to_string(),
                SessionLaneRef::Subagent {
                    agent_session_id: "session-child-1".to_string(),
                },
                SessionFlowItemKind::ToolCall,
                Some("exec_command".to_string()),
                None,
            ),
            (
                "event-final".to_string(),
                SessionLaneRef::Main {
                    session_id: "thread-main".to_string(),
                },
                SessionFlowItemKind::FinalAnswer,
                Some("done".to_string()),
                None,
            ),
        ]
    );
}

#[test]
fn get_session_flow_returns_none_for_missing_thread() {
    let state = build_test_state("session-flow-missing");
    init_monitor_db(&state).expect("failed to initialize monitor db");

    let payload =
        get_session_flow_from_db(&state, "missing-thread").expect("get_session_flow should work");

    assert!(payload.is_none());
}
