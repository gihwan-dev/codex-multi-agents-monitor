use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde_json::Value;

use crate::index_db::open_monitor_db;
use crate::state::AppState;

const STATUS_COMPLETED: &str = "completed";
const STATUS_INFLIGHT: &str = "inflight";
const DEFAULT_SUBAGENT_ROLE: &str = "subagent";

#[derive(Debug, Clone, PartialEq, Eq)]
struct ThreadOverviewRow {
    thread_id: String,
    title: String,
    cwd: String,
    status: String,
    started_at: Option<String>,
    updated_at: Option<String>,
    latest_activity_summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct StateRootThreadRow {
    thread_id: String,
    title: String,
    cwd: String,
    rollout_path: String,
    archived: i64,
    source_kind: String,
    started_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AgentSessionRow {
    session_id: String,
    thread_id: String,
    agent_role: String,
    agent_nickname: Option<String>,
    depth: u8,
    started_at: Option<String>,
    updated_at: Option<String>,
    rollout_path: String,
    cwd: String,
}

#[derive(Debug)]
enum SourceClassification {
    Root { source_kind: String },
    Subagent(SpawnMetadata),
}

#[derive(Debug)]
struct SpawnMetadata {
    parent_thread_id: String,
    depth: u8,
    agent_role: Option<String>,
    agent_nickname: Option<String>,
}

#[derive(Debug, Default)]
struct SessionAccumulator {
    saw_session_meta: bool,
    is_main_thread: bool,
    thread_id: Option<String>,
    cwd: Option<String>,
    started_at: Option<String>,
    updated_at: Option<String>,
    has_task_complete: bool,
    title: Option<String>,
    last_agent_message: Option<String>,
    task_complete_last_agent_message: Option<String>,
    last_user_message: Option<String>,
    last_function_call_name: Option<String>,
}

impl SessionAccumulator {
    fn consume_line(&mut self, line: &str) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }

        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            return;
        };

        self.consume_value(&value);
    }

    fn consume_value(&mut self, value: &Value) {
        let timestamp = value
            .get("timestamp")
            .and_then(Value::as_str)
            .map(str::to_string);
        if self.started_at.is_none() {
            self.started_at = timestamp.clone();
        }
        if timestamp.is_some() {
            self.updated_at = timestamp;
        }

        match value.get("type").and_then(Value::as_str) {
            Some("session_meta") => self.consume_session_meta(value.get("payload")),
            Some("event_msg") => self.consume_event_msg(value.get("payload")),
            Some("response_item") => self.consume_response_item(value.get("payload")),
            _ => {}
        }
    }

    fn consume_session_meta(&mut self, payload: Option<&Value>) {
        let Some(payload) = payload else {
            return;
        };

        self.saw_session_meta = true;

        if let Some(thread_id) = payload.get("id").and_then(Value::as_str) {
            self.thread_id = Some(thread_id.to_string());
        }

        if let Some(cwd) = payload.get("cwd").and_then(Value::as_str) {
            self.cwd = Some(cwd.to_string());
        }

        if let Some(started_at) = payload.get("timestamp").and_then(Value::as_str) {
            let started_at = started_at.to_string();
            self.started_at = Some(started_at.clone());
            if self.updated_at.is_none() {
                self.updated_at = Some(started_at);
            }
        }

        let source = payload.get("source");
        let source_is_vscode = source.and_then(Value::as_str) == Some("vscode");
        let has_subagent_spawn = source
            .and_then(|value| value.get("subagent"))
            .and_then(|value| value.get("thread_spawn"))
            .is_some();

        self.is_main_thread = source_is_vscode || !has_subagent_spawn;
    }

    fn consume_event_msg(&mut self, payload: Option<&Value>) {
        let Some(payload) = payload else {
            return;
        };

        match payload.get("type").and_then(Value::as_str) {
            Some("user_message") => {
                let Some(message) = payload.get("message").and_then(Value::as_str) else {
                    return;
                };

                if self.title.is_none() {
                    if let Some(first_line) = message.lines().next().map(str::trim) {
                        if !first_line.is_empty() {
                            self.title = Some(first_line.to_string());
                        }
                    }
                }

                if let Some(message) = normalize_text(message) {
                    self.last_user_message = Some(message);
                }
            }
            Some("agent_message") => {
                if let Some(message) = payload
                    .get("message")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                {
                    self.last_agent_message = Some(message);
                }
            }
            Some("task_complete") => {
                self.has_task_complete = true;
                if let Some(message) = payload
                    .get("last_agent_message")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                {
                    self.task_complete_last_agent_message = Some(message);
                }
            }
            _ => {}
        }
    }

    fn consume_response_item(&mut self, payload: Option<&Value>) {
        let Some(payload) = payload else {
            return;
        };

        let is_function_call = payload.get("type").and_then(Value::as_str) == Some("function_call");
        if !is_function_call {
            return;
        }

        if let Some(function_name) = payload
            .get("name")
            .and_then(Value::as_str)
            .and_then(normalize_text)
        {
            self.last_function_call_name = Some(function_name);
        }
    }

    fn finish(self) -> Option<ThreadOverviewRow> {
        if !self.saw_session_meta || !self.is_main_thread {
            return None;
        }

        let thread_id = self.thread_id?;
        let title = self.title.unwrap_or_else(|| thread_id.clone());
        let latest_activity_summary = self
            .last_agent_message
            .or(self.task_complete_last_agent_message)
            .or(self.last_user_message)
            .or(self.last_function_call_name);
        let status = if self.has_task_complete {
            STATUS_COMPLETED
        } else {
            STATUS_INFLIGHT
        };

        Some(ThreadOverviewRow {
            thread_id,
            title,
            cwd: self.cwd.unwrap_or_default(),
            status: status.to_string(),
            started_at: self.started_at,
            updated_at: self.updated_at,
            latest_activity_summary,
        })
    }
}

fn normalize_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn collect_live_session_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(error).with_context(|| format!("failed to read {}", dir.display()));
        }
    };

    for entry in entries {
        let entry = entry.with_context(|| format!("failed to read entry in {}", dir.display()))?;
        let path = entry.path();
        if path.is_dir() {
            collect_live_session_files(&path, files)?;
            continue;
        }

        if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }

    Ok(())
}

fn parse_live_session_file(path: &Path) -> Result<Option<ThreadOverviewRow>> {
    let file = File::open(path)
        .with_context(|| format!("failed to open live session file {}", path.display()))?;
    let reader = BufReader::new(file);
    let mut accumulator = SessionAccumulator {
        is_main_thread: true,
        ..SessionAccumulator::default()
    };

    for line in reader.lines() {
        let line = line.with_context(|| format!("failed to read line from {}", path.display()))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        accumulator.consume_value(&value);

        // Slice 2B: 서브에이전트 세션은 session_meta만 보고 즉시 중단해 본문을 읽지 않는다.
        if accumulator.saw_session_meta && !accumulator.is_main_thread {
            return Ok(None);
        }
    }

    Ok(accumulator.finish())
}

pub fn run_incremental_ingest(state: &AppState) -> Result<()> {
    let (state_roots, state_agent_sessions) = load_state_snapshot(state)?;
    let mut session_files = Vec::new();
    collect_live_session_files(&state.source_paths.live_sessions_dir, &mut session_files)?;
    session_files.sort();
    let mut live_roots = Vec::new();
    for session_file in &session_files {
        let Some(thread) = parse_live_session_file(session_file)? else {
            continue;
        };
        live_roots.push(thread);
    }

    let mut connection = open_monitor_db(state)?;
    let tx = connection
        .transaction()
        .context("failed to open live ingest transaction")?;

    tx.execute("delete from agent_sessions", [])
        .context("failed to clear agent_sessions before snapshot ingest")?;
    tx.execute("delete from threads", [])
        .context("failed to clear threads before snapshot ingest")?;

    for root in state_roots {
        tx.execute(
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
                root.thread_id,
                root.title,
                root.cwd,
                root.rollout_path,
                root.archived,
                root.source_kind,
                STATUS_COMPLETED,
                root.started_at,
                root.updated_at,
                Option::<String>::None,
            ],
        )
        .context("failed to insert root thread from state snapshot")?;
    }

    for session in state_agent_sessions {
        tx.execute(
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
                session.session_id,
                session.thread_id,
                session.agent_role,
                session.agent_nickname,
                i64::from(session.depth),
                session.started_at,
                session.updated_at,
                session.rollout_path,
                session.cwd,
            ],
        )
        .context("failed to insert agent session from state snapshot")?;
    }

    for thread in live_roots {
        tx.execute(
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
            on conflict(thread_id) do update set
              title = excluded.title,
              cwd = excluded.cwd,
              archived = 0,
              status = excluded.status,
              started_at = excluded.started_at,
              updated_at = excluded.updated_at,
              latest_activity_summary = excluded.latest_activity_summary
            ",
            params![
                thread.thread_id,
                thread.title,
                thread.cwd,
                "",
                0_i64,
                "live_session",
                thread.status,
                thread.started_at,
                thread.updated_at,
                thread.latest_activity_summary,
            ],
        )
        .context("failed to upsert live root thread enrichment")?;
    }

    tx.commit().context("failed to commit live ingest transaction")?;
    Ok(())
}

fn load_state_snapshot(state: &AppState) -> Result<(Vec<StateRootThreadRow>, Vec<AgentSessionRow>)> {
    let state_connection = Connection::open(&state.source_paths.state_db_path).with_context(|| {
        format!(
            "failed to open state db at {}",
            state.source_paths.state_db_path.display()
        )
    })?;

    let mut statement = state_connection
        .prepare(
            "
            select
              id,
              rollout_path,
              created_at,
              updated_at,
              source,
              cwd,
              title,
              archived,
              agent_role,
              agent_nickname
            from threads
            ",
        )
        .context("failed to query state threads snapshot")?;

    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<String>>(9)?,
        ))
    })?;

    let mut roots = Vec::new();
    let mut sessions = Vec::new();

    for row in rows {
        let (
            session_or_thread_id,
            rollout_path,
            created_at,
            updated_at,
            source,
            cwd,
            title,
            archived,
            row_agent_role,
            row_agent_nickname,
        ) = row.context("failed to decode state thread row")?;
        let started_at = epoch_to_rfc3339_utc(created_at);
        let updated_at = epoch_to_rfc3339_utc(updated_at);

        match classify_state_source(&source) {
            SourceClassification::Root { source_kind } => roots.push(StateRootThreadRow {
                thread_id: session_or_thread_id.clone(),
                title: normalize_text(&title).unwrap_or(session_or_thread_id),
                cwd,
                rollout_path,
                archived,
                source_kind,
                started_at,
                updated_at,
            }),
            SourceClassification::Subagent(metadata) => {
                let agent_role = normalize_optional_text(row_agent_role)
                    .or(metadata.agent_role)
                    .unwrap_or_else(|| DEFAULT_SUBAGENT_ROLE.to_string());
                let agent_nickname =
                    normalize_optional_text(row_agent_nickname).or(metadata.agent_nickname);

                sessions.push(AgentSessionRow {
                    session_id: session_or_thread_id,
                    thread_id: metadata.parent_thread_id,
                    agent_role,
                    agent_nickname,
                    depth: metadata.depth,
                    started_at,
                    updated_at,
                    rollout_path,
                    cwd,
                });
            }
        }
    }

    Ok((roots, sessions))
}

fn classify_state_source(source: &str) -> SourceClassification {
    match serde_json::from_str::<Value>(source) {
        Ok(parsed) => {
            if let Some(metadata) = parse_spawn_metadata(&parsed) {
                return SourceClassification::Subagent(metadata);
            }

            let source_kind = match &parsed {
                Value::String(value) => normalize_text(value).unwrap_or_else(|| "json".to_string()),
                Value::Object(map) => map
                    .get("kind")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                    .or_else(|| {
                        map.get("source")
                            .and_then(Value::as_str)
                            .and_then(normalize_text)
                    })
                    .unwrap_or_else(|| "json".to_string()),
                _ => "json".to_string(),
            };

            SourceClassification::Root { source_kind }
        }
        Err(_) => SourceClassification::Root {
            source_kind: normalize_text(source).unwrap_or_else(|| "unknown".to_string()),
        },
    }
}

fn parse_spawn_metadata(source: &Value) -> Option<SpawnMetadata> {
    let spawn = source.get("subagent")?.get("thread_spawn")?;
    let parent_thread_id = spawn
        .get("parent_thread_id")
        .and_then(Value::as_str)
        .and_then(normalize_text)?;
    let depth = spawn
        .get("depth")
        .and_then(Value::as_u64)
        .map(|value| value.min(u8::MAX as u64) as u8)
        .unwrap_or(0);
    let agent_role = spawn
        .get("agent_role")
        .and_then(Value::as_str)
        .and_then(normalize_text);
    let agent_nickname = spawn
        .get("agent_nickname")
        .and_then(Value::as_str)
        .and_then(normalize_text);

    Some(SpawnMetadata {
        parent_thread_id,
        depth,
        agent_role,
        agent_nickname,
    })
}

fn epoch_to_rfc3339_utc(value: i64) -> Option<String> {
    let (seconds, nanos) = if value.abs() >= 10_000_000_000 {
        let seconds = value / 1000;
        let millis = value.rem_euclid(1000) as u32;
        (seconds, millis * 1_000_000)
    } else {
        (value, 0)
    };

    DateTime::<Utc>::from_timestamp(seconds, nanos)
        .map(|timestamp| timestamp.to_rfc3339_opts(SecondsFormat::Secs, true))
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| normalize_text(&value))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use rusqlite::{params, Connection};
    use serde_json::{json, Value};

    use crate::index_db::init_monitor_db;
    use crate::sources::SourcePaths;
    use crate::state::AppState;

    use super::{run_incremental_ingest, SessionAccumulator};

    #[test]
    fn parses_main_thread_overview_fields() {
        let lines = [
            json!({
                "timestamp": "2026-03-10T01:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-main-1",
                    "timestamp": "2026-03-10T01:00:00Z",
                    "cwd": "/workspace/repo",
                    "source": "vscode"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "  First user line  \nsecond line"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:02Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "name": "exec_command"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:03Z",
                "type": "event_msg",
                "payload": {
                    "type": "task_complete",
                    "last_agent_message": "task complete summary"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:04Z",
                "type": "event_msg",
                "payload": {
                    "type": "agent_message",
                    "message": "latest agent summary"
                }
            })
            .to_string(),
        ];

        let mut accumulator = SessionAccumulator {
            is_main_thread: true,
            ..SessionAccumulator::default()
        };
        for line in lines {
            accumulator.consume_line(&line);
        }
        let parsed = accumulator.finish().expect("main thread should be parsed");

        assert_eq!(parsed.thread_id, "thread-main-1");
        assert_eq!(parsed.title, "First user line");
        assert_eq!(parsed.status, "completed");
        assert_eq!(
            parsed.latest_activity_summary.as_deref(),
            Some("latest agent summary")
        );
    }

    #[test]
    fn skips_subagent_session_from_spawn_metadata() {
        let lines = [
            json!({
                "timestamp": "2026-03-10T01:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-subagent-1",
                    "cwd": "/workspace/repo",
                    "source": {
                        "subagent": {
                            "thread_spawn": {
                                "parent_thread_id": "thread-main-1"
                            }
                        }
                    }
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "child session message"
                }
            })
            .to_string(),
        ];

        let mut accumulator = SessionAccumulator {
            is_main_thread: true,
            ..SessionAccumulator::default()
        };
        for line in lines {
            accumulator.consume_line(&line);
        }

        assert!(accumulator.finish().is_none());
    }

    #[test]
    fn stores_state_snapshot_and_live_enrichment_with_agent_sessions() {
        let test_state = build_test_state("snapshot-live");
        seed_state_db(
            &test_state.source_paths.state_db_path,
            &[
                StateSeedRow {
                    id: "thread-root-1",
                    rollout_path: "/rollout/root",
                    created_at: 1_778_000_000,
                    updated_at: 1_778_000_100,
                    source: "vscode",
                    cwd: "/workspace/state-root",
                    title: "State Root Title",
                    archived: 0,
                    agent_role: None,
                    agent_nickname: None,
                },
                StateSeedRow {
                    id: "thread-sub-1",
                    rollout_path: "/rollout/sub",
                    created_at: 1_778_000_010,
                    updated_at: 1_778_000_090,
                    source: r#"{"subagent":{"thread_spawn":{"parent_thread_id":"thread-root-1","depth":2,"agent_role":"spawn-role","agent_nickname":"spawn-nick"}}}"#,
                    cwd: "/workspace/subagent",
                    title: "State Sub Title",
                    archived: 0,
                    agent_role: Some("top-role"),
                    agent_nickname: None,
                },
            ],
        );
        seed_live_session(
            &test_state.source_paths.live_sessions_dir.join("2026/03/10/thread-root-1.jsonl"),
            &[
                json!({
                    "timestamp": "2026-03-10T01:00:00Z",
                    "type": "session_meta",
                    "payload": {
                        "id": "thread-root-1",
                        "timestamp": "2026-03-10T01:00:00Z",
                        "cwd": "/workspace/live-root",
                        "source": "vscode"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T01:00:01Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "user_message",
                        "message": "Live Root Title\nfollow-up"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T01:00:02Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "agent_message",
                        "message": "latest live summary"
                    }
                }),
            ],
        );

        init_monitor_db(&test_state).expect("failed to initialize monitor db");
        run_incremental_ingest(&test_state).expect("ingest should succeed");

        let monitor = Connection::open(&test_state.monitor_db_path).expect("open monitor db");

        let root = monitor
            .query_row(
                "
                select title, cwd, status, rollout_path, archived, source_kind, latest_activity_summary
                from threads
                where thread_id = ?1
                ",
                params!["thread-root-1"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, Option<String>>(6)?,
                    ))
                },
            )
            .expect("root thread should exist");
        assert_eq!(root.0, "Live Root Title");
        assert_eq!(root.1, "/workspace/live-root");
        assert_eq!(root.2, "inflight");
        assert_eq!(root.3, "/rollout/root");
        assert_eq!(root.4, 0);
        assert_eq!(root.5, "vscode");
        assert_eq!(root.6.as_deref(), Some("latest live summary"));

        let agent = monitor
            .query_row(
                "
                select thread_id, agent_role, agent_nickname, depth, rollout_path, cwd
                from agent_sessions
                where session_id = ?1
                ",
                params!["thread-sub-1"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                },
            )
            .expect("agent session should exist");
        assert_eq!(agent.0, "thread-root-1");
        assert_eq!(agent.1, "top-role");
        assert_eq!(agent.2.as_deref(), Some("spawn-nick"));
        assert_eq!(agent.3, 2);
        assert_eq!(agent.4, "/rollout/sub");
        assert_eq!(agent.5, "/workspace/subagent");
    }

    #[test]
    fn mixed_literal_and_json_sources_are_parsed_without_failure() {
        let test_state = build_test_state("mixed-source");
        seed_state_db(
            &test_state.source_paths.state_db_path,
            &[
                StateSeedRow {
                    id: "thread-vscode",
                    rollout_path: "/rollout/vscode",
                    created_at: 1_778_100_000,
                    updated_at: 1_778_100_100,
                    source: "vscode",
                    cwd: "/workspace/vscode",
                    title: "VSCode Thread",
                    archived: 0,
                    agent_role: None,
                    agent_nickname: None,
                },
                StateSeedRow {
                    id: "thread-cli",
                    rollout_path: "/rollout/cli",
                    created_at: 1_778_100_200,
                    updated_at: 1_778_100_300,
                    source: "cli",
                    cwd: "/workspace/cli",
                    title: "CLI Thread",
                    archived: 0,
                    agent_role: None,
                    agent_nickname: None,
                },
                StateSeedRow {
                    id: "thread-sub",
                    rollout_path: "/rollout/sub",
                    created_at: 1_778_100_210,
                    updated_at: 1_778_100_320,
                    source: r#"{"subagent":{"thread_spawn":{"parent_thread_id":"thread-cli","depth":1,"agent_role":"spawn-role","agent_nickname":"spawn-nick"}}}"#,
                    cwd: "/workspace/sub",
                    title: "Sub Thread",
                    archived: 0,
                    agent_role: None,
                    agent_nickname: None,
                },
            ],
        );

        init_monitor_db(&test_state).expect("failed to initialize monitor db");
        run_incremental_ingest(&test_state).expect("ingest should succeed for mixed sources");

        let monitor = Connection::open(&test_state.monitor_db_path).expect("open monitor db");
        let root_count: i64 = monitor
            .query_row("select count(*) from threads", [], |row| row.get(0))
            .expect("count roots");
        let agent_count: i64 = monitor
            .query_row("select count(*) from agent_sessions", [], |row| row.get(0))
            .expect("count sessions");

        assert_eq!(root_count, 2);
        assert_eq!(agent_count, 1);

        let cli_kind: String = monitor
            .query_row(
                "select source_kind from threads where thread_id = ?1",
                params!["thread-cli"],
                |row| row.get(0),
            )
            .expect("cli root should be present");
        assert_eq!(cli_kind, "cli");
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

    fn build_test_state(label: &str) -> AppState {
        let root_dir = std::env::temp_dir().join(format!(
            "codex-monitor-ingest-tests-{label}-{}-{}",
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
                .expect("insert state row");
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
        fs::write(path, lines).expect("write live session fixture");
    }
}
