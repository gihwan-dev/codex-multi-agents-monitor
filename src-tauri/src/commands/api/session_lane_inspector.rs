use rusqlite::{params, OptionalExtension};

use crate::commands::error::CommandError;
use crate::domain::models::{
    SessionLaneInspectorPayload, SessionLaneRef, SessionWaitSpan,
};
use crate::state::AppState;

use super::decode::{parse_duration, parse_required_timestamp, parse_timestamp};
use super::session_flow::get_session_flow_from_db;
use super::session_read_model::open_connection;

#[derive(Debug)]
struct LaneContext {
    rollout_path: String,
}

pub(super) fn get_session_lane_inspector_from_db(
    state: &AppState,
    session_id: &str,
    lane_ref: SessionLaneRef,
) -> Result<Option<SessionLaneInspectorPayload>, CommandError> {
    let flow = get_session_flow_from_db(state, session_id)?;
    let Some(flow) = flow else {
        return Ok(None);
    };
    let Some(lane) = flow
        .lanes
        .iter()
        .find(|candidate| candidate.lane_ref == lane_ref)
        .cloned()
    else {
        return Ok(None);
    };

    let connection = open_connection(state)?;
    let lane_context = load_lane_context(&connection, session_id, &lane_ref)?;
    let Some(lane_context) = lane_context else {
        return Ok(None);
    };

    let related_waits = load_related_waits(&connection, session_id, &lane_ref)?;
    let raw_insights = crate::ingest::rollout_decoder::decode_lane_insights(
        session_id,
        &lane_context.rollout_path,
    );

    Ok(Some(SessionLaneInspectorPayload {
        lane,
        latest_commentary_summary: raw_insights.latest_commentary_summary,
        latest_commentary_at: raw_insights.latest_commentary_at,
        recent_tool_calls: raw_insights.recent_tool_calls,
        related_waits,
        raw_snippet: raw_insights.raw_snippet,
        degraded_reason: raw_insights.degraded_reason,
    }))
}

fn load_lane_context(
    connection: &rusqlite::Connection,
    session_id: &str,
    lane_ref: &SessionLaneRef,
) -> Result<Option<LaneContext>, CommandError> {
    match lane_ref {
        SessionLaneRef::User | SessionLaneRef::Main { .. } => {
            let rollout_path = connection
                .query_row(
                    "
                    select rollout_path
                    from threads
                    where thread_id = ?1
                    ",
                    params![session_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .map_err(|error| CommandError::Internal(error.to_string()))?;
            Ok(rollout_path.map(|rollout_path| LaneContext { rollout_path }))
        }
        SessionLaneRef::Subagent { agent_session_id } => {
            let rollout_path = connection
                .query_row(
                    "
                    select rollout_path
                    from agent_sessions
                    where thread_id = ?1
                      and session_id = ?2
                    ",
                    params![session_id, agent_session_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .map_err(|error| CommandError::Internal(error.to_string()))?;
            Ok(rollout_path.map(|rollout_path| LaneContext { rollout_path }))
        }
    }
}

fn load_related_waits(
    connection: &rusqlite::Connection,
    session_id: &str,
    lane_ref: &SessionLaneRef,
) -> Result<Vec<SessionWaitSpan>, CommandError> {
    let (sql, lane_value) = match lane_ref {
        SessionLaneRef::Subagent { agent_session_id } => (
            "
            select
              call_id,
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
            ",
            agent_session_id.as_str(),
        ),
        SessionLaneRef::User | SessionLaneRef::Main { .. } => (
            "
            select
              call_id,
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
            ",
            session_id,
        ),
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![session_id, lane_value], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<i64>>(5)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut waits = Vec::new();
    for row in rows {
        let (call_id, parent_session_id, child_session_id, started_at, ended_at, duration_ms) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        waits.push(SessionWaitSpan {
            call_id,
            parent_session_id,
            child_session_id,
            started_at: parse_required_timestamp(started_at)?,
            ended_at: parse_timestamp(ended_at),
            duration_ms: parse_duration(duration_ms),
        });
    }
    Ok(waits)
}
