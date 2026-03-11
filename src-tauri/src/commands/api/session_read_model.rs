use rusqlite::{params, Connection, OptionalExtension};

use crate::commands::error::CommandError;
use crate::domain::models::{
    AgentSession, SessionEventRecord, SessionSummary, SessionToolRecord, SessionWaitRecord,
    StoredEventKind,
};
use crate::state::AppState;

use super::decode::{parse_required_timestamp, parse_status, parse_timestamp};

#[derive(Debug, Clone)]
pub(super) struct SessionDetailRecords {
    pub session: SessionSummary,
    pub agents: Vec<AgentSession>,
    pub timeline_events: Vec<SessionEventRecord>,
    pub wait_spans: Vec<SessionWaitRecord>,
    pub tool_spans: Vec<SessionToolRecord>,
}

pub(super) fn open_connection(state: &AppState) -> Result<Connection, CommandError> {
    Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))
}

pub(super) fn load_session_detail_records(
    state: &AppState,
    session_id: &str,
) -> Result<Option<SessionDetailRecords>, CommandError> {
    let connection = open_connection(state)?;
    load_session_detail_records_with_connection(&connection, session_id)
}

pub(super) fn load_session_detail_records_with_connection(
    connection: &Connection,
    session_id: &str,
) -> Result<Option<SessionDetailRecords>, CommandError> {
    let session = load_session_summary(connection, session_id)?;
    let Some(session) = session else {
        return Ok(None);
    };
    let agents = load_agent_sessions(connection, session_id)?;
    let timeline_events = load_timeline_events(connection, session_id)?;
    let wait_spans = load_wait_spans(connection, session_id)?;
    let tool_spans = load_tool_spans(connection, session_id)?;

    Ok(Some(SessionDetailRecords {
        session,
        agents,
        timeline_events,
        wait_spans,
        tool_spans,
    }))
}

pub(super) fn load_session_summary(
    connection: &Connection,
    session_id: &str,
) -> Result<Option<SessionSummary>, CommandError> {
    let summary = connection
        .query_row(
            "
            select
              thread_id,
              title,
              cwd,
              coalesce(nullif(workspace_root, ''), cwd) as workspace_root,
              archived,
              status,
              started_at,
              updated_at,
              latest_activity_summary,
              rollout_path
            from threads
            where thread_id = ?1
            ",
            params![session_id],
            |row| {
                Ok(SessionSummary {
                    session_id: row.get(0)?,
                    title: row.get(1)?,
                    workspace: row.get(3)?,
                    workspace_hint: workspace_hint(row.get::<_, String>(2)?, row.get::<_, String>(3)?),
                    archived: row.get::<_, i64>(4)? != 0,
                    status: parse_status(row.get::<_, String>(5)?.as_str()),
                    started_at: parse_timestamp(row.get(6)?),
                    updated_at: parse_timestamp(row.get(7)?),
                    latest_activity_summary: row.get(8)?,
                    agent_roles: Vec::new(),
                    rollout_path: row.get(9)?,
                })
            },
        )
        .optional()
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let Some(mut session) = summary else {
        return Ok(None);
    };
    session.agent_roles = load_agent_roles(connection, session_id)?;
    Ok(Some(session))
}

fn workspace_hint(cwd: String, workspace_root: String) -> Option<String> {
    (cwd.trim() != workspace_root.trim()).then_some(cwd)
}

fn load_agent_roles(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<String>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select distinct agent_role
            from agent_sessions
            where thread_id = ?1
              and trim(agent_role) <> ''
            order by agent_role asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![session_id], |row| row.get::<_, String>(0))
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut roles = Vec::new();
    for row in rows {
        roles.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }
    Ok(roles)
}

fn load_agent_sessions(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<AgentSession>, CommandError> {
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
              updated_at,
              rollout_path
            from agent_sessions
            where thread_id = ?1
            order by depth asc, started_at asc, session_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map(params![session_id], |row| {
            let depth = row.get::<_, i64>(4)?;
            Ok(AgentSession {
                session_id: row.get(0)?,
                thread_id: row.get(1)?,
                agent_role: row.get(2)?,
                agent_nickname: row.get(3)?,
                depth: u8::try_from(depth).unwrap_or_default(),
                started_at: parse_timestamp(row.get(5)?),
                updated_at: parse_timestamp(row.get(6)?),
                rollout_path: row.get(7)?,
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut agents = Vec::new();
    for row in rows {
        agents.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }
    Ok(agents)
}

fn load_timeline_events(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<SessionEventRecord>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              event_id,
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
        .query_map(params![session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut events = Vec::new();
    for row in rows {
        let (event_id, agent_session_id, kind, started_at, ended_at, summary) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        events.push(SessionEventRecord {
            event_id,
            agent_session_id,
            kind: map_stored_event_kind(kind.as_str()),
            started_at: parse_required_timestamp(started_at)?,
            ended_at: parse_timestamp(ended_at),
            summary,
        });
    }
    Ok(events)
}

fn load_wait_spans(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<SessionWaitRecord>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              call_id,
              parent_session_id,
              child_session_id,
              started_at,
              ended_at
            from wait_spans
            where thread_id = ?1
            order by started_at asc, call_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut spans = Vec::new();
    for row in rows {
        let (call_id, parent_session_id, child_session_id, started_at, ended_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        spans.push(SessionWaitRecord {
            call_id,
            parent_session_id,
            child_session_id,
            started_at: parse_required_timestamp(started_at)?,
            ended_at: parse_timestamp(ended_at),
        });
    }
    Ok(spans)
}

fn load_tool_spans(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<SessionToolRecord>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              call_id,
              agent_session_id,
              tool_name,
              started_at,
              ended_at
            from tool_spans
            where thread_id = ?1
            order by started_at asc, call_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut spans = Vec::new();
    for row in rows {
        let (call_id, agent_session_id, tool_name, started_at, ended_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        spans.push(SessionToolRecord {
            call_id,
            agent_session_id,
            tool_name,
            started_at: parse_required_timestamp(started_at)?,
            ended_at: parse_timestamp(ended_at),
        });
    }
    Ok(spans)
}

fn map_stored_event_kind(kind: &str) -> StoredEventKind {
    match kind {
        "user_message" => StoredEventKind::UserMessage,
        "commentary" => StoredEventKind::Commentary,
        "tool" => StoredEventKind::ToolCall,
        "wait" => StoredEventKind::Wait,
        "spawn" => StoredEventKind::Spawn,
        "final" => StoredEventKind::FinalAnswer,
        _ => StoredEventKind::Unknown,
    }
}
