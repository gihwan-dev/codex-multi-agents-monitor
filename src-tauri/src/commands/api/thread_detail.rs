use rusqlite::{params, Connection, OptionalExtension};

use crate::commands::error::CommandError;
use crate::domain::models::{AgentSession, TimelineEvent, ToolSpan, WaitSpan};
use crate::domain::{MonitorThread, ThreadDetail};
use crate::state::AppState;

use super::decode::{
    parse_duration, parse_required_timestamp, parse_status, parse_timestamp,
};

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
        wait_spans.push((
            call_id,
            WaitSpan {
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
        tool_spans.push((
            call_id,
            ToolSpan {
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
