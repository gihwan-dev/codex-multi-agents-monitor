use std::error::Error;
use std::fmt;
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::codex_source::{SessionLogRef, SourceKind as RawSourceKind};
use crate::log_parser::{
    call_id, detect_kind, extract_session_metadata, parse_line, DetectedKind, ParserError,
    RawLogEvent,
};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CanonicalSessionBundle {
    pub session: CanonicalSession,
    pub events: Vec<CanonicalEvent>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub metrics: Vec<CanonicalMetric>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanonicalSession {
    pub session_id: String,
    pub parent_session_id: Option<String>,
    pub workspace_path: String,
    pub title: Option<String>,
    pub status: SessionStatus,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub is_archived: bool,
    pub source_kind: SourceKind,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CanonicalEvent {
    pub event_id: String,
    pub session_id: String,
    pub parent_event_id: Option<String>,
    pub agent_instance_id: Option<String>,
    pub lane_id: String,
    pub kind: EventKind,
    pub detail_level: DetailLevel,
    pub occurred_at: String,
    pub duration_ms: Option<u64>,
    pub summary: Option<String>,
    pub payload_preview: Option<String>,
    pub payload_ref: Option<String>,
    pub token_input: Option<u64>,
    pub token_output: Option<u64>,
    pub meta: Map<String, Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CanonicalMetric {
    pub metric_id: String,
    pub scope: MetricScope,
    pub session_id: Option<String>,
    pub workspace_path: Option<String>,
    pub name: String,
    pub value: CanonicalScalar,
    pub unit: Option<String>,
    pub captured_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum CanonicalScalar {
    Integer(i64),
    Float(f64),
    Text(String),
    Boolean(bool),
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Live,
    Archived,
    Stalled,
    Aborted,
    Completed,
}

impl SessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Live => "live",
            Self::Archived => "archived",
            Self::Stalled => "stalled",
            Self::Aborted => "aborted",
            Self::Completed => "completed",
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    SessionLog,
    ArchiveLog,
}

impl SourceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SessionLog => "session_log",
            Self::ArchiveLog => "archive_log",
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    SessionStart,
    UserMessage,
    AgentMessage,
    Reasoning,
    ToolCall,
    ToolOutput,
    ToolSpan,
    Spawn,
    AgentComplete,
    TokenDelta,
    Error,
    TurnAborted,
}

impl EventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SessionStart => "session_start",
            Self::UserMessage => "user_message",
            Self::AgentMessage => "agent_message",
            Self::Reasoning => "reasoning",
            Self::ToolCall => "tool_call",
            Self::ToolOutput => "tool_output",
            Self::ToolSpan => "tool_span",
            Self::Spawn => "spawn",
            Self::AgentComplete => "agent_complete",
            Self::TokenDelta => "token_delta",
            Self::Error => "error",
            Self::TurnAborted => "turn_aborted",
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DetailLevel {
    Operational,
    Diagnostic,
    Raw,
}

impl DetailLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Operational => "operational",
            Self::Diagnostic => "diagnostic",
            Self::Raw => "raw",
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MetricScope {
    Session,
    Workspace,
    Global,
}

#[derive(Debug)]
pub enum NormalizeError {
    Io { path: PathBuf, source: io::Error },
    Parse { path: PathBuf, source: ParserError },
    MissingSessionId(PathBuf),
    MissingStartedAt(PathBuf),
}

impl fmt::Display for NormalizeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { path, source } => write!(f, "failed to read {}: {}", path.display(), source),
            Self::Parse { path, source } => {
                write!(f, "failed to parse {}: {}", path.display(), source)
            }
            Self::MissingSessionId(path) => {
                write!(f, "missing session id while normalizing {}", path.display())
            }
            Self::MissingStartedAt(path) => {
                write!(f, "missing started_at while normalizing {}", path.display())
            }
        }
    }
}

impl Error for NormalizeError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            Self::Parse { source, .. } => Some(source),
            Self::MissingSessionId(_) | Self::MissingStartedAt(_) => None,
        }
    }
}

pub fn normalize_session(
    log_ref: &SessionLogRef,
) -> Result<CanonicalSessionBundle, NormalizeError> {
    let file = File::open(&log_ref.path).map_err(|source| NormalizeError::Io {
        path: log_ref.path.clone(),
        source,
    })?;
    let reader = BufReader::new(file);
    normalize_reader(log_ref, reader)
}

fn normalize_reader<R: BufRead>(
    log_ref: &SessionLogRef,
    reader: R,
) -> Result<CanonicalSessionBundle, NormalizeError> {
    let mut events = Vec::new();
    let mut session_id = None;
    let mut parent_session_id = None;
    let mut workspace_path = None;
    let mut title = None;
    let mut started_at = None;
    let mut completed_at = None;
    let mut last_event_at = None;
    let mut agent_role = None;
    let mut agent_nickname = None;
    let mut saw_completed = false;
    let mut saw_aborted = false;

    for (line_index, line_result) in reader.lines().enumerate() {
        let line = line_result.map_err(|source| NormalizeError::Io {
            path: log_ref.path.clone(),
            source,
        })?;
        if line.trim().is_empty() {
            continue;
        }

        let parsed = parse_line(&line).map_err(|source| NormalizeError::Parse {
            path: log_ref.path.clone(),
            source,
        })?;
        let occurred_at = event_timestamp(&parsed);

        if let Some(hints) = extract_session_metadata(&parsed) {
            session_id = hints.session_id.or(session_id);
            parent_session_id = hints.parent_session_id.or(parent_session_id);
            agent_role = hints.agent_role.or(agent_role);
            agent_nickname = hints.agent_nickname.or(agent_nickname);
            workspace_path = payload_string(&parsed, "cwd").or(workspace_path);
            started_at = payload_string(&parsed, "timestamp")
                .or_else(|| parsed.timestamp.clone())
                .or(started_at);
        }

        let current_session_id = session_id.clone();
        let lane_id = lane_id_for_event(
            detect_kind(&parsed),
            agent_role.as_deref(),
            current_session_id.as_deref(),
        );

        match detect_kind(&parsed) {
            DetectedKind::SessionMeta => {
                if let (Some(id), Some(started)) = (current_session_id.clone(), started_at.clone())
                {
                    let mut meta = base_meta(&parsed);
                    if let Some(role) = &agent_role {
                        meta.insert("agent_role".into(), Value::String(role.clone()));
                    }
                    if let Some(nickname) = &agent_nickname {
                        meta.insert("agent_nickname".into(), Value::String(nickname.clone()));
                    }
                    if let Some(parent) = &parent_session_id {
                        meta.insert("parent_session_id".into(), Value::String(parent.clone()));
                    }
                    events.push(CanonicalEvent {
                        event_id: format!("{id}:session_start"),
                        session_id: id.clone(),
                        parent_event_id: None,
                        agent_instance_id: Some(id),
                        lane_id,
                        kind: EventKind::SessionStart,
                        detail_level: DetailLevel::Operational,
                        occurred_at: started,
                        duration_ms: None,
                        summary: Some("Session started".to_string()),
                        payload_preview: workspace_path.clone(),
                        payload_ref: None,
                        token_input: None,
                        token_output: None,
                        meta,
                    });
                }
            }
            DetectedKind::UserMessage => {
                if let Some(id) = current_session_id.clone() {
                    let preview = extract_message_preview(&parsed);
                    if title.is_none() {
                        title = preview.clone();
                    }
                    events.push(CanonicalEvent {
                        event_id: event_id_for(&id, line_index),
                        session_id: id,
                        parent_event_id: None,
                        agent_instance_id: None,
                        lane_id,
                        kind: EventKind::UserMessage,
                        detail_level: DetailLevel::Operational,
                        occurred_at: occurred_at.clone().unwrap_or_default(),
                        duration_ms: None,
                        summary: preview.clone(),
                        payload_preview: preview,
                        payload_ref: None,
                        token_input: None,
                        token_output: None,
                        meta: base_meta(&parsed),
                    });
                }
            }
            DetectedKind::AgentMessage => {
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::AgentMessage,
                    DetailLevel::Diagnostic,
                    occurred_at.clone(),
                    extract_message_preview(&parsed),
                    None,
                    base_meta(&parsed),
                );
            }
            DetectedKind::ReasoningSummary => {
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::Reasoning,
                    DetailLevel::Diagnostic,
                    occurred_at.clone(),
                    extract_reasoning_summary(&parsed),
                    None,
                    base_meta(&parsed),
                );
            }
            DetectedKind::FunctionCall => {
                let mut meta = base_meta(&parsed);
                if let Some(id) = call_id(&parsed) {
                    meta.insert("call_id".into(), Value::String(id.to_string()));
                }
                let preview = payload_string(&parsed, "arguments");
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::ToolCall,
                    DetailLevel::Diagnostic,
                    occurred_at.clone(),
                    payload_string(&parsed, "name").or_else(|| Some("Tool call".to_string())),
                    preview,
                    meta,
                );
            }
            DetectedKind::FunctionCallOutput => {
                let mut meta = base_meta(&parsed);
                if let Some(id) = call_id(&parsed) {
                    meta.insert("call_id".into(), Value::String(id.to_string()));
                }
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::ToolOutput,
                    DetailLevel::Diagnostic,
                    occurred_at.clone(),
                    Some("Tool output".to_string()),
                    payload_string(&parsed, "output"),
                    meta,
                );
            }
            DetectedKind::TokenCount => {
                if let Some(id) = current_session_id.clone() {
                    let input_tokens =
                        payload_u64(&parsed, &["info", "total_token_usage", "input_tokens"])
                            .or_else(|| {
                                payload_u64(&parsed, &["info", "last_token_usage", "input_tokens"])
                            });
                    let output_tokens =
                        payload_u64(&parsed, &["info", "total_token_usage", "output_tokens"])
                            .or_else(|| {
                                payload_u64(&parsed, &["info", "last_token_usage", "output_tokens"])
                            });

                    events.push(CanonicalEvent {
                        event_id: event_id_for(&id, line_index),
                        session_id: id.clone(),
                        parent_event_id: None,
                        agent_instance_id: Some(id),
                        lane_id,
                        kind: EventKind::TokenDelta,
                        detail_level: DetailLevel::Diagnostic,
                        occurred_at: occurred_at.clone().unwrap_or_default(),
                        duration_ms: None,
                        summary: Some("Token snapshot".to_string()),
                        payload_preview: None,
                        payload_ref: None,
                        token_input: input_tokens,
                        token_output: output_tokens,
                        meta: base_meta(&parsed),
                    });
                }
            }
            DetectedKind::TaskStarted => {
                let mut meta = base_meta(&parsed);
                meta.insert("raw_type".into(), Value::String("task_started".to_string()));
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::AgentMessage,
                    DetailLevel::Diagnostic,
                    occurred_at.clone(),
                    Some("Task started".to_string()),
                    None,
                    meta,
                );
            }
            DetectedKind::TaskComplete => {
                saw_completed = true;
                completed_at = occurred_at.clone().or(completed_at);
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::AgentComplete,
                    DetailLevel::Operational,
                    occurred_at.clone(),
                    Some("Task complete".to_string()),
                    payload_string(&parsed, "last_agent_message"),
                    base_meta(&parsed),
                );
            }
            DetectedKind::TurnAborted => {
                saw_aborted = true;
                push_simple_event(
                    &mut events,
                    current_session_id.as_deref(),
                    line_index,
                    lane_id,
                    EventKind::TurnAborted,
                    DetailLevel::Operational,
                    occurred_at.clone(),
                    Some("Turn aborted".to_string()),
                    payload_string(&parsed, "reason"),
                    base_meta(&parsed),
                );
            }
            DetectedKind::Unknown => {}
        }

        if let Some(timestamp) = occurred_at {
            last_event_at = Some(timestamp);
        }
    }

    let session_id =
        session_id.ok_or_else(|| NormalizeError::MissingSessionId(log_ref.path.clone()))?;
    let started_at = started_at
        .or_else(|| events.first().map(|event| event.occurred_at.clone()))
        .ok_or_else(|| NormalizeError::MissingStartedAt(log_ref.path.clone()))?;
    let ended_at = completed_at.or(last_event_at);
    let status = if saw_aborted {
        SessionStatus::Aborted
    } else if saw_completed {
        SessionStatus::Completed
    } else if matches!(log_ref.source_kind, RawSourceKind::ArchiveLog) {
        SessionStatus::Archived
    } else {
        SessionStatus::Live
    };

    Ok(CanonicalSessionBundle {
        session: CanonicalSession {
            session_id: session_id.clone(),
            parent_session_id,
            workspace_path: workspace_path.unwrap_or_default(),
            title,
            status,
            started_at,
            ended_at,
            is_archived: matches!(log_ref.source_kind, RawSourceKind::ArchiveLog),
            source_kind: map_source_kind(log_ref.source_kind),
        },
        events,
        metrics: Vec::new(),
    })
}

fn push_simple_event(
    events: &mut Vec<CanonicalEvent>,
    session_id: Option<&str>,
    line_index: usize,
    lane_id: String,
    kind: EventKind,
    detail_level: DetailLevel,
    occurred_at: Option<String>,
    summary: Option<String>,
    payload_preview: Option<String>,
    meta: Map<String, Value>,
) {
    if let Some(session_id) = session_id {
        events.push(CanonicalEvent {
            event_id: event_id_for(session_id, line_index),
            session_id: session_id.to_string(),
            parent_event_id: None,
            agent_instance_id: Some(session_id.to_string()),
            lane_id,
            kind,
            detail_level,
            occurred_at: occurred_at.unwrap_or_default(),
            duration_ms: None,
            summary,
            payload_preview,
            payload_ref: None,
            token_input: None,
            token_output: None,
            meta,
        });
    }
}

fn map_source_kind(source_kind: RawSourceKind) -> SourceKind {
    match source_kind {
        RawSourceKind::SessionLog => SourceKind::SessionLog,
        RawSourceKind::ArchiveLog => SourceKind::ArchiveLog,
    }
}

fn base_meta(event: &RawLogEvent) -> Map<String, Value> {
    let mut meta = Map::new();
    meta.insert(
        "top_level_type".into(),
        Value::String(event.top_level_type.clone()),
    );

    if let Some(payload_type) = event.payload_type() {
        meta.insert("raw_type".into(), Value::String(payload_type.to_string()));
    }

    if let Some(payload) = event.payload() {
        for key in ["phase", "role", "turn_id", "reason"] {
            if let Some(value) = payload.get(key) {
                meta.insert(key.to_string(), value.clone());
            }
        }
    }

    meta
}

fn lane_id_for_event(
    kind: DetectedKind,
    agent_role: Option<&str>,
    session_id: Option<&str>,
) -> String {
    if kind == DetectedKind::UserMessage {
        return "user".to_string();
    }

    if let Some(role) = agent_role {
        return format!("agent:{role}");
    }

    if let Some(session_id) = session_id {
        return format!("agent:{session_id}");
    }

    "main".to_string()
}

fn event_timestamp(event: &RawLogEvent) -> Option<String> {
    payload_string(event, "timestamp").or_else(|| event.timestamp.clone())
}

fn extract_message_preview(event: &RawLogEvent) -> Option<String> {
    payload_string(event, "message")
        .or_else(|| payload_string(event, "text"))
        .or_else(|| payload_content_text(event))
        .map(|text| truncate(&text, 160))
}

fn extract_reasoning_summary(event: &RawLogEvent) -> Option<String> {
    payload_string(event, "text")
        .or_else(|| {
            event.payload().and_then(|payload| {
                payload
                    .get("summary")
                    .and_then(Value::as_array)
                    .and_then(|items| items.iter().find_map(value_text))
            })
        })
        .map(|text| truncate(&text, 160))
}

fn payload_content_text(event: &RawLogEvent) -> Option<String> {
    event.payload().and_then(|payload| {
        payload
            .get("content")
            .and_then(Value::as_array)
            .and_then(|items| items.iter().find_map(value_text))
    })
}

fn value_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Object(map) => map
            .get("text")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .or_else(|| map.get("content").and_then(value_text)),
        Value::Array(items) => items.iter().find_map(value_text),
        _ => None,
    }
}

fn payload_string(event: &RawLogEvent, key: &str) -> Option<String> {
    event
        .payload()
        .and_then(|payload| payload.get(key))
        .and_then(value_string)
}

fn value_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn payload_u64(event: &RawLogEvent, path: &[&str]) -> Option<u64> {
    let mut current = event
        .payload()
        .map(|payload| Value::Object(payload.clone()))?;
    for segment in path {
        current = current.get(segment)?.clone();
    }
    current.as_u64()
}

fn truncate(text: &str, max_len: usize) -> String {
    let mut chars = text.chars();
    let truncated: String = chars.by_ref().take(max_len).collect();
    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

fn event_id_for(session_id: &str, line_index: usize) -> String {
    format!("{session_id}:{line_index}")
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::io::Write;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_json::json;

    use crate::codex_source::{detect_roots, discover_session_logs, SourceKind as RawSourceKind};

    #[test]
    fn normalizes_latest_live_sample() {
        let roots = detect_roots().expect("expected local Codex roots");
        let logs = discover_session_logs(&roots).expect("expected session discovery");
        let live_log = logs
            .iter()
            .find(|log| log.source_kind == RawSourceKind::SessionLog)
            .expect("expected a live log");

        let bundle = normalize_session(live_log).expect("expected live normalization");

        assert_eq!(bundle.session.source_kind, SourceKind::SessionLog);
        assert!(!bundle.session.is_archived);
        let expected_status = if bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::TurnAborted)
        {
            SessionStatus::Aborted
        } else if bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::AgentComplete)
        {
            SessionStatus::Completed
        } else {
            SessionStatus::Live
        };
        assert_eq!(bundle.session.status, expected_status);
        assert!(!bundle.session.session_id.is_empty());
        assert!(!bundle.session.workspace_path.is_empty());
        assert!(bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::SessionStart));
        assert!(bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::UserMessage));
        if bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::UserMessage)
        {
            assert!(bundle
                .session
                .title
                .as_ref()
                .is_some_and(|title| !title.is_empty()));
        }
    }

    #[test]
    fn normalizes_archived_sample_with_status_precedence() {
        let roots = detect_roots().expect("expected local Codex roots");
        let logs = discover_session_logs(&roots).expect("expected session discovery");
        let archived_log = logs
            .iter()
            .find(|log| log.source_kind == RawSourceKind::ArchiveLog)
            .expect("expected an archived log");

        let bundle = normalize_session(archived_log).expect("expected archived normalization");

        assert_eq!(bundle.session.source_kind, SourceKind::ArchiveLog);
        assert!(bundle.session.is_archived);

        let expected_status = if bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::TurnAborted)
        {
            SessionStatus::Aborted
        } else if bundle
            .events
            .iter()
            .any(|event| event.kind == EventKind::AgentComplete)
        {
            SessionStatus::Completed
        } else {
            SessionStatus::Archived
        };
        assert_eq!(bundle.session.status, expected_status);
    }

    #[test]
    fn absorbs_task_started_as_diagnostic_agent_message() {
        let path = write_temp_log(
            "task-started",
            &[
                r#"{"timestamp":"2026-03-12T06:33:41.954Z","type":"session_meta","payload":{"id":"session-1","timestamp":"2026-03-12T06:33:38.907Z","cwd":"/tmp/workspace"}}"#,
                r#"{"timestamp":"2026-03-12T06:33:41.956Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1"}}"#,
            ],
            RawSourceKind::SessionLog,
        );
        let bundle = normalize_session(&path).expect("expected normalization");
        let event = bundle
            .events
            .iter()
            .find(|event| event.summary.as_deref() == Some("Task started"))
            .expect("expected task_started event");

        assert_eq!(event.kind, EventKind::AgentMessage);
        assert_eq!(event.detail_level, DetailLevel::Diagnostic);
        assert_eq!(
            event.meta.get("raw_type"),
            Some(&Value::String("task_started".to_string()))
        );
    }

    #[test]
    fn preserves_call_id_for_tool_events() {
        let path = write_temp_log(
            "tool-call",
            &[
                r#"{"timestamp":"2026-03-12T06:33:41.954Z","type":"session_meta","payload":{"id":"session-1","timestamp":"2026-03-12T06:33:38.907Z","cwd":"/tmp/workspace"}}"#,
                r#"{"timestamp":"2026-03-12T06:33:42.000Z","type":"response_item","payload":{"type":"function_call","call_id":"call-1","name":"exec_command"}}"#,
                r#"{"timestamp":"2026-03-12T06:33:43.000Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call-1","output":"ok"}}"#,
            ],
            RawSourceKind::SessionLog,
        );
        let bundle = normalize_session(&path).expect("expected normalization");
        let call = bundle
            .events
            .iter()
            .find(|event| event.kind == EventKind::ToolCall)
            .expect("expected tool call");
        let output = bundle
            .events
            .iter()
            .find(|event| event.kind == EventKind::ToolOutput)
            .expect("expected tool output");

        assert_eq!(
            call.meta.get("call_id"),
            Some(&Value::String("call-1".to_string()))
        );
        assert_eq!(
            output.meta.get("call_id"),
            Some(&Value::String("call-1".to_string()))
        );
    }

    #[test]
    fn serialized_bundle_matches_minimum_schema_contract() {
        let bundle = CanonicalSessionBundle {
            session: CanonicalSession {
                session_id: "session-1".to_string(),
                parent_session_id: None,
                workspace_path: "/tmp/workspace".to_string(),
                title: Some("hello".to_string()),
                status: SessionStatus::Completed,
                started_at: "2026-03-12T06:33:38.907Z".to_string(),
                ended_at: Some("2026-03-12T06:33:43.000Z".to_string()),
                is_archived: false,
                source_kind: SourceKind::SessionLog,
            },
            events: vec![CanonicalEvent {
                event_id: "session-1:0".to_string(),
                session_id: "session-1".to_string(),
                parent_event_id: None,
                agent_instance_id: Some("session-1".to_string()),
                lane_id: "main".to_string(),
                kind: EventKind::AgentComplete,
                detail_level: DetailLevel::Operational,
                occurred_at: "2026-03-12T06:33:43.000Z".to_string(),
                duration_ms: None,
                summary: Some("Task complete".to_string()),
                payload_preview: None,
                payload_ref: None,
                token_input: None,
                token_output: None,
                meta: Map::new(),
            }],
            metrics: Vec::new(),
        };

        let serialized = serde_json::to_value(&bundle).expect("expected bundle serialization");
        let schema_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../tasks/codex-multi-agent-monitoring-app/schema.json");
        let schema = serde_json::from_slice::<Value>(
            &std::fs::read(schema_path).expect("expected task schema"),
        )
        .expect("expected valid schema json");

        let session_required = schema["$defs"]["session"]["required"]
            .as_array()
            .expect("expected session required fields");
        let event_required = schema["$defs"]["event"]["required"]
            .as_array()
            .expect("expected event required fields");
        let session = serialized.get("session").expect("expected session");
        let event = serialized["events"]
            .as_array()
            .and_then(|events| events.first())
            .expect("expected first event");

        for field in session_required.iter().filter_map(Value::as_str) {
            assert!(
                session.get(field).is_some(),
                "missing session field {field}"
            );
        }
        for field in event_required.iter().filter_map(Value::as_str) {
            assert!(event.get(field).is_some(), "missing event field {field}");
        }

        let session_statuses = schema["$defs"]["session"]["properties"]["status"]["enum"]
            .as_array()
            .expect("expected session status enum");
        let event_kinds = schema["$defs"]["event"]["properties"]["kind"]["enum"]
            .as_array()
            .expect("expected event kind enum");

        assert!(session_statuses.contains(&json!("completed")));
        assert!(event_kinds.contains(&json!("agent_complete")));
        assert_eq!(session["status"], json!("completed"));
        assert_eq!(event["kind"], json!("agent_complete"));
    }

    fn write_temp_log(name: &str, lines: &[&str], source_kind: RawSourceKind) -> SessionLogRef {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("expected time after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("codex-monitor-{name}-{suffix}.jsonl"));
        let mut file = File::create(&path).expect("expected temp log file");
        for line in lines {
            writeln!(file, "{line}").expect("expected line write");
        }

        SessionLogRef {
            path,
            source_kind,
            modified_at: SystemTime::now(),
        }
    }
}
