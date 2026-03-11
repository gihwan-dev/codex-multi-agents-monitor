use std::collections::BTreeMap;
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
const SOURCE_KEY_STATE_DB: &str = "state_db";
const SOURCE_STATUS_MISSING: &str = "missing";
const SOURCE_STATUS_DEGRADED: &str = "degraded";

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
struct TimelineEventRow {
    event_id: String,
    thread_id: String,
    agent_session_id: Option<String>,
    kind: String,
    started_at: String,
    ended_at: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WaitSpanRow {
    call_id: String,
    thread_id: String,
    parent_session_id: String,
    child_session_id: Option<String>,
    started_at: String,
    ended_at: Option<String>,
    duration_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ToolSpanRow {
    call_id: String,
    thread_id: String,
    agent_session_id: Option<String>,
    tool_name: String,
    started_at: String,
    ended_at: Option<String>,
    duration_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LiveRootThreadRow {
    overview: ThreadOverviewRow,
    timeline_events: Vec<TimelineEventRow>,
    wait_spans: Vec<WaitSpanRow>,
    tool_spans: Vec<ToolSpanRow>,
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct SourceHealthRow {
    source_key: &'static str,
    status: &'static str,
}

#[derive(Debug, Default)]
struct StateSnapshot {
    roots: Vec<StateRootThreadRow>,
    agent_sessions: Vec<AgentSessionRow>,
    source_health: Vec<SourceHealthRow>,
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

#[derive(Debug, Clone)]
struct MessageEventSeed {
    started_at: String,
    kind: String,
    summary: Option<String>,
}

#[derive(Debug, Clone)]
struct FunctionCallOutputRecord {
    ended_at: String,
    output: Option<Value>,
}

#[derive(Debug, Default, Clone)]
struct FunctionCallRecord {
    name: Option<String>,
    started_at: Option<String>,
    arguments: Option<Value>,
    output: Option<FunctionCallOutputRecord>,
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
    message_events: Vec<MessageEventSeed>,
    task_complete_final_marker: Option<MessageEventSeed>,
    has_final_marker: bool,
    function_calls: BTreeMap<String, FunctionCallRecord>,
}

impl SessionAccumulator {
    #[cfg(test)]
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
            self.updated_at = timestamp.clone();
        }

        match value.get("type").and_then(Value::as_str) {
            Some("session_meta") => self.consume_session_meta(value.get("payload")),
            Some("event_msg") => self.consume_event_msg(value.get("payload"), timestamp.as_deref()),
            Some("response_item") => {
                self.consume_response_item(value.get("payload"), timestamp.as_deref())
            }
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

    fn consume_event_msg(&mut self, payload: Option<&Value>, timestamp: Option<&str>) {
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
                let message = payload
                    .get("message")
                    .and_then(Value::as_str)
                    .and_then(normalize_text);
                if let Some(message) = message.clone() {
                    self.last_agent_message = Some(message);
                }

                match payload.get("phase").and_then(Value::as_str) {
                    Some("commentary") => {
                        self.push_message_event(timestamp, "commentary", message);
                    }
                    Some("final_answer") => {
                        self.has_final_marker = true;
                        self.push_message_event(timestamp, "final", message);
                    }
                    _ => {}
                }
            }
            Some("task_complete") => {
                self.has_task_complete = true;
                let message = payload
                    .get("last_agent_message")
                    .and_then(Value::as_str)
                    .and_then(normalize_text);

                if let Some(message) = message.clone() {
                    self.task_complete_last_agent_message = Some(message);
                }

                if let (Some(timestamp), Some(summary)) = (timestamp, message) {
                    self.task_complete_final_marker = Some(MessageEventSeed {
                        started_at: timestamp.to_string(),
                        kind: "final".to_string(),
                        summary: Some(summary),
                    });
                }
            }
            _ => {}
        }
    }

    fn consume_response_item(&mut self, payload: Option<&Value>, timestamp: Option<&str>) {
        let Some(payload) = payload else {
            return;
        };

        match payload.get("type").and_then(Value::as_str) {
            Some("function_call") => {
                let call_id = payload
                    .get("call_id")
                    .and_then(Value::as_str)
                    .and_then(normalize_text);
                let function_name = payload
                    .get("name")
                    .and_then(Value::as_str)
                    .and_then(normalize_text);

                if let Some(function_name) = function_name.clone() {
                    self.last_function_call_name = Some(function_name);
                }

                let (Some(call_id), Some(started_at)) = (call_id, timestamp) else {
                    return;
                };

                let record = self.function_calls.entry(call_id).or_default();
                record.name = function_name;
                record.started_at = Some(started_at.to_string());
                record.arguments = parse_embedded_json(payload.get("arguments"));
            }
            Some("function_call_output") => {
                let (Some(call_id), Some(ended_at)) = (
                    payload
                        .get("call_id")
                        .and_then(Value::as_str)
                        .and_then(normalize_text),
                    timestamp,
                ) else {
                    return;
                };

                let record = self.function_calls.entry(call_id).or_default();
                record.output = Some(FunctionCallOutputRecord {
                    ended_at: ended_at.to_string(),
                    output: parse_embedded_json(payload.get("output")),
                });
            }
            _ => {}
        }
    }

    fn finish(self) -> Option<LiveRootThreadRow> {
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

        let overview = ThreadOverviewRow {
            thread_id: thread_id.clone(),
            title,
            cwd: self.cwd.unwrap_or_default(),
            status: status.to_string(),
            started_at: self.started_at,
            updated_at: self.updated_at,
            latest_activity_summary,
        };

        let mut message_events = self.message_events;
        if !self.has_final_marker {
            if let Some(marker) = self.task_complete_final_marker {
                message_events.push(marker);
            }
        }

        let mut timeline_events = build_message_timeline_rows(&thread_id, message_events);
        let (mut function_timeline_events, mut wait_spans, mut tool_spans) =
            build_function_call_rows(&thread_id, self.function_calls);
        timeline_events.append(&mut function_timeline_events);
        timeline_events.sort_by(|left, right| {
            left.started_at
                .cmp(&right.started_at)
                .then_with(|| left.event_id.cmp(&right.event_id))
        });
        wait_spans.sort_by(|left, right| {
            left.started_at
                .cmp(&right.started_at)
                .then_with(|| left.call_id.cmp(&right.call_id))
        });
        tool_spans.sort_by(|left, right| {
            left.started_at
                .cmp(&right.started_at)
                .then_with(|| left.call_id.cmp(&right.call_id))
        });

        Some(LiveRootThreadRow {
            overview,
            timeline_events,
            wait_spans,
            tool_spans,
        })
    }

    fn push_message_event(&mut self, timestamp: Option<&str>, kind: &str, summary: Option<String>) {
        let Some(timestamp) = timestamp else {
            return;
        };

        self.message_events.push(MessageEventSeed {
            started_at: timestamp.to_string(),
            kind: kind.to_string(),
            summary,
        });
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

fn parse_embedded_json(value: Option<&Value>) -> Option<Value> {
    let value = value?;
    match value {
        Value::String(raw) => {
            let raw = raw.trim();
            if raw.is_empty() {
                None
            } else {
                serde_json::from_str(raw).ok()
            }
        }
        Value::Null => None,
        other => Some(other.clone()),
    }
}

fn build_message_timeline_rows(
    thread_id: &str,
    message_events: Vec<MessageEventSeed>,
) -> Vec<TimelineEventRow> {
    let mut ordinals = BTreeMap::<String, usize>::new();
    let mut rows = Vec::with_capacity(message_events.len());

    for event in message_events {
        let ordinal = ordinals.entry(event.started_at.clone()).or_default();
        let event_id = format!("{thread_id}:{}:{:04}", event.started_at, *ordinal);
        *ordinal += 1;

        rows.push(TimelineEventRow {
            event_id,
            thread_id: thread_id.to_string(),
            agent_session_id: None,
            kind: event.kind,
            started_at: event.started_at,
            ended_at: None,
            summary: event.summary,
        });
    }

    rows
}

fn build_function_call_rows(
    thread_id: &str,
    function_calls: BTreeMap<String, FunctionCallRecord>,
) -> (Vec<TimelineEventRow>, Vec<WaitSpanRow>, Vec<ToolSpanRow>) {
    let mut timeline_events = Vec::new();
    let mut wait_spans = Vec::new();
    let mut tool_spans = Vec::new();

    for (call_id, record) in function_calls {
        let FunctionCallRecord {
            name,
            started_at,
            arguments,
            output,
        } = record;
        let (Some(name), Some(started_at)) = (name, started_at) else {
            continue;
        };

        let ended_at = output.as_ref().map(|output| output.ended_at.clone());
        let duration_ms = ended_at
            .as_deref()
            .and_then(|ended_at| duration_ms_between(&started_at, ended_at));
        let output = output.as_ref().and_then(|value| value.output.as_ref());

        match name.as_str() {
            "spawn_agent" => timeline_events.push(TimelineEventRow {
                event_id: call_id,
                thread_id: thread_id.to_string(),
                agent_session_id: None,
                kind: "spawn".to_string(),
                started_at,
                ended_at,
                summary: spawn_summary(arguments.as_ref(), output),
            }),
            "wait" => {
                let child_session_id = resolve_wait_child_session_id(arguments.as_ref(), output);
                timeline_events.push(TimelineEventRow {
                    event_id: call_id.clone(),
                    thread_id: thread_id.to_string(),
                    agent_session_id: None,
                    kind: "wait".to_string(),
                    started_at: started_at.clone(),
                    ended_at: ended_at.clone(),
                    summary: child_session_id.clone(),
                });
                wait_spans.push(WaitSpanRow {
                    call_id,
                    thread_id: thread_id.to_string(),
                    parent_session_id: thread_id.to_string(),
                    child_session_id,
                    started_at,
                    ended_at,
                    duration_ms,
                });
            }
            _ => {
                timeline_events.push(TimelineEventRow {
                    event_id: call_id.clone(),
                    thread_id: thread_id.to_string(),
                    agent_session_id: None,
                    kind: "tool".to_string(),
                    started_at: started_at.clone(),
                    ended_at: ended_at.clone(),
                    summary: Some(name.clone()),
                });
                tool_spans.push(ToolSpanRow {
                    call_id,
                    thread_id: thread_id.to_string(),
                    agent_session_id: None,
                    tool_name: name,
                    started_at,
                    ended_at,
                    duration_ms,
                });
            }
        }
    }

    (timeline_events, wait_spans, tool_spans)
}

fn spawn_summary(arguments: Option<&Value>, output: Option<&Value>) -> Option<String> {
    output
        .and_then(|value| value.get("nickname"))
        .and_then(Value::as_str)
        .and_then(normalize_text)
        .or_else(|| {
            arguments
                .and_then(|value| value.get("agent_type"))
                .and_then(Value::as_str)
                .and_then(normalize_text)
        })
}

fn resolve_wait_child_session_id(arguments: Option<&Value>, output: Option<&Value>) -> Option<String> {
    let argument_ids = arguments
        .and_then(|value| value.get("ids"))
        .and_then(Value::as_array)
        .map(|ids| {
            ids.iter()
                .filter_map(Value::as_str)
                .filter_map(normalize_text)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if argument_ids.len() == 1 {
        return argument_ids.into_iter().next();
    }

    let completed_ids = output
        .and_then(|value| value.get("status"))
        .and_then(Value::as_object)
        .map(|status| {
            status
                .iter()
                .filter_map(|(session_id, value)| {
                    if value.get("completed").is_some() {
                        normalize_text(session_id)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if completed_ids.len() == 1 {
        completed_ids.into_iter().next()
    } else {
        None
    }
}

fn duration_ms_between(started_at: &str, ended_at: &str) -> Option<u64> {
    let started_at = DateTime::parse_from_rfc3339(started_at).ok()?;
    let ended_at = DateTime::parse_from_rfc3339(ended_at).ok()?;
    let duration = ended_at.signed_duration_since(started_at).to_std().ok()?;
    u64::try_from(duration.as_millis()).ok()
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

fn parse_live_session_file(path: &Path) -> Result<Option<LiveRootThreadRow>> {
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
    let StateSnapshot {
        roots: state_roots,
        agent_sessions: state_agent_sessions,
        source_health,
    } = load_state_snapshot(state)?;
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
    tx.execute("delete from timeline_events", [])
        .context("failed to clear timeline_events before snapshot ingest")?;
    tx.execute("delete from wait_spans", [])
        .context("failed to clear wait_spans before snapshot ingest")?;
    tx.execute("delete from tool_spans", [])
        .context("failed to clear tool_spans before snapshot ingest")?;
    tx.execute("delete from ingest_source_health", [])
        .context("failed to clear ingest_source_health before snapshot ingest")?;

    for source_health_row in source_health {
        tx.execute(
            "
            insert into ingest_source_health (
              source_key,
              status
            ) values (?1, ?2)
            ",
            params![source_health_row.source_key, source_health_row.status],
        )
        .context("failed to persist ingest source health")?;
    }

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
        let LiveRootThreadRow {
            overview,
            timeline_events,
            wait_spans,
            tool_spans,
        } = thread;
        let ThreadOverviewRow {
            thread_id,
            title,
            cwd,
            status,
            started_at,
            updated_at,
            latest_activity_summary,
        } = overview;

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
                thread_id,
                title,
                cwd,
                "",
                0_i64,
                "live_session",
                status,
                started_at,
                updated_at,
                latest_activity_summary,
            ],
        )
        .context("failed to upsert live root thread enrichment")?;

        for event in timeline_events {
            tx.execute(
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
                    event.event_id,
                    event.thread_id,
                    event.agent_session_id,
                    event.kind,
                    event.started_at,
                    event.ended_at,
                    event.summary,
                ],
            )
            .context("failed to insert timeline event from live session")?;
        }

        for span in wait_spans {
            tx.execute(
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
                    span.call_id,
                    span.thread_id,
                    span.parent_session_id,
                    span.child_session_id,
                    span.started_at,
                    span.ended_at,
                    span.duration_ms.map(|value| value as i64),
                ],
            )
            .context("failed to insert wait span from live session")?;
        }

        for span in tool_spans {
            tx.execute(
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
                    span.call_id,
                    span.thread_id,
                    span.agent_session_id,
                    span.tool_name,
                    span.started_at,
                    span.ended_at,
                    span.duration_ms.map(|value| value as i64),
                ],
            )
            .context("failed to insert tool span from live session")?;
        }
    }

    tx.commit().context("failed to commit live ingest transaction")?;
    Ok(())
}

fn load_state_snapshot(state: &AppState) -> Result<StateSnapshot> {
    if !state.source_paths.state_db_path.is_file() {
        return Ok(StateSnapshot {
            source_health: vec![missing_state_db_health()],
            ..StateSnapshot::default()
        });
    }

    let state_connection = match Connection::open_with_flags(
        &state.source_paths.state_db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) {
        Ok(connection) => connection,
        Err(_) => return Ok(degraded_state_snapshot()),
    };

    let mut statement = match state_connection.prepare(
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
    ) {
        Ok(statement) => statement,
        Err(_) => return Ok(degraded_state_snapshot()),
    };

    let rows = match statement.query_map([], |row| {
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
    }) {
        Ok(rows) => rows,
        Err(_) => return Ok(degraded_state_snapshot()),
    };

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
        ) = match row {
            Ok(row) => row,
            Err(_) => return Ok(degraded_state_snapshot()),
        };
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

    Ok(StateSnapshot {
        roots,
        agent_sessions: sessions,
        source_health: Vec::new(),
    })
}

fn missing_state_db_health() -> SourceHealthRow {
    SourceHealthRow {
        source_key: SOURCE_KEY_STATE_DB,
        status: SOURCE_STATUS_MISSING,
    }
}

fn degraded_state_snapshot() -> StateSnapshot {
    StateSnapshot {
        source_health: vec![SourceHealthRow {
            source_key: SOURCE_KEY_STATE_DB,
            status: SOURCE_STATUS_DEGRADED,
        }],
        ..StateSnapshot::default()
    }
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

    use super::{parse_live_session_file, run_incremental_ingest, SessionAccumulator};

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

        assert_eq!(parsed.overview.thread_id, "thread-main-1");
        assert_eq!(parsed.overview.title, "First user line");
        assert_eq!(parsed.overview.status, "completed");
        assert_eq!(
            parsed.overview.latest_activity_summary.as_deref(),
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

    #[test]
    fn parses_root_main_thread_timeline_and_spans_with_pending_and_fallback_rules() {
        let state = build_test_state("root-main-detail");
        let live_path = state
            .source_paths
            .live_sessions_dir
            .join("2026/03/10/thread-main-detail.jsonl");
        seed_live_session(
            &live_path,
            &[
                json!({
                    "timestamp": "2026-03-10T09:00:00Z",
                    "type": "session_meta",
                    "payload": {
                        "id": "thread-main-detail",
                        "timestamp": "2026-03-10T09:00:00Z",
                        "cwd": "/workspace/main-detail",
                        "source": "vscode"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:01Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "user_message",
                        "message": "Thread Detail Title"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:02Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "agent_message",
                        "phase": "commentary",
                        "message": "working through the plan"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:03Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call",
                        "call_id": "call-spawn",
                        "name": "spawn_agent",
                        "arguments": "{\"agent_type\":\"researcher\"}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:05Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call_output",
                        "call_id": "call-spawn",
                        "output": "{\"agent_id\":\"agent-1\",\"nickname\":\"Erdos\"}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:06Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call",
                        "call_id": "call-wait",
                        "name": "wait",
                        "arguments": "{\"ids\":[\"session-child-1\"]}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:09Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call_output",
                        "call_id": "call-wait",
                        "output": "{\"status\":{\"session-child-1\":{\"completed\":\"2026-03-10T09:00:09Z\"}},\"timed_out\":false}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:10Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call",
                        "call_id": "call-tool",
                        "name": "exec_command",
                        "arguments": "{\"command\":\"pwd\"}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:15Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call_output",
                        "call_id": "call-tool",
                        "output": "{\"status\":\"completed\"}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:16Z",
                    "type": "response_item",
                    "payload": {
                        "type": "function_call",
                        "call_id": "call-pending",
                        "name": "request_user_input",
                        "arguments": "{\"question\":\"continue?\"}"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:17Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "agent_message",
                        "phase": "final_answer",
                        "message": "final answer from agent"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:00:18Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "task_complete",
                        "last_agent_message": "should not create duplicate final marker"
                    }
                }),
            ],
        );

        let parsed = parse_live_session_file(&live_path)
            .expect("parse should succeed")
            .expect("root main-thread should parse");

        assert_eq!(parsed.overview.thread_id, "thread-main-detail");
        assert_eq!(parsed.overview.status, "completed");
        assert_eq!(
            parsed
                .timeline_events
                .iter()
                .map(|event| (event.event_id.as_str(), event.kind.as_str(), event.summary.as_deref(), event.ended_at.as_deref()))
                .collect::<Vec<_>>(),
            vec![
                (
                    "thread-main-detail:2026-03-10T09:00:02Z:0000",
                    "commentary",
                    Some("working through the plan"),
                    None,
                ),
                ("call-spawn", "spawn", Some("Erdos"), Some("2026-03-10T09:00:05Z")),
                (
                    "call-wait",
                    "wait",
                    Some("session-child-1"),
                    Some("2026-03-10T09:00:09Z"),
                ),
                (
                    "call-tool",
                    "tool",
                    Some("exec_command"),
                    Some("2026-03-10T09:00:15Z"),
                ),
                (
                    "call-pending",
                    "tool",
                    Some("request_user_input"),
                    None,
                ),
                (
                    "thread-main-detail:2026-03-10T09:00:17Z:0000",
                    "final",
                    Some("final answer from agent"),
                    None,
                ),
            ]
        );

        assert_eq!(
            parsed.wait_spans,
            vec![super::WaitSpanRow {
                call_id: "call-wait".to_string(),
                thread_id: "thread-main-detail".to_string(),
                parent_session_id: "thread-main-detail".to_string(),
                child_session_id: Some("session-child-1".to_string()),
                started_at: "2026-03-10T09:00:06Z".to_string(),
                ended_at: Some("2026-03-10T09:00:09Z".to_string()),
                duration_ms: Some(3_000),
            }]
        );
        assert_eq!(
            parsed.tool_spans,
            vec![
                super::ToolSpanRow {
                    call_id: "call-tool".to_string(),
                    thread_id: "thread-main-detail".to_string(),
                    agent_session_id: None,
                    tool_name: "exec_command".to_string(),
                    started_at: "2026-03-10T09:00:10Z".to_string(),
                    ended_at: Some("2026-03-10T09:00:15Z".to_string()),
                    duration_ms: Some(5_000),
                },
                super::ToolSpanRow {
                    call_id: "call-pending".to_string(),
                    thread_id: "thread-main-detail".to_string(),
                    agent_session_id: None,
                    tool_name: "request_user_input".to_string(),
                    started_at: "2026-03-10T09:00:16Z".to_string(),
                    ended_at: None,
                    duration_ms: None,
                },
            ]
        );

        let fallback_path = state
            .source_paths
            .live_sessions_dir
            .join("2026/03/10/thread-main-fallback.jsonl");
        seed_live_session(
            &fallback_path,
            &[
                json!({
                    "timestamp": "2026-03-10T09:10:00Z",
                    "type": "session_meta",
                    "payload": {
                        "id": "thread-main-fallback",
                        "timestamp": "2026-03-10T09:10:00Z",
                        "cwd": "/workspace/main-fallback",
                        "source": "vscode"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T09:10:05Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "task_complete",
                        "last_agent_message": "fallback final message"
                    }
                }),
            ],
        );

        let fallback = parse_live_session_file(&fallback_path)
            .expect("fallback parse should succeed")
            .expect("fallback root should parse");
        assert_eq!(
            fallback
                .timeline_events
                .iter()
                .map(|event| (event.event_id.as_str(), event.kind.as_str(), event.summary.as_deref()))
                .collect::<Vec<_>>(),
            vec![(
                "thread-main-fallback:2026-03-10T09:10:05Z:0000",
                "final",
                Some("fallback final message"),
            )]
        );

        seed_state_db(&state.source_paths.state_db_path, &[]);
        init_monitor_db(&state).expect("monitor db should initialize");
        run_incremental_ingest(&state).expect("ingest should persist parsed rows");

        let monitor = Connection::open(&state.monitor_db_path).expect("open monitor db");
        let persisted_kinds = monitor
            .prepare(
                "
                select kind, event_id
                from timeline_events
                where thread_id = ?1
                order by started_at asc, event_id asc
                ",
            )
            .expect("prepare timeline query")
            .query_map(params!["thread-main-detail"], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .expect("query timeline rows")
            .map(|row| row.expect("decode timeline row"))
            .collect::<Vec<_>>();
        assert_eq!(
            persisted_kinds,
            vec![
                (
                    "commentary".to_string(),
                    "thread-main-detail:2026-03-10T09:00:02Z:0000".to_string(),
                ),
                ("spawn".to_string(), "call-spawn".to_string()),
                ("wait".to_string(), "call-wait".to_string()),
                ("tool".to_string(), "call-tool".to_string()),
                ("tool".to_string(), "call-pending".to_string()),
                (
                    "final".to_string(),
                    "thread-main-detail:2026-03-10T09:00:17Z:0000".to_string(),
                ),
            ]
        );
        let wait_parent: String = monitor
            .query_row(
                "select parent_session_id from wait_spans where call_id = ?1",
                params!["call-wait"],
                |row| row.get(0),
            )
            .expect("wait span should persist");
        assert_eq!(wait_parent, "thread-main-detail");
        let pending_tool: (Option<String>, Option<i64>) = monitor
            .query_row(
                "select ended_at, duration_ms from tool_spans where call_id = ?1",
                params!["call-pending"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("pending tool span should persist");
        assert_eq!(pending_tool, (None, None));
    }

    #[test]
    fn wait_with_multi_ids_uses_single_completed_output_key_when_available() {
        let parsed = parse_root_fixture(
            "wait-single-completed",
            &[json!({
                "timestamp": "2026-03-10T09:20:00Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-wait-multi",
                    "name": "wait",
                    "arguments": "{\"ids\":[\"session-a\",\"session-b\"]}"
                }
            }), json!({
                "timestamp": "2026-03-10T09:20:04Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-wait-multi",
                    "output": "{\"status\":{\"session-b\":{\"completed\":\"2026-03-10T09:20:04Z\"},\"session-a\":{\"running\":true}},\"timed_out\":false}"
                }
            })],
        );

        assert_eq!(
            parsed.wait_spans[0].child_session_id.as_deref(),
            Some("session-b")
        );
    }

    #[test]
    fn wait_with_multi_ids_stays_null_without_single_completed_output_key() {
        let parsed = parse_root_fixture(
            "wait-null",
            &[json!({
                "timestamp": "2026-03-10T09:30:00Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call-wait-null",
                    "name": "wait",
                    "arguments": "{\"ids\":[\"session-a\",\"session-b\"]}"
                }
            }), json!({
                "timestamp": "2026-03-10T09:30:04Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call-wait-null",
                    "output": "{\"status\":{\"session-a\":{\"completed\":\"2026-03-10T09:30:04Z\"},\"session-b\":{\"completed\":\"2026-03-10T09:30:04Z\"}},\"timed_out\":false}"
                }
            })],
        );

        assert_eq!(parsed.wait_spans[0].child_session_id, None);
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
        fs::create_dir_all(&live_sessions_dir).expect("create live sessions dir");
        let archived_sessions_dir = root_dir.join("archived_sessions");
        fs::create_dir_all(&archived_sessions_dir).expect("create archived sessions dir");
        fs::File::create(root_dir.join("state_5.sqlite")).expect("create state db file");

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

    fn parse_root_fixture(label: &str, rows: &[Value]) -> super::LiveRootThreadRow {
        let state = build_test_state(label);
        let path = state
            .source_paths
            .live_sessions_dir
            .join(format!("2026/03/10/{label}.jsonl"));
        let mut fixture_rows = vec![json!({
            "timestamp": "2026-03-10T09:00:00Z",
            "type": "session_meta",
            "payload": {
                "id": label,
                "timestamp": "2026-03-10T09:00:00Z",
                "cwd": "/workspace/test",
                "source": "vscode"
            }
        })];
        fixture_rows.extend_from_slice(rows);
        seed_live_session(&path, &fixture_rows);
        parse_live_session_file(&path)
            .expect("fixture parse should succeed")
            .expect("fixture should produce a root thread")
    }
}
