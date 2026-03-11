use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

use chrono::{DateTime, Utc};
use serde_json::Value;

use crate::domain::models::{
    RawJsonlSnippet, RawJsonlSnippetLine, SessionLaneInspectorDegradedReason, SessionToolCall,
};

const RAW_SNIPPET_LINE_LIMIT: usize = 8;

#[derive(Debug, Clone, Default)]
struct RawFunctionCallRecord {
    name: Option<String>,
    started_at: Option<DateTime<Utc>>,
    ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct DecodedLaneInsights {
    pub latest_commentary_summary: Option<String>,
    pub latest_commentary_at: Option<DateTime<Utc>>,
    pub recent_tool_calls: Vec<SessionToolCall>,
    pub raw_snippet: Option<RawJsonlSnippet>,
    pub degraded_reason: Option<SessionLaneInspectorDegradedReason>,
}

pub fn normalize_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn parse_embedded_json(value: Option<&Value>) -> Option<Value> {
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

pub fn spawn_summary(arguments: Option<&Value>, output: Option<&Value>) -> Option<String> {
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

pub fn resolve_wait_child_session_id(
    arguments: Option<&Value>,
    output: Option<&Value>,
) -> Option<String> {
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

pub fn decode_lane_insights(
    _thread_id: &str,
    rollout_path: &str,
) -> DecodedLaneInsights {
    let rollout_path = rollout_path.trim();
    if rollout_path.is_empty() {
        return DecodedLaneInsights {
            latest_commentary_summary: None,
            latest_commentary_at: None,
            recent_tool_calls: Vec::new(),
            raw_snippet: None,
            degraded_reason: Some(SessionLaneInspectorDegradedReason::MissingRollout),
        };
    }

    let file = match File::open(rollout_path) {
        Ok(file) => file,
        Err(_) => {
            return DecodedLaneInsights {
                latest_commentary_summary: None,
                latest_commentary_at: None,
                recent_tool_calls: Vec::new(),
                raw_snippet: None,
                degraded_reason: Some(SessionLaneInspectorDegradedReason::UnreadableRollout),
            }
        }
    };

    let reader = BufReader::new(file);
    let mut raw_lines = Vec::new();
    let mut latest_commentary_line = None;
    let mut latest_meaningful_line = None;
    let mut latest_commentary_summary = None;
    let mut latest_commentary_at = None;
    let mut function_calls = BTreeMap::<String, RawFunctionCallRecord>::new();
    let mut degraded_reason = None;

    for (index, line) in reader.lines().enumerate() {
        let line = match line {
            Ok(line) => line,
            Err(_) => {
                degraded_reason = Some(SessionLaneInspectorDegradedReason::UnreadableRollout);
                break;
            }
        };
        let line_number = u32::try_from(index + 1).unwrap_or(u32::MAX);
        raw_lines.push(RawJsonlSnippetLine {
            line_number,
            content: line.clone(),
        });

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            degraded_reason.get_or_insert(SessionLaneInspectorDegradedReason::InvalidRollout);
            continue;
        };

        let timestamp = value
            .get("timestamp")
            .and_then(Value::as_str)
            .and_then(parse_raw_timestamp);
        let mut meaningful_line = false;

        match value.get("type").and_then(Value::as_str) {
            Some("event_msg") => {
                let Some(payload) = value.get("payload") else {
                    degraded_reason.get_or_insert(SessionLaneInspectorDegradedReason::InvalidRollout);
                    continue;
                };

                match payload.get("type").and_then(Value::as_str) {
                    Some("agent_message") => {
                        meaningful_line = true;
                        if payload.get("phase").and_then(Value::as_str) == Some("commentary") {
                            latest_commentary_line = Some(line_number);
                            latest_commentary_summary = payload
                                .get("message")
                                .and_then(Value::as_str)
                                .and_then(normalize_text);
                            latest_commentary_at = timestamp;
                        }
                    }
                    Some("user_message") | Some("task_complete") => {
                        meaningful_line = true;
                    }
                    Some(_) | None => {
                        degraded_reason.get_or_insert(SessionLaneInspectorDegradedReason::InvalidRollout);
                    }
                }
            }
            Some("response_item") => {
                let Some(payload) = value.get("payload") else {
                    degraded_reason.get_or_insert(SessionLaneInspectorDegradedReason::InvalidRollout);
                    continue;
                };

                meaningful_line = match payload.get("type").and_then(Value::as_str) {
                    Some("function_call") => {
                        record_function_call_start(payload, timestamp, &mut function_calls)
                    }
                    Some("function_call_output") => {
                        record_function_call_end(payload, timestamp, &mut function_calls)
                    }
                    Some(_) | None => false,
                };
            }
            Some(_) | None => {
                degraded_reason.get_or_insert(SessionLaneInspectorDegradedReason::InvalidRollout);
            }
        }

        if meaningful_line {
            latest_meaningful_line = Some(line_number);
        }
    }

    let mut recent_tool_calls = function_calls
        .into_iter()
        .filter_map(|(call_id, record)| {
            let tool_name = record.name?;
            if matches!(tool_name.as_str(), "spawn_agent" | "wait") {
                return None;
            }

            let started_at = record.started_at?;
            let duration_ms = record.ended_at.and_then(|ended_at| {
                u64::try_from(
                    ended_at
                        .signed_duration_since(started_at)
                        .num_milliseconds()
                        .max(0),
                )
                .ok()
            });

            Some(SessionToolCall {
                call_id,
                tool_name,
                started_at,
                ended_at: record.ended_at,
                duration_ms,
            })
        })
        .collect::<Vec<_>>();
    recent_tool_calls.sort_by(|left, right| {
        right
            .started_at
            .cmp(&left.started_at)
            .then_with(|| right.tool_name.cmp(&left.tool_name))
            .then_with(|| right.call_id.cmp(&left.call_id))
    });
    recent_tool_calls.truncate(3);

    let source_label = Path::new(rollout_path)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| rollout_path.to_string());
    let raw_snippet = build_raw_snippet(
        source_label,
        raw_lines,
        latest_commentary_line.or(latest_meaningful_line),
    );

    DecodedLaneInsights {
        latest_commentary_summary,
        latest_commentary_at,
        recent_tool_calls,
        raw_snippet,
        degraded_reason,
    }
}

fn record_function_call_start(
    payload: &Value,
    timestamp: Option<DateTime<Utc>>,
    function_calls: &mut BTreeMap<String, RawFunctionCallRecord>,
) -> bool {
    let Some(call_id) = payload
        .get("call_id")
        .and_then(Value::as_str)
        .and_then(normalize_text)
    else {
        return false;
    };

    let record = function_calls.entry(call_id).or_default();
    record.name = payload
        .get("name")
        .and_then(Value::as_str)
        .and_then(normalize_text);
    record.started_at = timestamp;
    true
}

fn record_function_call_end(
    payload: &Value,
    timestamp: Option<DateTime<Utc>>,
    function_calls: &mut BTreeMap<String, RawFunctionCallRecord>,
) -> bool {
    let Some(call_id) = payload
        .get("call_id")
        .and_then(Value::as_str)
        .and_then(normalize_text)
    else {
        return false;
    };

    let record = function_calls.entry(call_id).or_default();
    record.ended_at = timestamp;
    true
}

fn build_raw_snippet(
    source_label: String,
    raw_lines: Vec<RawJsonlSnippetLine>,
    anchor_line_number: Option<u32>,
) -> Option<RawJsonlSnippet> {
    let anchor_line_number = anchor_line_number?;
    let anchor_index = raw_lines
        .iter()
        .position(|line| line.line_number == anchor_line_number)?;

    let mut start = anchor_index.saturating_sub(4);
    let mut end = (start + RAW_SNIPPET_LINE_LIMIT).min(raw_lines.len());
    if end - start < RAW_SNIPPET_LINE_LIMIT {
        start = end.saturating_sub(RAW_SNIPPET_LINE_LIMIT);
    }
    if anchor_index >= end {
        end = (anchor_index + 1).min(raw_lines.len());
        start = end.saturating_sub(RAW_SNIPPET_LINE_LIMIT);
    }

    Some(RawJsonlSnippet {
        source_label,
        lines: raw_lines[start..end].to_vec(),
        truncated: start > 0 || end < raw_lines.len(),
    })
}

fn parse_raw_timestamp(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|timestamp| timestamp.with_timezone(&Utc))
}
