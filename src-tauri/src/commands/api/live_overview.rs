use std::collections::HashMap;

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection};

use crate::commands::error::CommandError;
use crate::domain::models::ThreadStatus;
use crate::domain::{
    BottleneckLevel, LiveOverviewThread, MiniTimelineItem, MiniTimelineItemKind,
};
use crate::state::AppState;

use super::decode::{parse_required_timestamp, parse_status, parse_timestamp};

#[derive(Debug)]
struct LiveOverviewBaseRow {
    thread_id: String,
    title: String,
    cwd: String,
    status: ThreadStatus,
    started_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
    latest_activity_summary: Option<String>,
}

#[derive(Debug)]
struct MiniTimelineSeed {
    sort_id: String,
    item: MiniTimelineItem,
}

fn elapsed_ms(now: DateTime<Utc>, started_at: DateTime<Utc>) -> Option<u64> {
    let elapsed_ms = now.signed_duration_since(started_at).num_milliseconds();
    Some(u64::try_from(elapsed_ms.max(0)).ok()?)
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

fn load_live_overview_base_rows(
    connection: &Connection,
) -> Result<Vec<LiveOverviewBaseRow>, CommandError> {
    let mut statement = connection
        .prepare(
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
            where archived = 0
            order by updated_at desc, thread_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            Ok(LiveOverviewBaseRow {
                thread_id: row.get(0)?,
                title: row.get(1)?,
                cwd: row.get(2)?,
                status: parse_status(row.get::<_, String>(3)?.as_str()),
                started_at: parse_timestamp(row.get(4)?),
                updated_at: parse_timestamp(row.get(5)?),
                latest_activity_summary: row.get(6)?,
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut threads = Vec::new();
    for row in rows {
        threads.push(row.map_err(|error| CommandError::Internal(error.to_string()))?);
    }

    Ok(threads)
}

fn load_agent_roles_map(
    connection: &Connection,
) -> Result<HashMap<String, Vec<String>>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              agent_sessions.thread_id,
              agent_sessions.agent_role
            from agent_sessions
            inner join threads on threads.thread_id = agent_sessions.thread_id
            where threads.archived = 0
              and trim(agent_sessions.agent_role) <> ''
            group by agent_sessions.thread_id, agent_sessions.agent_role
            order by agent_sessions.thread_id asc, agent_sessions.agent_role asc
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
        let (thread_id, agent_role) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        roles_map
            .entry(thread_id)
            .or_insert_with(Vec::new)
            .push(agent_role);
    }

    Ok(roles_map)
}

fn load_longest_open_waits_map(
    connection: &Connection,
    now: DateTime<Utc>,
) -> Result<HashMap<String, u64>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              wait_spans.thread_id,
              wait_spans.started_at
            from wait_spans
            inner join threads on threads.thread_id = wait_spans.thread_id
            where threads.archived = 0
              and wait_spans.ended_at is null
            order by wait_spans.thread_id asc, wait_spans.started_at asc, wait_spans.call_id asc
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
        let (thread_id, started_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        wait_map.entry(thread_id).or_insert(
            elapsed_ms(now.clone(), parse_required_timestamp(started_at)?).unwrap_or_default(),
        );
    }

    Ok(wait_map)
}

fn load_active_tools_map(
    connection: &Connection,
    now: DateTime<Utc>,
) -> Result<HashMap<String, (String, u64)>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              tool_spans.thread_id,
              tool_spans.tool_name,
              tool_spans.started_at
            from tool_spans
            inner join threads on threads.thread_id = tool_spans.thread_id
            where threads.archived = 0
              and tool_spans.ended_at is null
            order by tool_spans.thread_id asc, tool_spans.started_at asc, tool_spans.call_id asc
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
        let (thread_id, tool_name, started_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        tool_map.entry(thread_id).or_insert((
            tool_name,
            elapsed_ms(now.clone(), parse_required_timestamp(started_at)?).unwrap_or_default(),
        ));
    }

    Ok(tool_map)
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

fn push_mini_timeline_item(
    timeline_map: &mut HashMap<String, Vec<MiniTimelineSeed>>,
    thread_id: String,
    sort_id: String,
    item: MiniTimelineItem,
) {
    timeline_map
        .entry(thread_id)
        .or_insert_with(Vec::new)
        .push(MiniTimelineSeed { sort_id, item });
}

fn load_mini_timeline_map(
    connection: &Connection,
    window_start: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<HashMap<String, Vec<MiniTimelineItem>>, CommandError> {
    let window_start_text = format_timestamp(window_start);
    let window_end_text = format_timestamp(now);
    let mut timeline_map = HashMap::new();

    let mut statement = connection
        .prepare(
            "
            select
              wait_spans.thread_id,
              wait_spans.call_id,
              wait_spans.started_at,
              wait_spans.ended_at
            from wait_spans
            inner join threads on threads.thread_id = wait_spans.thread_id
            where threads.archived = 0
              and wait_spans.started_at <= ?2
              and (wait_spans.ended_at is null or wait_spans.ended_at >= ?1)
            order by wait_spans.thread_id asc, wait_spans.started_at asc, wait_spans.call_id asc
            ",
        )
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
        let (thread_id, call_id, started_at, ended_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let started_at = parse_required_timestamp(started_at)?;
        let ended_at = ended_at
            .map(parse_required_timestamp)
            .transpose()?
            .unwrap_or(now.clone());

        if let Some((started_at, ended_at)) =
            clip_span(started_at, ended_at, window_start.clone(), now.clone())
        {
            push_mini_timeline_item(
                &mut timeline_map,
                thread_id,
                format!("wait:{call_id}"),
                MiniTimelineItem {
                    kind: MiniTimelineItemKind::Wait,
                    started_at,
                    ended_at: Some(ended_at),
                },
            );
        }
    }

    let mut statement = connection
        .prepare(
            "
            select
              tool_spans.thread_id,
              tool_spans.call_id,
              tool_spans.started_at,
              tool_spans.ended_at
            from tool_spans
            inner join threads on threads.thread_id = tool_spans.thread_id
            where threads.archived = 0
              and tool_spans.started_at <= ?2
              and (tool_spans.ended_at is null or tool_spans.ended_at >= ?1)
            order by tool_spans.thread_id asc, tool_spans.started_at asc, tool_spans.call_id asc
            ",
        )
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
        let (thread_id, call_id, started_at, ended_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let started_at = parse_required_timestamp(started_at)?;
        let ended_at = ended_at
            .map(parse_required_timestamp)
            .transpose()?
            .unwrap_or(now.clone());

        if let Some((started_at, ended_at)) =
            clip_span(started_at, ended_at, window_start.clone(), now.clone())
        {
            push_mini_timeline_item(
                &mut timeline_map,
                thread_id,
                format!("tool:{call_id}"),
                MiniTimelineItem {
                    kind: MiniTimelineItemKind::Tool,
                    started_at,
                    ended_at: Some(ended_at),
                },
            );
        }
    }

    let mut statement = connection
        .prepare(
            "
            select
              timeline_events.thread_id,
              timeline_events.event_id,
              timeline_events.kind,
              timeline_events.started_at
            from timeline_events
            inner join threads on threads.thread_id = timeline_events.thread_id
            where threads.archived = 0
              and timeline_events.kind in ('commentary', 'spawn', 'final')
              and timeline_events.started_at >= ?1
              and timeline_events.started_at <= ?2
            order by timeline_events.thread_id asc, timeline_events.started_at asc, timeline_events.event_id asc
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
        let (thread_id, event_id, kind, started_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let started_at = parse_required_timestamp(started_at)?;
        let kind = match kind.as_str() {
            "spawn" => MiniTimelineItemKind::Spawn,
            "final" => MiniTimelineItemKind::Complete,
            _ => MiniTimelineItemKind::Message,
        };

        push_mini_timeline_item(
            &mut timeline_map,
            thread_id,
            format!("event:{event_id}"),
            MiniTimelineItem {
                kind,
                started_at,
                ended_at: None,
            },
        );
    }

    let timeline_map = timeline_map
        .into_iter()
        .map(|(thread_id, mut items)| {
            items.sort_by(|left, right| {
                left.item
                    .started_at
                    .cmp(&right.item.started_at)
                    .then_with(|| left.item.ended_at.cmp(&right.item.ended_at))
                    .then_with(|| left.sort_id.cmp(&right.sort_id))
            });

            (
                thread_id,
                items.into_iter().map(|seed| seed.item).collect::<Vec<_>>(),
            )
        })
        .collect::<HashMap<_, _>>();

    Ok(timeline_map)
}

pub(super) fn list_live_threads_from_db(
    state: &AppState,
) -> Result<Vec<LiveOverviewThread>, CommandError> {
    list_live_threads_from_db_at(state, Utc::now())
}

pub(super) fn list_live_threads_from_db_at(
    state: &AppState,
    now: DateTime<Utc>,
) -> Result<Vec<LiveOverviewThread>, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let window_start = now - chrono::Duration::minutes(10);
    let base_rows = load_live_overview_base_rows(&connection)?;
    let agent_roles_map = load_agent_roles_map(&connection)?;
    let open_waits_map = load_longest_open_waits_map(&connection, now.clone())?;
    let active_tools_map = load_active_tools_map(&connection, now.clone())?;
    let mini_timeline_map = load_mini_timeline_map(&connection, window_start.clone(), now.clone())?;

    let mut threads = Vec::new();
    for row in base_rows {
        let LiveOverviewBaseRow {
            thread_id,
            title,
            cwd,
            status,
            started_at,
            updated_at,
            latest_activity_summary,
        } = row;
        let longest_wait_ms = open_waits_map.get(&thread_id).copied();
        let active_tool = active_tools_map.get(&thread_id);
        let active_tool_name = active_tool.map(|tool| tool.0.clone());
        let active_tool_ms = active_tool.map(|tool| tool.1);
        let bottleneck_level = resolve_bottleneck_level(longest_wait_ms, active_tool_ms);
        let mini_timeline = mini_timeline_map
            .get(&thread_id)
            .cloned()
            .unwrap_or_default();
        let agent_roles = agent_roles_map.get(&thread_id).cloned().unwrap_or_default();

        threads.push(LiveOverviewThread {
            thread_id,
            title,
            cwd,
            status,
            started_at,
            updated_at,
            latest_activity_summary,
            agent_roles,
            bottleneck_level,
            longest_wait_ms,
            active_tool_name,
            active_tool_ms,
            mini_timeline_window_started_at: window_start.clone(),
            mini_timeline_window_ended_at: now.clone(),
            mini_timeline,
        });
    }

    Ok(threads)
}
