use std::error::Error;
use std::fmt;

use serde_json::Value;

#[derive(Clone, Debug)]
pub struct RawLogEvent {
    pub timestamp: Option<String>,
    pub top_level_type: String,
    raw: Value,
}

impl RawLogEvent {
    pub fn payload_type(&self) -> Option<&str> {
        self.payload()
            .and_then(|payload| payload.get("type"))
            .and_then(Value::as_str)
    }

    pub fn payload(&self) -> Option<&serde_json::Map<String, Value>> {
        self.raw.get("payload").and_then(Value::as_object)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DetectedKind {
    SessionMeta,
    UserMessage,
    AgentMessage,
    ReasoningSummary,
    FunctionCall,
    FunctionCallOutput,
    TokenCount,
    TaskStarted,
    TaskComplete,
    TurnAborted,
    Unknown,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SessionMetadataHints {
    pub session_id: Option<String>,
    pub parent_session_id: Option<String>,
    pub agent_role: Option<String>,
    pub agent_nickname: Option<String>,
    pub parent_thread_id: Option<String>,
}

#[derive(Debug)]
pub enum ParserError {
    InvalidJson(serde_json::Error),
    MissingTopLevelType,
    NonObject,
}

impl fmt::Display for ParserError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(source) => write!(f, "invalid json: {}", source),
            Self::MissingTopLevelType => write!(f, "missing top-level type"),
            Self::NonObject => write!(f, "log line is not a JSON object"),
        }
    }
}

impl Error for ParserError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::InvalidJson(source) => Some(source),
            Self::MissingTopLevelType | Self::NonObject => None,
        }
    }
}

pub fn parse_line(line: &str) -> Result<RawLogEvent, ParserError> {
    let raw: Value = serde_json::from_str(line).map_err(ParserError::InvalidJson)?;
    let object = raw.as_object().ok_or(ParserError::NonObject)?;
    let top_level_type = object
        .get("type")
        .and_then(Value::as_str)
        .ok_or(ParserError::MissingTopLevelType)?
        .to_string();
    let timestamp = object
        .get("timestamp")
        .and_then(Value::as_str)
        .map(str::to_owned);

    Ok(RawLogEvent {
        timestamp,
        top_level_type,
        raw,
    })
}

pub fn detect_kind(event: &RawLogEvent) -> DetectedKind {
    match event.top_level_type.as_str() {
        "session_meta" => DetectedKind::SessionMeta,
        "event_msg" => match event.payload_type() {
            Some("user_message") => DetectedKind::UserMessage,
            Some("agent_message") => DetectedKind::AgentMessage,
            Some("agent_reasoning") => DetectedKind::ReasoningSummary,
            Some("token_count") => DetectedKind::TokenCount,
            Some("task_started") => DetectedKind::TaskStarted,
            Some("task_complete") => DetectedKind::TaskComplete,
            Some("turn_aborted") => DetectedKind::TurnAborted,
            _ => DetectedKind::Unknown,
        },
        "response_item" => match event.payload_type() {
            Some("message") => match (
                payload_value(event, "role").and_then(Value::as_str),
                payload_value(event, "phase").and_then(Value::as_str),
            ) {
                (Some("user"), _) => DetectedKind::UserMessage,
                (Some("assistant"), Some("commentary")) => DetectedKind::AgentMessage,
                _ => DetectedKind::Unknown,
            },
            Some("reasoning") => DetectedKind::ReasoningSummary,
            Some("function_call") => DetectedKind::FunctionCall,
            Some("function_call_output") => DetectedKind::FunctionCallOutput,
            _ => DetectedKind::Unknown,
        },
        _ => DetectedKind::Unknown,
    }
}

pub fn call_id(event: &RawLogEvent) -> Option<&str> {
    payload_value(event, "call_id").and_then(Value::as_str)
}

pub fn extract_session_metadata(event: &RawLogEvent) -> Option<SessionMetadataHints> {
    if detect_kind(event) != DetectedKind::SessionMeta {
        return None;
    }
    let payload = event.payload()?;
    Some(SessionMetadataHints {
        session_id: payload.get("id").and_then(Value::as_str).map(str::to_owned),
        parent_session_id: payload
            .get("forked_from_id")
            .and_then(Value::as_str)
            .map(str::to_owned),
        agent_role: payload
            .get("agent_role")
            .and_then(Value::as_str)
            .map(str::to_owned),
        agent_nickname: payload
            .get("agent_nickname")
            .and_then(Value::as_str)
            .map(str::to_owned),
        parent_thread_id: payload
            .get("source")
            .and_then(Value::as_object)
            .and_then(|source| source.get("subagent"))
            .and_then(Value::as_object)
            .and_then(|subagent| subagent.get("thread_spawn"))
            .and_then(Value::as_object)
            .and_then(|thread_spawn| thread_spawn.get("parent_thread_id"))
            .and_then(Value::as_str)
            .map(str::to_owned),
    })
}

fn payload_value<'a>(event: &'a RawLogEvent, key: &str) -> Option<&'a Value> {
    event.payload().and_then(|payload| payload.get(key))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs::File;
    use std::io::{BufRead, BufReader};

    use crate::codex_source::{detect_roots, discover_session_logs, SourceKind};

    #[test]
    fn classifies_supported_event_families() {
        let cases = [
            (
                r#"{"timestamp":"2026-03-12T05:53:06.171Z","type":"session_meta","payload":{"id":"s-1","agent_role":"worker"}}"#,
                DetectedKind::SessionMeta,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"user_message","message":"hello"}}"#,
                DetectedKind::UserMessage,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"agent_message","message":"working","phase":"commentary"}}"#,
                DetectedKind::AgentMessage,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"agent_reasoning","text":"summary"}}"#,
                DetectedKind::ReasoningSummary,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"response_item","payload":{"type":"message","role":"assistant","phase":"commentary","content":[]}}"#,
                DetectedKind::AgentMessage,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"response_item","payload":{"type":"reasoning","summary":[],"encrypted_content":"secret"}}"#,
                DetectedKind::ReasoningSummary,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"response_item","payload":{"type":"function_call","call_id":"call-1","name":"exec_command"}}"#,
                DetectedKind::FunctionCall,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call-1","output":"ok"}}"#,
                DetectedKind::FunctionCallOutput,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"token_count","info":null}}"#,
                DetectedKind::TokenCount,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"task_started"}}"#,
                DetectedKind::TaskStarted,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"task_complete"}}"#,
                DetectedKind::TaskComplete,
            ),
            (
                r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"turn_aborted"}}"#,
                DetectedKind::TurnAborted,
            ),
        ];

        for (line, expected) in cases {
            let event = parse_line(line).expect("expected valid line");
            assert_eq!(detect_kind(&event), expected);
        }
    }

    #[test]
    fn rejects_invalid_json() {
        let error = parse_line("not-json").expect_err("expected parse failure");
        assert!(matches!(error, ParserError::InvalidJson(_)));
    }

    #[test]
    fn pairs_function_calls_by_call_id() {
        let call = parse_line(
            r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"response_item","payload":{"type":"function_call","call_id":"call-1","name":"exec_command"}}"#,
        )
        .expect("expected function call line");
        let output = parse_line(
            r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call-1","output":"ok"}}"#,
        )
        .expect("expected function call output line");

        assert_eq!(call_id(&call), Some("call-1"));
        assert_eq!(call_id(&output), Some("call-1"));
    }

    #[test]
    fn accepts_token_count_with_and_without_info() {
        let null_info = parse_line(
            r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"token_count","info":null}}"#,
        )
        .expect("expected token count with null info");
        let filled_info = parse_line(
            r#"{"timestamp":"2026-03-12T05:53:06.172Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":1},"last_token_usage":{"output_tokens":2},"model_context_window":258400}}}"#,
        )
        .expect("expected token count with populated info");

        assert_eq!(detect_kind(&null_info), DetectedKind::TokenCount);
        assert_eq!(detect_kind(&filled_info), DetectedKind::TokenCount);
    }

    #[test]
    fn extracts_subagent_session_metadata_hints() {
        let event = parse_line(
            r#"{"timestamp":"2026-03-12T05:53:06.171Z","type":"session_meta","payload":{"id":"child-1","forked_from_id":"parent-1","agent_role":"architecture-reviewer","agent_nickname":"Mendel","source":{"subagent":{"thread_spawn":{"parent_thread_id":"thread-1"}}}}}"#,
        )
        .expect("expected valid session meta");
        let hints = extract_session_metadata(&event).expect("expected session hints");

        assert_eq!(hints.session_id.as_deref(), Some("child-1"));
        assert_eq!(hints.parent_session_id.as_deref(), Some("parent-1"));
        assert_eq!(hints.agent_role.as_deref(), Some("architecture-reviewer"));
        assert_eq!(hints.agent_nickname.as_deref(), Some("Mendel"));
        assert_eq!(hints.parent_thread_id.as_deref(), Some("thread-1"));
    }

    #[test]
    fn current_live_and_archived_samples_expose_core_kinds() {
        let roots = detect_roots().expect("expected local Codex roots");
        let logs = discover_session_logs(&roots).expect("expected log discovery to succeed");

        let live_log = logs
            .iter()
            .find(|log| log.source_kind == SourceKind::SessionLog)
            .expect("expected at least one live log");
        let archived_log = logs
            .iter()
            .find(|log| log.source_kind == SourceKind::ArchiveLog)
            .expect("expected at least one archived log");

        assert_sample_contains_core_kinds(&live_log.path);
        assert_sample_contains_core_kinds(&archived_log.path);
    }

    #[test]
    fn current_subagent_sample_preserves_agent_metadata() {
        let roots = detect_roots().expect("expected local Codex roots");
        let logs = discover_session_logs(&roots).expect("expected log discovery to succeed");

        let subagent_log = logs
            .iter()
            .filter(|log| log.source_kind == SourceKind::ArchiveLog)
            .find(|log| sample_contains_subagent_metadata(&log.path))
            .expect("expected at least one archived subagent log");

        let file = File::open(&subagent_log.path).expect("expected to open subagent log");
        let reader = BufReader::new(file);
        let first_line = reader
            .lines()
            .next()
            .expect("expected session_meta line")
            .expect("expected readable session_meta line");
        let event = parse_line(&first_line).expect("expected valid session_meta line");
        let hints = extract_session_metadata(&event).expect("expected session hints");

        assert!(hints.agent_role.is_some(), "expected agent_role");
        assert!(hints.agent_nickname.is_some(), "expected agent_nickname");
        assert!(
            hints.parent_thread_id.is_some() || hints.parent_session_id.is_some(),
            "expected parent linkage metadata"
        );
    }

    fn assert_sample_contains_core_kinds(path: &std::path::Path) {
        let file = File::open(path).expect("expected sample log to open");
        let reader = BufReader::new(file);
        let mut seen = HashSet::new();

        for line in reader.lines().take(200) {
            let line = line.expect("expected readable log line");
            let event = parse_line(&line).expect("expected valid log line");
            seen.insert(detect_kind(&event));
        }

        let required = [
            DetectedKind::UserMessage,
            DetectedKind::AgentMessage,
            DetectedKind::ReasoningSummary,
            DetectedKind::FunctionCall,
            DetectedKind::FunctionCallOutput,
            DetectedKind::TokenCount,
        ];

        let supported_count = required
            .iter()
            .filter(|kind| seen.contains(kind))
            .count();

        assert!(seen.contains(&DetectedKind::SessionMeta), "expected session_meta");
        assert!(
            supported_count >= 3,
            "expected at least three supported event families, saw {:?}",
            seen
        );
    }

    fn sample_contains_subagent_metadata(path: &std::path::Path) -> bool {
        let file = match File::open(path) {
            Ok(file) => file,
            Err(_) => return false,
        };
        let mut lines = BufReader::new(file).lines();
        let first_line = match lines.next() {
            Some(Ok(line)) => line,
            _ => return false,
        };
        let event = match parse_line(&first_line) {
            Ok(event) => event,
            Err(_) => return false,
        };
        let hints = match extract_session_metadata(&event) {
            Some(hints) => hints,
            None => return false,
        };

        hints.agent_role.is_some() && (hints.parent_thread_id.is_some() || hints.parent_session_id.is_some())
    }
}
