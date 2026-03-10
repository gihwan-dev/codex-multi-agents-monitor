use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::error::CommandError;
use crate::domain::{
    BottleneckSnapshot, HistorySummary, HistorySummaryPayload, MonitorThread, ThreadDetail,
};
use crate::domain::models::{AgentSession, ThreadStatus};
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;
use crate::state::AppState;

fn parse_timestamp(value: Option<String>) -> Option<DateTime<Utc>> {
    value.and_then(|value| {
        DateTime::parse_from_rfc3339(&value)
            .ok()
            .map(|parsed| parsed.with_timezone(&Utc))
    })
}

fn parse_status(value: &str) -> ThreadStatus {
    match value {
        "completed" => ThreadStatus::Completed,
        _ => ThreadStatus::Inflight,
    }
}

fn list_live_threads_from_db(state: &AppState) -> Result<Vec<MonitorThread>, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              title,
              cwd,
              status,
              started_at,
              updated_at,
              latest_activity_summary
            from threads
            where archived = 0
              and status = 'inflight'
            order by updated_at desc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            let status = parse_status(row.get::<_, String>(3)?.as_str());

            Ok(MonitorThread {
                thread_id: row.get(0)?,
                title: row.get(1)?,
                cwd: row.get(2)?,
                status,
                started_at: parse_timestamp(row.get(4)?),
                updated_at: parse_timestamp(row.get(5)?),
                latest_activity_summary: row.get(6)?,
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut threads = Vec::new();
    for row in rows {
        threads.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }

    Ok(threads)
}

fn get_thread_detail_from_db(
    state: &AppState,
    thread_id: &str,
) -> Result<Option<ThreadDetail>, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let thread = connection
        .query_row(
            "
            select
              thread_id,
              title,
              cwd,
              status,
              started_at,
              updated_at,
              latest_activity_summary
            from threads
            where thread_id = ?1
            ",
            params![thread_id],
            |row| {
                let status = parse_status(row.get::<_, String>(3)?.as_str());
                Ok(MonitorThread {
                    thread_id: row.get(0)?,
                    title: row.get(1)?,
                    cwd: row.get(2)?,
                    status,
                    started_at: parse_timestamp(row.get(4)?),
                    updated_at: parse_timestamp(row.get(5)?),
                    latest_activity_summary: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let Some(thread) = thread else {
        return Ok(None);
    };

    let mut statement = connection
        .prepare(
            "
            select
              session_id,
              thread_id,
              agent_role,
              agent_nickname,
              depth,
              started_at,
              updated_at
            from agent_sessions
            where thread_id = ?1
            order by depth asc, started_at asc, session_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map(params![thread_id], |row| {
            let depth = row.get::<_, i64>(4)?;
            Ok(AgentSession {
                session_id: row.get(0)?,
                thread_id: row.get(1)?,
                agent_role: row.get(2)?,
                agent_nickname: row.get(3)?,
                depth: u8::try_from(depth).unwrap_or_default(),
                started_at: parse_timestamp(row.get(5)?),
                updated_at: parse_timestamp(row.get(6)?),
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut agents = Vec::new();
    for row in rows {
        agents.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }

    Ok(Some(ThreadDetail {
        thread,
        agents,
        timeline_events: Vec::new(),
        wait_spans: Vec::new(),
        tool_spans: Vec::new(),
    }))
}

#[tauri::command]
pub fn list_live_threads(state: State<'_, AppState>) -> Result<Vec<MonitorThread>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    list_live_threads_from_db(&state)
}

#[tauri::command]
pub fn get_thread_detail(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadDetail>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    get_thread_detail_from_db(&state, &thread_id)
}

#[tauri::command]
pub fn get_history_summary(
    state: State<'_, AppState>,
) -> Result<HistorySummaryPayload, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    let generated_at = Utc::now();
    Ok(HistorySummaryPayload {
        history: HistorySummary {
            from_date: generated_at.date_naive().to_string(),
            to_date: generated_at.date_naive().to_string(),
            average_duration_ms: None,
            timeout_count: 0,
            spawn_count: 0,
        },
        bottleneck: BottleneckSnapshot {
            generated_at,
            slow_threads: Vec::new(),
            longest_wait_ms: None,
        },
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use rusqlite::{params, Connection};
    use serde_json::{json, Value};

    use crate::index_db::init_monitor_db;
    use crate::ingest::run_incremental_ingest;
    use crate::sources::SourcePaths;
    use crate::state::AppState;

    use super::{get_thread_detail_from_db, list_live_threads_from_db};

    #[test]
    fn list_live_threads_returns_only_inflight_unarchived_threads() {
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

        assert_eq!(ids, vec!["thread-live-new", "thread-live-old"]);
    }

    #[test]
    fn get_thread_detail_returns_thread_and_sorted_agents_with_empty_arrays() {
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
        assert!(detail.timeline_events.is_empty());
        assert!(detail.wait_spans.is_empty());
        assert!(detail.tool_spans.is_empty());
    }

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
        assert!(detail.agents.is_empty());
        assert!(detail.timeline_events.is_empty());
        assert!(detail.wait_spans.is_empty());
        assert!(detail.tool_spans.is_empty());
    }

    fn build_test_state(label: &str) -> AppState {
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

    fn insert_thread(
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

    fn insert_agent(
        connection: &Connection,
        session_id: &str,
        thread_id: &str,
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
                    "subagent",
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

    struct StateSeedRow<'a> {
        id: &'a str,
        rollout_path: &'a str,
        created_at: i64,
        updated_at: i64,
        source: &'a str,
        cwd: &'a str,
        title: &'a str,
        archived: i64,
        agent_role: Option<&'a str>,
        agent_nickname: Option<&'a str>,
    }

    fn seed_state_db(path: &Path, rows: &[StateSeedRow<'_>]) {
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

    fn seed_live_session(path: &Path, rows: &[Value]) {
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
}
