use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::commands::error::CommandError;
use crate::domain::models::{
    AgentSession, RawJsonlSnippet, RawJsonlSnippetLine, ThreadDrilldown, TimelineEvent, ToolSpan,
    WaitSpan,
};
use crate::domain::{MonitorThread, ThreadDetail};
use crate::state::AppState;

use super::decode::{
    parse_duration, parse_required_timestamp, parse_status, parse_timestamp,
};

const RAW_SNIPPET_LINE_LIMIT: usize = 8;

#[derive(Debug)]
struct DrilldownLaneContext {
    agent_session_id: Option<String>,
    rollout_path: String,
}

#[derive(Debug, Default)]
struct RawLaneInsights {
    latest_commentary_summary: Option<String>,
    latest_commentary_at: Option<DateTime<Utc>>,
    recent_tool_spans: Vec<ToolSpan>,
    raw_snippet: Option<RawJsonlSnippet>,
}

#[derive(Debug, Clone, Default)]
struct RawFunctionCallRecord {
    name: Option<String>,
    started_at: Option<DateTime<Utc>>,
    ended_at: Option<DateTime<Utc>>,
}

pub(super) fn get_thread_detail_from_db(
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
              archived,
              status,
              started_at,
              updated_at,
              latest_activity_summary
            from threads
            where thread_id = ?1
            ",
            params![thread_id],
            |row| {
                let archived = row.get::<_, i64>(3)? != 0;
                let status = parse_status(row.get::<_, String>(4)?.as_str());
                Ok(MonitorThread {
                    thread_id: row.get(0)?,
                    title: row.get(1)?,
                    cwd: row.get(2)?,
                    archived,
                    status,
                    started_at: parse_timestamp(row.get(5)?),
                    updated_at: parse_timestamp(row.get(6)?),
                    latest_activity_summary: row.get(7)?,
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
    agents.sort_by(|left, right| {
        left.depth
            .cmp(&right.depth)
            .then_with(|| left.started_at.cmp(&right.started_at))
            .then_with(|| left.session_id.cmp(&right.session_id))
    });

    let mut statement = connection
        .prepare(
            "
            select
              event_id,
              thread_id,
              agent_session_id,
              kind,
              started_at,
              ended_at,
              summary
            from timeline_events
            where thread_id = ?1
            order by started_at asc, event_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map(params![thread_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut timeline_events = Vec::new();
    for row in rows {
        let (event_id, db_thread_id, agent_session_id, kind, started_at, ended_at, summary) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        timeline_events.push(TimelineEvent {
            event_id,
            thread_id: db_thread_id,
            agent_session_id,
            kind,
            started_at: parse_required_timestamp(started_at)?,
            ended_at: parse_timestamp(ended_at),
            summary,
        });
    }
    timeline_events.sort_by(|left, right| {
        left.started_at
            .cmp(&right.started_at)
            .then_with(|| left.event_id.cmp(&right.event_id))
    });

    let mut statement = connection
        .prepare(
            "
            select
              call_id,
              thread_id,
              parent_session_id,
              child_session_id,
              started_at,
              ended_at,
              duration_ms
            from wait_spans
            where thread_id = ?1
            order by started_at asc, call_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map(params![thread_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<i64>>(6)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut wait_spans = Vec::new();
    for row in rows {
        let (
            call_id,
            db_thread_id,
            parent_session_id,
            child_session_id,
            started_at,
            ended_at,
            duration_ms,
        ) = row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let span_call_id = call_id.clone();
        wait_spans.push((
            call_id,
            WaitSpan {
                call_id: span_call_id,
                thread_id: db_thread_id,
                parent_session_id,
                child_session_id,
                started_at: parse_required_timestamp(started_at)?,
                ended_at: parse_timestamp(ended_at),
                duration_ms: parse_duration(duration_ms),
            },
        ));
    }
    wait_spans.sort_by(|left, right| {
        left.1
            .started_at
            .cmp(&right.1.started_at)
            .then_with(|| left.0.cmp(&right.0))
    });
    let wait_spans = wait_spans
        .into_iter()
        .map(|(_, span)| span)
        .collect::<Vec<_>>();

    let mut statement = connection
        .prepare(
            "
            select
              call_id,
              thread_id,
              agent_session_id,
              tool_name,
              started_at,
              ended_at,
              duration_ms
            from tool_spans
            where thread_id = ?1
            order by started_at asc, call_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map(params![thread_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<i64>>(6)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut tool_spans = Vec::new();
    for row in rows {
        let (call_id, db_thread_id, agent_session_id, tool_name, started_at, ended_at, duration_ms) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let span_call_id = call_id.clone();
        tool_spans.push((
            call_id,
            ToolSpan {
                call_id: span_call_id,
                thread_id: db_thread_id,
                agent_session_id,
                tool_name,
                started_at: parse_required_timestamp(started_at)?,
                ended_at: parse_timestamp(ended_at),
                duration_ms: parse_duration(duration_ms),
            },
        ));
    }
    tool_spans.sort_by(|left, right| {
        left.1
            .started_at
            .cmp(&right.1.started_at)
            .then_with(|| left.0.cmp(&right.0))
    });
    let tool_spans = tool_spans
        .into_iter()
        .map(|(_, span)| span)
        .collect::<Vec<_>>();

    Ok(Some(ThreadDetail {
        thread,
        agents,
        timeline_events,
        wait_spans,
        tool_spans,
    }))
}

pub(super) fn get_thread_drilldown_from_db(
    state: &AppState,
    thread_id: &str,
    lane_id: &str,
) -> Result<Option<ThreadDrilldown>, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let lane_context = load_drilldown_lane_context(&connection, thread_id, lane_id)?;
    let Some(lane_context) = lane_context else {
        return Ok(None);
    };

    let related_wait_spans = load_related_wait_spans(
        &connection,
        thread_id,
        lane_context.agent_session_id.as_deref(),
        lane_id,
    )?;
    let raw_insights = load_raw_lane_insights(
        thread_id,
        lane_context.agent_session_id.as_deref(),
        &lane_context.rollout_path,
    );

    Ok(Some(ThreadDrilldown {
        lane_id: lane_id.to_string(),
        latest_commentary_summary: raw_insights.latest_commentary_summary,
        latest_commentary_at: raw_insights.latest_commentary_at,
        recent_tool_spans: raw_insights.recent_tool_spans,
        related_wait_spans,
        raw_snippet: raw_insights.raw_snippet,
    }))
}

fn load_drilldown_lane_context(
    connection: &Connection,
    thread_id: &str,
    lane_id: &str,
) -> Result<Option<DrilldownLaneContext>, CommandError> {
    if lane_id == thread_id {
        let rollout_path = connection
            .query_row(
                "
                select rollout_path
                from threads
                where thread_id = ?1
                ",
                params![thread_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| CommandError::Internal(error.to_string()))?;

        return Ok(rollout_path.map(|rollout_path| DrilldownLaneContext {
            agent_session_id: None,
            rollout_path,
        }));
    }

    let rollout_path = connection
        .query_row(
            "
            select rollout_path
            from agent_sessions
            where thread_id = ?1
              and session_id = ?2
            ",
            params![thread_id, lane_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    Ok(rollout_path.map(|rollout_path| DrilldownLaneContext {
        agent_session_id: Some(lane_id.to_string()),
        rollout_path,
    }))
}

fn load_related_wait_spans(
    connection: &Connection,
    thread_id: &str,
    agent_session_id: Option<&str>,
    lane_id: &str,
) -> Result<Vec<WaitSpan>, CommandError> {
    let sql = if agent_session_id.is_some() {
        "
        select
          call_id,
          thread_id,
          parent_session_id,
          child_session_id,
          started_at,
          ended_at,
          duration_ms
        from wait_spans
        where thread_id = ?1
          and child_session_id = ?2
        order by started_at desc, call_id desc
        limit 3
        "
    } else {
        "
        select
          call_id,
          thread_id,
          parent_session_id,
          child_session_id,
          started_at,
          ended_at,
          duration_ms
        from wait_spans
        where thread_id = ?1
          and parent_session_id = ?2
        order by started_at desc, call_id desc
        limit 3
        "
    };

    let mut statement = connection
        .prepare(sql)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![thread_id, lane_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<i64>>(6)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut wait_spans = Vec::new();
    for row in rows {
        let (
            call_id,
            db_thread_id,
            parent_session_id,
            child_session_id,
            started_at,
            ended_at,
            duration_ms,
        ) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        wait_spans.push(WaitSpan {
            call_id,
            thread_id: db_thread_id,
            parent_session_id,
            child_session_id,
            started_at: parse_required_timestamp(started_at)?,
            ended_at: parse_timestamp(ended_at),
            duration_ms: parse_duration(duration_ms),
        });
    }

    Ok(wait_spans)
}

fn load_raw_lane_insights(
    thread_id: &str,
    agent_session_id: Option<&str>,
    rollout_path: &str,
) -> RawLaneInsights {
    let rollout_path = rollout_path.trim();
    if rollout_path.is_empty() {
        return RawLaneInsights::default();
    }

    let file = match File::open(rollout_path) {
        Ok(file) => file,
        Err(_) => return RawLaneInsights::default(),
    };
    let reader = BufReader::new(file);
    let mut raw_lines = Vec::new();
    let mut latest_commentary_line = None;
    let mut latest_meaningful_line = None;
    let mut latest_commentary_summary = None;
    let mut latest_commentary_at = None;
    let mut function_calls = BTreeMap::<String, RawFunctionCallRecord>::new();

    for (index, line) in reader.lines().enumerate() {
        let line = match line {
            Ok(line) => line,
            Err(_) => return RawLaneInsights::default(),
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
                    _ => {}
                }
            }
            Some("response_item") => {
                let Some(payload) = value.get("payload") else {
                    continue;
                };

                meaningful_line = match payload.get("type").and_then(Value::as_str) {
                    Some("function_call") => {
                        record_function_call_start(payload, timestamp, &mut function_calls)
                    }
                    Some("function_call_output") => {
                        record_function_call_end(payload, timestamp, &mut function_calls)
                    }
                    _ => false,
                };
            }
            _ => {}
        }

        if meaningful_line {
            latest_meaningful_line = Some(line_number);
        }
    }

    let mut recent_tool_spans = function_calls
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

            Some(ToolSpan {
                call_id,
                thread_id: thread_id.to_string(),
                agent_session_id: agent_session_id.map(str::to_string),
                tool_name,
                started_at,
                ended_at: record.ended_at,
                duration_ms,
            })
        })
        .collect::<Vec<_>>();
    recent_tool_spans.sort_by(|left, right| {
        right
            .started_at
            .cmp(&left.started_at)
            .then_with(|| right.tool_name.cmp(&left.tool_name))
            .then_with(|| right.call_id.cmp(&left.call_id))
    });
    recent_tool_spans.truncate(3);

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

    RawLaneInsights {
        latest_commentary_summary,
        latest_commentary_at,
        recent_tool_spans,
        raw_snippet,
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

fn normalize_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
