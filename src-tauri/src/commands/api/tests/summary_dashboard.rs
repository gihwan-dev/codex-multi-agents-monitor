use rusqlite::Connection;

use crate::domain::SummaryDashboardFilters;
use crate::domain::models::SessionStatus;
use crate::index_db::init_monitor_db;

use super::super::summary_dashboard::get_summary_dashboard_from_db;
use super::support::{
    build_test_state, insert_agent_with_role_and_times, insert_thread, insert_thread_with_rollout,
};

#[test]
fn get_summary_dashboard_applies_workspace_session_and_date_filters() {
    let state = build_test_state("summary-dashboard-filtered");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread_with_rollout(
        &connection,
        "thread-alpha",
        "completed",
        1,
        Some("2026-03-10T05:00:00Z"),
        "/rollout/alpha.jsonl",
    );
    insert_thread(
        &connection,
        "thread-beta",
        "inflight",
        0,
        Some("2026-03-10T06:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-old",
        "completed",
        1,
        Some("2026-03-08T05:00:00Z"),
    );

    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, workspace_root = ?3, latest_activity_summary = ?4 where thread_id = ?5",
            (
                "Alpha",
                "/workspace/alpha",
                "/workspace/alpha",
                Some("alpha summary"),
                "thread-alpha",
            ),
        )
        .expect("update alpha");
    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, workspace_root = ?3, latest_activity_summary = ?4 where thread_id = ?5",
            (
                "Beta",
                "/workspace/beta",
                "/workspace/beta",
                Some("beta summary"),
                "thread-beta",
            ),
        )
        .expect("update beta");

    insert_agent_with_role_and_times(
        &connection,
        "session-reviewer",
        "thread-alpha",
        "reviewer",
        1,
        Some("2026-03-10T04:00:00Z"),
        Some("2026-03-10T05:00:00Z"),
    );

    let payload = get_summary_dashboard_from_db(
        &state,
        Some(SummaryDashboardFilters {
            workspace: Some("/workspace/alpha".to_string()),
            session_id: Some("thread-alpha".to_string()),
            from_date: Some("2026-03-10".to_string()),
            to_date: Some("2026-03-10".to_string()),
        }),
    )
    .expect("summary dashboard should work");

    assert_eq!(payload.kpis.session_count, 1);
    assert_eq!(payload.kpis.active_session_count, 0);
    assert_eq!(payload.kpis.completed_session_count, 1);
    assert_eq!(payload.kpis.workspace_count, 1);
    assert_eq!(payload.workspace_distribution.len(), 1);
    assert_eq!(payload.workspace_distribution[0].workspace, "/workspace/alpha");
    assert_eq!(payload.role_mix.len(), 1);
    assert_eq!(payload.role_mix[0].agent_role, "reviewer");
    assert_eq!(payload.session_compare.len(), 1);
    assert_eq!(payload.session_compare[0].session_id, "thread-alpha");
    assert_eq!(payload.session_compare[0].workspace, "/workspace/alpha");
    assert_eq!(payload.session_compare[0].workspace_hint, None);
    assert_eq!(payload.session_compare[0].status, SessionStatus::Completed);
}

#[test]
fn get_summary_dashboard_summarizes_mixed_session_states() {
    let state = build_test_state("summary-dashboard-mixed");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(
        &connection,
        "thread-new",
        "inflight",
        0,
        Some("2026-03-10T06:00:00Z"),
    );
    insert_thread(
        &connection,
        "thread-old",
        "completed",
        1,
        Some("2026-03-10T05:00:00Z"),
    );

    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, workspace_root = ?3 where thread_id = ?4",
            ("New", "/workspace/a", "/workspace/a", "thread-new"),
        )
        .expect("update new");
    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, workspace_root = ?3 where thread_id = ?4",
            ("Old", "/workspace/b", "/workspace/b", "thread-old"),
        )
        .expect("update old");

    let payload =
        get_summary_dashboard_from_db(&state, None).expect("summary dashboard should work");

    assert_eq!(payload.kpis.session_count, 2);
    assert_eq!(payload.kpis.active_session_count, 1);
    assert_eq!(payload.kpis.completed_session_count, 1);
    assert_eq!(payload.kpis.workspace_count, 2);
    assert_eq!(
        payload
            .session_compare
            .iter()
            .map(|row| row.session_id.as_str())
            .collect::<Vec<_>>(),
        vec!["thread-new", "thread-old"]
    );
}

#[test]
fn get_summary_dashboard_groups_worktree_rows_by_workspace_root() {
    let state = build_test_state("summary-dashboard-worktree");
    init_monitor_db(&state).expect("failed to initialize monitor db");
    let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

    insert_thread(&connection, "thread-main", "completed", 0, Some("2026-03-10T05:00:00Z"));
    insert_thread(
        &connection,
        "thread-worktree",
        "completed",
        0,
        Some("2026-03-10T06:00:00Z"),
    );

    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, workspace_root = ?3 where thread_id = ?4",
            (
                "Main",
                "/repo/main",
                "/repo/main",
                "thread-main",
            ),
        )
        .expect("update main");
    connection
        .execute(
            "update threads set title = ?1, cwd = ?2, workspace_root = ?3, latest_activity_summary = ?4 where thread_id = ?5",
            (
                "Worktree",
                "/Users/example/.codex/worktrees/1234/repo",
                "/repo/main",
                Some("worktree summary"),
                "thread-worktree",
            ),
        )
        .expect("update worktree");

    let payload =
        get_summary_dashboard_from_db(&state, None).expect("summary dashboard should work");

    assert_eq!(payload.kpis.workspace_count, 1);
    assert_eq!(payload.workspace_distribution.len(), 1);
    assert_eq!(payload.workspace_distribution[0].workspace, "/repo/main");
    assert_eq!(
        payload
            .session_compare
            .iter()
            .find(|row| row.session_id == "thread-worktree")
            .and_then(|row| row.workspace_hint.clone()),
        Some("/Users/example/.codex/worktrees/1234/repo".to_string())
    );
}
