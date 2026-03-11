use std::collections::{BTreeSet, HashMap, HashSet};

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection};

use crate::commands::error::CommandError;
use crate::domain::models::{
    BottleneckLevel, MiniTimelineItem, MiniTimelineItemKind, SessionListFilters, SessionListItem,
    SessionListPayload, SessionScope,
};
use crate::state::AppState;

use super::decode::{parse_required_timestamp, parse_status, parse_timestamp};
use super::session_read_model::open_connection;

#[derive(Debug)]
struct BaseSessionRow {
    thread_id: String,
    title: String,
    cwd: String,
    archived: bool,
    status: crate::domain::models::SessionStatus,
    started_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
    latest_activity_summary: Option<String>,
    rollout_path: Option<String>,
}

#[derive(Debug)]
struct MiniTimelineSeed {
    sort_id: String,
    item: MiniTimelineItem,
}

pub(super) fn list_sessions_from_db(
    state: &AppState,
    scope: SessionScope,
    filters: Option<SessionListFilters>,
) -> Result<SessionListPayload, CommandError> {
    let connection = open_connection(state)?;
    let filters = normalize_filters(filters.unwrap_or_default());
    let base_rows = load_session_rows(&connection, &scope)?;
    let workspaces = base_rows
        .iter()
        .map(|session| session.cwd.clone())
        .filter(|workspace| !workspace.trim().is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let filtered_rows = base_rows
        .into_iter()
        .filter(|session| matches_filters(session, &filters))
        .collect::<Vec<_>>();
    let session_ids = filtered_rows
        .iter()
        .map(|session| session.thread_id.clone())
        .collect::<HashSet<_>>();
    let agent_roles_map = load_agent_roles_map(&connection, &session_ids)?;
    let live_metrics = if matches!(scope, SessionScope::Live) {
        Some(load_live_metrics_map(&connection, &session_ids, Utc::now())?)
    } else {
        None
    };

    let sessions = filtered_rows
        .into_iter()
        .map(|row| {
            let metrics = live_metrics
                .as_ref()
                .and_then(|map| map.get(&row.thread_id))
                .cloned();
            SessionListItem {
                session_id: row.thread_id.clone(),
                title: row.title,
                workspace: row.cwd,
                archived: row.archived,
                status: row.status,
                started_at: row.started_at,
                updated_at: row.updated_at,
                latest_activity_summary: row.latest_activity_summary,
                agent_roles: agent_roles_map.get(&row.thread_id).cloned().unwrap_or_default(),
                bottleneck_level: metrics.as_ref().map(|metrics| metrics.bottleneck_level.clone()),
                longest_wait_ms: metrics.as_ref().and_then(|metrics| metrics.longest_wait_ms),
                active_tool_name: metrics.as_ref().and_then(|metrics| metrics.active_tool_name.clone()),
                active_tool_ms: metrics.as_ref().and_then(|metrics| metrics.active_tool_ms),
                mini_timeline_window_started_at: metrics.as_ref().and_then(|metrics| metrics.mini_timeline_window_started_at),
                mini_timeline_window_ended_at: metrics.as_ref().and_then(|metrics| metrics.mini_timeline_window_ended_at),
                mini_timeline: metrics.map(|metrics| metrics.mini_timeline).unwrap_or_default(),
                rollout_path: row.rollout_path,
            }
        })
        .collect::<Vec<_>>();

    Ok(SessionListPayload {
        scope,
        filters,
        workspaces,
        sessions,
    })
}

fn normalize_filters(filters: SessionListFilters) -> SessionListFilters {
    SessionListFilters {
        workspace: normalize_text(filters.workspace),
        query: normalize_text(filters.query),
        from_date: normalize_text(filters.from_date),
        to_date: normalize_text(filters.to_date),
    }
}

fn normalize_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn load_session_rows(
    connection: &Connection,
    scope: &SessionScope,
) -> Result<Vec<BaseSessionRow>, CommandError> {
    let archived_flag = match scope {
        SessionScope::Live => 0,
        SessionScope::Archive => 1,
    };
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              title,
              cwd,
              archived,
              status,
              started_at,
              updated_at,
              latest_activity_summary,
              rollout_path
            from threads
            where archived = ?1
            order by updated_at desc, thread_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![archived_flag], |row| {
            Ok(BaseSessionRow {
                thread_id: row.get(0)?,
                title: row.get(1)?,
                cwd: row.get(2)?,
                archived: row.get::<_, i64>(3)? != 0,
                status: parse_status(row.get::<_, String>(4)?.as_str()),
                started_at: parse_timestamp(row.get(5)?),
                updated_at: parse_timestamp(row.get(6)?),
                latest_activity_summary: row.get(7)?,
                rollout_path: row.get(8)?,
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }
    Ok(sessions)
}

fn load_agent_roles_map(
    connection: &Connection,
    session_ids: &HashSet<String>,
) -> Result<HashMap<String, Vec<String>>, CommandError> {
    if session_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              agent_role
            from agent_sessions
            where trim(agent_role) <> ''
            order by thread_id asc, agent_role asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut roles_map = HashMap::new();
    for row in rows {
        let (session_id, agent_role) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if !session_ids.contains(&session_id) {
            continue;
        }
        let roles = roles_map.entry(session_id).or_insert_with(Vec::new);
        if !roles.iter().any(|role| role == &agent_role) {
            roles.push(agent_role);
        }
    }
    Ok(roles_map)
}

#[derive(Debug, Clone)]
struct LiveMetrics {
    bottleneck_level: BottleneckLevel,
    longest_wait_ms: Option<u64>,
    active_tool_name: Option<String>,
    active_tool_ms: Option<u64>,
    mini_timeline_window_started_at: Option<DateTime<Utc>>,
    mini_timeline_window_ended_at: Option<DateTime<Utc>>,
    mini_timeline: Vec<MiniTimelineItem>,
}

fn load_live_metrics_map(
    connection: &Connection,
    session_ids: &HashSet<String>,
    now: DateTime<Utc>,
) -> Result<HashMap<String, LiveMetrics>, CommandError> {
    if session_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let window_start = now - chrono::Duration::minutes(10);
    let open_waits_map = load_longest_open_waits_map(connection, session_ids, now)?;
    let active_tools_map = load_active_tools_map(connection, session_ids, now)?;
    let mini_timeline_map = load_mini_timeline_map(connection, session_ids, window_start, now)?;
    let mut metrics = HashMap::new();

    for session_id in session_ids {
        let longest_wait_ms = open_waits_map.get(session_id).copied();
        let active_tool = active_tools_map.get(session_id);
        let active_tool_name = active_tool.map(|tool| tool.0.clone());
        let active_tool_ms = active_tool.map(|tool| tool.1);
        metrics.insert(
            session_id.clone(),
            LiveMetrics {
                bottleneck_level: resolve_bottleneck_level(longest_wait_ms, active_tool_ms),
                longest_wait_ms,
                active_tool_name,
                active_tool_ms,
                mini_timeline_window_started_at: Some(window_start),
                mini_timeline_window_ended_at: Some(now),
                mini_timeline: mini_timeline_map
                    .get(session_id)
                    .cloned()
                    .unwrap_or_default(),
            },
        );
    }

    Ok(metrics)
}

fn elapsed_ms(now: DateTime<Utc>, started_at: DateTime<Utc>) -> Option<u64> {
    let elapsed_ms = now.signed_duration_since(started_at).num_milliseconds();
    Some(u64::try_from(elapsed_ms.max(0)).ok()?)
}

fn resolve_bottleneck_level(
    longest_wait_ms: Option<u64>,
    active_tool_ms: Option<u64>,
) -> BottleneckLevel {
    match longest_wait_ms {
        Some(wait_ms) if wait_ms >= 120_000 => BottleneckLevel::Critical,
        Some(wait_ms) if wait_ms >= 30_000 => BottleneckLevel::Warning,
        Some(_) => BottleneckLevel::Normal,
        None => match active_tool_ms {
            Some(tool_ms) if tool_ms >= 20_000 => BottleneckLevel::Warning,
            _ => BottleneckLevel::Normal,
        },
    }
}

fn load_longest_open_waits_map(
    connection: &Connection,
    session_ids: &HashSet<String>,
    now: DateTime<Utc>,
) -> Result<HashMap<String, u64>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              started_at
            from wait_spans
            where ended_at is null
            order by thread_id asc, started_at asc, call_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut wait_map = HashMap::new();
    for row in rows {
        let (session_id, started_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if !session_ids.contains(&session_id) {
            continue;
        }
        wait_map.entry(session_id).or_insert(
            elapsed_ms(now, parse_required_timestamp(started_at)?).unwrap_or_default(),
        );
    }
    Ok(wait_map)
}

fn load_active_tools_map(
    connection: &Connection,
    session_ids: &HashSet<String>,
    now: DateTime<Utc>,
) -> Result<HashMap<String, (String, u64)>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              tool_name,
              started_at
            from tool_spans
            where ended_at is null
            order by thread_id asc, started_at asc, call_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let mut tool_map = HashMap::new();
    for row in rows {
        let (session_id, tool_name, started_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if !session_ids.contains(&session_id) {
            continue;
        }
        tool_map.entry(session_id).or_insert((
            tool_name,
            elapsed_ms(now, parse_required_timestamp(started_at)?).unwrap_or_default(),
        ));
    }
    Ok(tool_map)
}

fn format_timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn clip_span(
    started_at: DateTime<Utc>,
    ended_at: DateTime<Utc>,
    window_start: DateTime<Utc>,
    window_end: DateTime<Utc>,
) -> Option<(DateTime<Utc>, DateTime<Utc>)> {
    if ended_at < window_start || started_at > window_end {
        return None;
    }
    let clipped_start = started_at.max(window_start);
    let clipped_end = ended_at.min(window_end);
    if clipped_end < clipped_start {
        return None;
    }
    Some((clipped_start, clipped_end))
}

fn push_mini_timeline_item(
    timeline_map: &mut HashMap<String, Vec<MiniTimelineSeed>>,
    session_id: String,
    sort_id: String,
    item: MiniTimelineItem,
) {
    timeline_map
        .entry(session_id)
        .or_insert_with(Vec::new)
        .push(MiniTimelineSeed { sort_id, item });
}

fn load_mini_timeline_map(
    connection: &Connection,
    session_ids: &HashSet<String>,
    window_start: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<HashMap<String, Vec<MiniTimelineItem>>, CommandError> {
    let window_start_text = format_timestamp(window_start);
    let window_end_text = format_timestamp(now);
    let mut timeline_map = HashMap::new();

    for (sql, prefix, kind_transform) in [
        (
            "
            select thread_id, call_id, started_at, ended_at
            from wait_spans
            where started_at <= ?2
              and (ended_at is null or ended_at >= ?1)
            order by thread_id asc, started_at asc, call_id asc
            ",
            "wait",
            0u8,
        ),
        (
            "
            select thread_id, call_id, started_at, ended_at
            from tool_spans
            where started_at <= ?2
              and (ended_at is null or ended_at >= ?1)
            order by thread_id asc, started_at asc, call_id asc
            ",
            "tool",
            1u8,
        ),
    ] {
        let mut statement = connection
            .prepare(sql)
            .map_err(|error| CommandError::Internal(error.to_string()))?;
        let rows = statement
            .query_map(params![&window_start_text, &window_end_text], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })
            .map_err(|error| CommandError::Internal(error.to_string()))?;

        for row in rows {
            let (session_id, call_id, started_at, ended_at) =
                row.map_err(|error| CommandError::Internal(error.to_string()))?;
            if !session_ids.contains(&session_id) {
                continue;
            }
            let started_at = parse_required_timestamp(started_at)?;
            let ended_at = ended_at
                .map(parse_required_timestamp)
                .transpose()?
                .unwrap_or(now);
            if let Some((started_at, ended_at)) = clip_span(started_at, ended_at, window_start, now)
            {
                let kind = match kind_transform {
                    0 => MiniTimelineItemKind::Wait,
                    _ => MiniTimelineItemKind::Tool,
                };
                push_mini_timeline_item(
                    &mut timeline_map,
                    session_id,
                    format!("{prefix}:{call_id}"),
                    MiniTimelineItem {
                        kind,
                        started_at,
                        ended_at: Some(ended_at),
                    },
                );
            }
        }
    }

    let mut statement = connection
        .prepare(
            "
            select thread_id, event_id, kind, started_at
            from timeline_events
            where kind in ('commentary', 'spawn', 'final')
              and started_at >= ?1
              and started_at <= ?2
            order by thread_id asc, started_at asc, event_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let rows = statement
        .query_map(params![&window_start_text, &window_end_text], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    for row in rows {
        let (session_id, event_id, kind, started_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if !session_ids.contains(&session_id) {
            continue;
        }
        let kind = match kind.as_str() {
            "spawn" => MiniTimelineItemKind::Spawn,
            "final" => MiniTimelineItemKind::Complete,
            _ => MiniTimelineItemKind::Message,
        };
        push_mini_timeline_item(
            &mut timeline_map,
            session_id,
            format!("event:{event_id}"),
            MiniTimelineItem {
                kind,
                started_at: parse_required_timestamp(started_at)?,
                ended_at: None,
            },
        );
    }

    Ok(timeline_map
        .into_iter()
        .map(|(session_id, mut items)| {
            items.sort_by(|left, right| {
                left.item
                    .started_at
                    .cmp(&right.item.started_at)
                    .then_with(|| left.item.ended_at.cmp(&right.item.ended_at))
                    .then_with(|| left.sort_id.cmp(&right.sort_id))
            });
            (
                session_id,
                items.into_iter().map(|seed| seed.item).collect::<Vec<_>>(),
            )
        })
        .collect())
}

fn matches_filters(session: &BaseSessionRow, filters: &SessionListFilters) -> bool {
    if let Some(workspace) = filters.workspace.as_deref() {
        if session.cwd != workspace {
            return false;
        }
    }
    if let Some(query) = filters.query.as_deref() {
        let query = query.to_lowercase();
        let haystacks = [
            session.thread_id.to_lowercase(),
            session.title.to_lowercase(),
            session.cwd.to_lowercase(),
            session
                .latest_activity_summary
                .clone()
                .unwrap_or_default()
                .to_lowercase(),
        ];
        if !haystacks.iter().any(|value| value.contains(&query)) {
            return false;
        }
    }
    if let Some(from_date) = filters.from_date.as_deref() {
        let Some(updated_at) = session.updated_at else {
            return false;
        };
        if updated_at.date_naive().to_string().as_str() < from_date {
            return false;
        }
    }
    if let Some(to_date) = filters.to_date.as_deref() {
        let Some(updated_at) = session.updated_at else {
            return false;
        };
        if updated_at.date_naive().to_string().as_str() > to_date {
            return false;
        }
    }
    true
}
