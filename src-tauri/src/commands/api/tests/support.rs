use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};
use serde_json::Value;

use crate::sources::SourcePaths;
use crate::state::AppState;

pub(super) fn build_test_state(label: &str) -> AppState {
    let root_dir = std::env::temp_dir().join(format!(
        "codex-monitor-api-tests-{label}-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be monotonic")
            .as_nanos()
    ));
    let live_sessions_dir = root_dir.join("sessions");
    let archived_sessions_dir = root_dir.join("archived_sessions");
    fs::create_dir_all(&live_sessions_dir).expect("create live sessions dir");
    fs::create_dir_all(&archived_sessions_dir).expect("create archived sessions dir");

    AppState {
        monitor_db_path: root_dir.join("monitor.db"),
        source_paths: SourcePaths {
            live_sessions_dir,
            archived_sessions_dir,
            state_db_path: root_dir.join("state_5.sqlite"),
        },
    }
}

pub(super) fn insert_thread(
    connection: &Connection,
    thread_id: &str,
    status: &str,
    archived: i64,
    updated_at: Option<&str>,
) {
    connection
        .execute(
            "
            insert into threads (
              thread_id,
              title,
              cwd,
              rollout_path,
              archived,
              source_kind,
              status,
              started_at,
              updated_at,
              latest_activity_summary
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ",
            params![
                thread_id,
                format!("title-{thread_id}"),
                "/workspace",
                "/rollout",
                archived,
                "vscode",
                status,
                Some("2026-03-10T00:00:00Z"),
                updated_at,
                Option::<String>::None,
            ],
        )
        .expect("insert thread");
}

pub(super) fn insert_agent(
    connection: &Connection,
    session_id: &str,
    thread_id: &str,
    depth: i64,
    started_at: Option<&str>,
) {
    insert_agent_with_role(connection, session_id, thread_id, "subagent", depth, started_at);
}

pub(super) fn insert_agent_with_role(
    connection: &Connection,
    session_id: &str,
    thread_id: &str,
    agent_role: &str,
    depth: i64,
    started_at: Option<&str>,
) {
    connection
        .execute(
            "
            insert into agent_sessions (
              session_id,
              thread_id,
              agent_role,
              agent_nickname,
              depth,
              started_at,
              updated_at,
              rollout_path,
              cwd
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ",
            params![
                session_id,
                thread_id,
                agent_role,
                Option::<String>::None,
                depth,
                started_at,
                started_at,
                "/rollout",
                "/workspace",
            ],
        )
        .expect("insert agent session");
}

pub(super) fn insert_timeline_event(
    connection: &Connection,
    event_id: &str,
    thread_id: &str,
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
                Option::<String>::None,
                kind,
                started_at,
                ended_at,
                summary,
            ],
        )
        .expect("insert timeline event");
}

pub(super) fn insert_wait_span(
    connection: &Connection,
    call_id: &str,
    thread_id: &str,
    parent_session_id: &str,
    child_session_id: Option<&str>,
    started_at: &str,
    ended_at: Option<&str>,
    duration_ms: Option<i64>,
) {
    connection
        .execute(
            "
            insert into wait_spans (
              call_id,
              thread_id,
              parent_session_id,
              child_session_id,
              started_at,
              ended_at,
              duration_ms
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ",
            params![
                call_id,
                thread_id,
                parent_session_id,
                child_session_id,
                started_at,
                ended_at,
                duration_ms,
            ],
        )
        .expect("insert wait span");
}

pub(super) fn insert_tool_span(
    connection: &Connection,
    call_id: &str,
    thread_id: &str,
    agent_session_id: Option<&str>,
    tool_name: &str,
    started_at: &str,
    ended_at: Option<&str>,
    duration_ms: Option<i64>,
) {
    connection
        .execute(
            "
            insert into tool_spans (
              call_id,
              thread_id,
              agent_session_id,
              tool_name,
              started_at,
              ended_at,
              duration_ms
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ",
            params![
                call_id,
                thread_id,
                agent_session_id,
                tool_name,
                started_at,
                ended_at,
                duration_ms,
            ],
        )
        .expect("insert tool span");
}

pub(super) struct StateSeedRow<'a> {
    pub id: &'a str,
    pub rollout_path: &'a str,
    pub created_at: i64,
    pub updated_at: i64,
    pub source: &'a str,
    pub cwd: &'a str,
    pub title: &'a str,
    pub archived: i64,
    pub agent_role: Option<&'a str>,
    pub agent_nickname: Option<&'a str>,
}

pub(super) fn seed_state_db(path: &Path, rows: &[StateSeedRow<'_>]) {
    let connection = Connection::open(path).expect("open state db");
    connection
        .execute_batch(
            "
            create table threads (
              id text primary key,
              rollout_path text not null,
              created_at integer not null,
              updated_at integer not null,
              source text not null,
              cwd text not null,
              title text not null,
              archived integer not null default 0,
              agent_role text,
              agent_nickname text
            );
            ",
        )
        .expect("create state threads table");

    for row in rows {
        connection
            .execute(
                "
                insert into threads (
                  id, rollout_path, created_at, updated_at, source, cwd, title, archived, agent_role, agent_nickname
                ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                ",
                params![
                    row.id,
                    row.rollout_path,
                    row.created_at,
                    row.updated_at,
                    row.source,
                    row.cwd,
                    row.title,
                    row.archived,
                    row.agent_role,
                    row.agent_nickname,
                ],
            )
            .expect("insert state thread row");
    }
}

pub(super) fn seed_live_session(path: &Path, rows: &[Value]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("create live session parent");
    }

    let mut lines = rows
        .iter()
        .map(Value::to_string)
        .collect::<Vec<_>>()
        .join("\n");
    lines.push('\n');
    fs::write(path, lines).expect("write live session");
}
