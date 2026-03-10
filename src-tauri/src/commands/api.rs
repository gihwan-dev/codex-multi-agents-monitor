use std::collections::HashMap;

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::error::CommandError;
use crate::domain::models::{AgentSession, ThreadStatus, TimelineEvent, ToolSpan, WaitSpan};
use crate::domain::{
    BottleneckLevel, BottleneckSnapshot, HistorySummary, HistorySummaryPayload, LiveOverviewThread,
    MiniTimelineItem, MiniTimelineItemKind, MonitorThread, ThreadDetail,
};
use crate::index_db::init_monitor_db;
use crate::ingest::run_incremental_ingest;
use crate::state::AppState;

fn parse_timestamp(value: Option<String>) -> Option<DateTime<Utc>> {
    value.and_then(|value| {
        DateTime::parse_from_rfc3339(&value)
            .ok()
            .map(|parsed| parsed.with_timezone(&Utc))
    })
}

fn parse_status(value: &str) -> ThreadStatus {
    match value {
        "completed" => ThreadStatus::Completed,
        _ => ThreadStatus::Inflight,
    }
}

fn parse_required_timestamp(value: String) -> Result<DateTime<Utc>, CommandError> {
    DateTime::parse_from_rfc3339(&value)
        .map(|parsed| parsed.with_timezone(&Utc))
        .map_err(|error| CommandError::Internal(error.to_string()))
}

fn parse_duration(value: Option<i64>) -> Option<u64> {
    value.and_then(|value| u64::try_from(value).ok())
}

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
              and status = 'inflight'
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
              and threads.status = 'inflight'
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
              and threads.status = 'inflight'
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
              and threads.status = 'inflight'
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
              and threads.status = 'inflight'
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
              and threads.status = 'inflight'
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
              and threads.status = 'inflight'
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

fn list_live_threads_from_db(state: &AppState) -> Result<Vec<LiveOverviewThread>, CommandError> {
    list_live_threads_from_db_at(state, Utc::now())
}

fn list_live_threads_from_db_at(
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

fn get_thread_detail_from_db(
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

#[tauri::command]
pub fn list_live_threads(
    state: State<'_, AppState>,
) -> Result<Vec<LiveOverviewThread>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    list_live_threads_from_db(&state)
}

#[tauri::command]
pub fn get_thread_detail(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadDetail>, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    run_incremental_ingest(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    get_thread_detail_from_db(&state, &thread_id)
}

#[tauri::command]
pub fn get_history_summary(
    state: State<'_, AppState>,
) -> Result<HistorySummaryPayload, CommandError> {
    init_monitor_db(&state).map_err(|error| CommandError::Internal(error.to_string()))?;
    let generated_at = Utc::now();
    Ok(HistorySummaryPayload {
        history: HistorySummary {
            from_date: generated_at.date_naive().to_string(),
            to_date: generated_at.date_naive().to_string(),
            average_duration_ms: None,
            timeout_count: 0,
            spawn_count: 0,
        },
        bottleneck: BottleneckSnapshot {
            generated_at,
            slow_threads: Vec::new(),
            longest_wait_ms: None,
        },
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use chrono::{TimeZone, Utc};
    use rusqlite::{params, Connection};
    use serde_json::{json, Value};

    use crate::domain::models::{BottleneckLevel, MiniTimelineItemKind, ThreadStatus};
    use crate::index_db::init_monitor_db;
    use crate::ingest::run_incremental_ingest;
    use crate::sources::SourcePaths;
    use crate::state::AppState;

    use super::{
        get_thread_detail_from_db, list_live_threads_from_db, list_live_threads_from_db_at,
    };

    #[test]
    fn list_live_threads_returns_only_inflight_unarchived_threads() {
        let state = build_test_state("list-live");
        init_monitor_db(&state).expect("failed to initialize monitor db");
        let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

        insert_thread(
            &connection,
            "thread-live-new",
            "inflight",
            0,
            Some("2026-03-10T03:00:00Z"),
        );
        insert_thread(
            &connection,
            "thread-completed",
            "completed",
            0,
            Some("2026-03-10T04:00:00Z"),
        );
        insert_thread(
            &connection,
            "thread-archived",
            "inflight",
            1,
            Some("2026-03-10T05:00:00Z"),
        );
        insert_thread(
            &connection,
            "thread-live-old",
            "inflight",
            0,
            Some("2026-03-10T01:00:00Z"),
        );

        let threads = list_live_threads_from_db(&state).expect("list_live_threads should work");
        let ids = threads
            .iter()
            .map(|thread| thread.thread_id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(ids, vec!["thread-live-new", "thread-live-old"]);
    }

    #[test]
    fn list_live_threads_calculates_overview_fields_and_clips_mini_timeline() {
        let state = build_test_state("list-live-overview");
        init_monitor_db(&state).expect("failed to initialize monitor db");
        let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

        insert_thread(
            &connection,
            "thread-critical",
            "inflight",
            0,
            Some("2026-03-10T09:59:40Z"),
        );
        insert_thread(
            &connection,
            "thread-tool-warning",
            "inflight",
            0,
            Some("2026-03-10T09:59:20Z"),
        );
        insert_thread(
            &connection,
            "thread-normal",
            "inflight",
            0,
            Some("2026-03-10T09:58:00Z"),
        );
        insert_agent_with_role(
            &connection,
            "session-reviewer-a",
            "thread-critical",
            "reviewer",
            1,
            Some("2026-03-10T09:50:10Z"),
        );
        insert_agent_with_role(
            &connection,
            "session-reviewer-b",
            "thread-critical",
            "reviewer",
            2,
            Some("2026-03-10T09:50:20Z"),
        );
        insert_agent_with_role(
            &connection,
            "session-implementer",
            "thread-critical",
            "implementer",
            1,
            Some("2026-03-10T09:50:30Z"),
        );
        insert_wait_span(
            &connection,
            "wait-open-critical",
            "thread-critical",
            "thread-critical",
            Some("session-reviewer-a"),
            "2026-03-10T09:48:00Z",
            None,
            None,
        );
        insert_tool_span(
            &connection,
            "tool-closed-critical",
            "thread-critical",
            Some("session-reviewer-a"),
            "spawn_agent",
            "2026-03-10T09:55:00Z",
            Some("2026-03-10T09:55:12Z"),
            Some(12_000),
        );
        insert_tool_span(
            &connection,
            "tool-open-critical",
            "thread-critical",
            Some("session-reviewer-b"),
            "exec_command",
            "2026-03-10T09:59:30Z",
            None,
            None,
        );
        insert_timeline_event(
            &connection,
            "spawn-critical",
            "thread-critical",
            "spawn",
            "2026-03-10T09:50:15Z",
            None,
            Some("spawned reviewer"),
        );
        insert_timeline_event(
            &connection,
            "commentary-critical-old",
            "thread-critical",
            "commentary",
            "2026-03-10T09:49:00Z",
            None,
            Some("too old"),
        );
        insert_timeline_event(
            &connection,
            "commentary-critical",
            "thread-critical",
            "commentary",
            "2026-03-10T09:59:50Z",
            None,
            Some("recent update"),
        );
        insert_timeline_event(
            &connection,
            "final-critical",
            "thread-critical",
            "final",
            "2026-03-10T09:59:59Z",
            None,
            Some("done"),
        );
        insert_tool_span(
            &connection,
            "tool-open-warning",
            "thread-tool-warning",
            None,
            "exec_command",
            "2026-03-10T09:59:35Z",
            None,
            None,
        );

        let now = Utc
            .with_ymd_and_hms(2026, 3, 10, 10, 0, 0)
            .single()
            .expect("fixed timestamp should exist");
        let threads = list_live_threads_from_db_at(&state, now).expect("list live threads");

        assert_eq!(
            threads
                .iter()
                .map(|thread| thread.thread_id.as_str())
                .collect::<Vec<_>>(),
            vec!["thread-critical", "thread-tool-warning", "thread-normal"]
        );

        let critical = &threads[0];
        assert_eq!(critical.status, ThreadStatus::Inflight);
        assert_eq!(critical.agent_roles, vec!["implementer", "reviewer"]);
        assert_eq!(critical.bottleneck_level, BottleneckLevel::Critical);
        assert_eq!(critical.longest_wait_ms, Some(720_000));
        assert_eq!(critical.active_tool_name.as_deref(), Some("exec_command"));
        assert_eq!(critical.active_tool_ms, Some(30_000));
        assert_eq!(
            critical.mini_timeline_window_started_at,
            Utc.with_ymd_and_hms(2026, 3, 10, 9, 50, 0)
                .single()
                .expect("window start should exist")
        );
        assert_eq!(critical.mini_timeline_window_ended_at, now);
        assert_eq!(
            critical
                .mini_timeline
                .iter()
                .map(|item| item.kind.clone())
                .collect::<Vec<_>>(),
            vec![
                MiniTimelineItemKind::Wait,
                MiniTimelineItemKind::Spawn,
                MiniTimelineItemKind::Tool,
                MiniTimelineItemKind::Tool,
                MiniTimelineItemKind::Message,
                MiniTimelineItemKind::Complete,
            ]
        );
        assert_eq!(
            critical.mini_timeline[0].started_at,
            Utc.with_ymd_and_hms(2026, 3, 10, 9, 50, 0)
                .single()
                .expect("window start should exist")
        );
        assert_eq!(critical.mini_timeline[0].ended_at, Some(now));

        let warning = threads
            .iter()
            .find(|thread| thread.thread_id == "thread-tool-warning")
            .expect("tool warning thread should exist");
        assert_eq!(warning.agent_roles, Vec::<String>::new());
        assert_eq!(warning.longest_wait_ms, None);
        assert_eq!(warning.active_tool_name.as_deref(), Some("exec_command"));
        assert_eq!(warning.active_tool_ms, Some(25_000));
        assert_eq!(warning.bottleneck_level, BottleneckLevel::Warning);
    }

    #[test]
    fn get_thread_detail_returns_sorted_agents_and_timeline_arrays() {
        let state = build_test_state("thread-detail");
        init_monitor_db(&state).expect("failed to initialize monitor db");
        let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");

        insert_thread(
            &connection,
            "thread-main-1",
            "inflight",
            0,
            Some("2026-03-10T02:00:00Z"),
        );
        insert_agent(
            &connection,
            "session-depth2",
            "thread-main-1",
            2,
            Some("2026-03-10T02:10:00Z"),
        );
        insert_agent(
            &connection,
            "session-depth1-b",
            "thread-main-1",
            1,
            Some("2026-03-10T02:05:00Z"),
        );
        insert_agent(
            &connection,
            "session-depth1-a",
            "thread-main-1",
            1,
            Some("2026-03-10T02:05:00Z"),
        );
        insert_timeline_event(
            &connection,
            "event-late",
            "thread-main-1",
            "tool",
            "2026-03-10T02:08:00Z",
            Some("2026-03-10T02:09:00Z"),
            Some("late"),
        );
        insert_timeline_event(
            &connection,
            "event-early-b",
            "thread-main-1",
            "commentary",
            "2026-03-10T02:04:00Z",
            None,
            Some("second same-time event"),
        );
        insert_timeline_event(
            &connection,
            "event-early-a",
            "thread-main-1",
            "commentary",
            "2026-03-10T02:04:00Z",
            None,
            Some("first same-time event"),
        );
        insert_wait_span(
            &connection,
            "wait-b",
            "thread-main-1",
            "thread-main-1",
            Some("session-depth2"),
            "2026-03-10T02:07:00Z",
            Some("2026-03-10T02:09:00Z"),
            Some(2_000),
        );
        insert_wait_span(
            &connection,
            "wait-a",
            "thread-main-1",
            "thread-main-1",
            Some("session-depth1-a"),
            "2026-03-10T02:07:00Z",
            Some("2026-03-10T02:08:00Z"),
            Some(1_000),
        );
        insert_tool_span(
            &connection,
            "tool-b",
            "thread-main-1",
            None,
            "exec_command",
            "2026-03-10T02:06:00Z",
            Some("2026-03-10T02:10:00Z"),
            Some(4_000),
        );
        insert_tool_span(
            &connection,
            "tool-a",
            "thread-main-1",
            None,
            "spawn_agent",
            "2026-03-10T02:06:00Z",
            Some("2026-03-10T02:06:30Z"),
            Some(500),
        );

        let detail = get_thread_detail_from_db(&state, "thread-main-1")
            .expect("get_thread_detail should work")
            .expect("thread detail should exist");

        assert_eq!(detail.thread.thread_id, "thread-main-1");
        let session_ids = detail
            .agents
            .iter()
            .map(|agent| agent.session_id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            session_ids,
            vec!["session-depth1-a", "session-depth1-b", "session-depth2"]
        );
        assert_eq!(
            detail
                .timeline_events
                .iter()
                .map(|event| event.event_id.as_str())
                .collect::<Vec<_>>(),
            vec!["event-early-a", "event-early-b", "event-late"]
        );
        assert_eq!(
            detail
                .wait_spans
                .iter()
                .map(|span| span.child_session_id.as_deref())
                .collect::<Vec<_>>(),
            vec![Some("session-depth1-a"), Some("session-depth2")]
        );
        assert_eq!(
            detail
                .tool_spans
                .iter()
                .map(|span| span.tool_name.as_str())
                .collect::<Vec<_>>(),
            vec!["spawn_agent", "exec_command"]
        );
    }

    #[test]
    fn ingest_creates_live_only_root_visible_in_overview_and_detail() {
        let state = build_test_state("live-only-root");
        init_monitor_db(&state).expect("failed to initialize monitor db");
        seed_state_db(&state.source_paths.state_db_path, &[]);
        seed_live_session(
            &state
                .source_paths
                .live_sessions_dir
                .join("2026/03/10/thread-live-only.jsonl"),
            &[
                json!({
                    "timestamp": "2026-03-10T06:00:00Z",
                    "type": "session_meta",
                    "payload": {
                        "id": "thread-live-only",
                        "timestamp": "2026-03-10T06:00:00Z",
                        "cwd": "/workspace/live-only",
                        "source": "vscode"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T06:00:01Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "user_message",
                        "message": "Live Only Root Title"
                    }
                }),
            ],
        );

        run_incremental_ingest(&state).expect("ingest should succeed for live-only root");

        let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
        let metadata = connection
            .query_row(
                "
                select rollout_path, source_kind, archived
                from threads
                where thread_id = ?1
                ",
                params!["thread-live-only"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                },
            )
            .expect("live-only thread should be inserted");
        assert_eq!(metadata.0, "");
        assert_eq!(metadata.1, "live_session");
        assert_eq!(metadata.2, 0);

        let live_threads = list_live_threads_from_db(&state).expect("list live threads");
        assert_eq!(
            live_threads
                .iter()
                .map(|thread| thread.thread_id.as_str())
                .collect::<Vec<_>>(),
            vec!["thread-live-only"]
        );

        let detail = get_thread_detail_from_db(&state, "thread-live-only")
            .expect("detail query should succeed")
            .expect("live-only detail should exist");
        assert!(detail.agents.is_empty());
        assert!(detail.timeline_events.is_empty());
        assert!(detail.wait_spans.is_empty());
        assert!(detail.tool_spans.is_empty());
    }

    #[test]
    fn ingest_unarchives_archived_snapshot_root_for_live_overview_and_detail() {
        let state = build_test_state("live-unarchive");
        init_monitor_db(&state).expect("failed to initialize monitor db");
        seed_state_db(
            &state.source_paths.state_db_path,
            &[StateSeedRow {
                id: "thread-archived-live",
                rollout_path: "/rollout/from-state",
                created_at: 1_778_200_000,
                updated_at: 1_778_200_100,
                source: "vscode",
                cwd: "/workspace/from-state",
                title: "State Title",
                archived: 1,
                agent_role: None,
                agent_nickname: None,
            }],
        );
        seed_live_session(
            &state
                .source_paths
                .live_sessions_dir
                .join("2026/03/10/thread-archived-live.jsonl"),
            &[
                json!({
                    "timestamp": "2026-03-10T07:00:00Z",
                    "type": "session_meta",
                    "payload": {
                        "id": "thread-archived-live",
                        "timestamp": "2026-03-10T07:00:00Z",
                        "cwd": "/workspace/from-live",
                        "source": "vscode"
                    }
                }),
                json!({
                    "timestamp": "2026-03-10T07:00:01Z",
                    "type": "event_msg",
                    "payload": {
                        "type": "user_message",
                        "message": "Live Title"
                    }
                }),
            ],
        );

        run_incremental_ingest(&state).expect("ingest should succeed for archived live root");

        let connection = Connection::open(&state.monitor_db_path).expect("open monitor db");
        let archived_flag: i64 = connection
            .query_row(
                "select archived from threads where thread_id = ?1",
                params!["thread-archived-live"],
                |row| row.get(0),
            )
            .expect("thread should exist");
        assert_eq!(archived_flag, 0);

        let live_threads = list_live_threads_from_db(&state).expect("list live threads");
        assert_eq!(
            live_threads
                .iter()
                .map(|thread| thread.thread_id.as_str())
                .collect::<Vec<_>>(),
            vec!["thread-archived-live"]
        );

        let detail = get_thread_detail_from_db(&state, "thread-archived-live")
            .expect("detail query should succeed")
            .expect("archived-live detail should exist");
        assert!(detail.agents.is_empty());
        assert!(detail.timeline_events.is_empty());
        assert!(detail.wait_spans.is_empty());
        assert!(detail.tool_spans.is_empty());
    }

    fn build_test_state(label: &str) -> AppState {
        let root_dir = std::env::temp_dir().join(format!(
            "codex-monitor-api-tests-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be monotonic")
                .as_nanos()
        ));
        let live_sessions_dir = root_dir.join("sessions");
        let archived_sessions_dir = root_dir.join("archived_sessions");
        fs::create_dir_all(&live_sessions_dir).expect("create live sessions dir");
        fs::create_dir_all(&archived_sessions_dir).expect("create archived sessions dir");

        AppState {
            monitor_db_path: root_dir.join("monitor.db"),
            source_paths: SourcePaths {
                live_sessions_dir,
                archived_sessions_dir,
                state_db_path: root_dir.join("state_5.sqlite"),
            },
        }
    }

    fn insert_thread(
        connection: &Connection,
        thread_id: &str,
        status: &str,
        archived: i64,
        updated_at: Option<&str>,
    ) {
        connection
            .execute(
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
                    thread_id,
                    format!("title-{thread_id}"),
                    "/workspace",
                    "/rollout",
                    archived,
                    "vscode",
                    status,
                    Some("2026-03-10T00:00:00Z"),
                    updated_at,
                    Option::<String>::None,
                ],
            )
            .expect("insert thread");
    }

    fn insert_agent(
        connection: &Connection,
        session_id: &str,
        thread_id: &str,
        depth: i64,
        started_at: Option<&str>,
    ) {
        insert_agent_with_role(
            connection, session_id, thread_id, "subagent", depth, started_at,
        );
    }

    fn insert_agent_with_role(
        connection: &Connection,
        session_id: &str,
        thread_id: &str,
        agent_role: &str,
        depth: i64,
        started_at: Option<&str>,
    ) {
        connection
            .execute(
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
                    session_id,
                    thread_id,
                    agent_role,
                    Option::<String>::None,
                    depth,
                    started_at,
                    started_at,
                    "/rollout",
                    "/workspace",
                ],
            )
            .expect("insert agent session");
    }

    fn insert_timeline_event(
        connection: &Connection,
        event_id: &str,
        thread_id: &str,
        kind: &str,
        started_at: &str,
        ended_at: Option<&str>,
        summary: Option<&str>,
    ) {
        connection
            .execute(
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
                    event_id,
                    thread_id,
                    Option::<String>::None,
                    kind,
                    started_at,
                    ended_at,
                    summary,
                ],
            )
            .expect("insert timeline event");
    }

    fn insert_wait_span(
        connection: &Connection,
        call_id: &str,
        thread_id: &str,
        parent_session_id: &str,
        child_session_id: Option<&str>,
        started_at: &str,
        ended_at: Option<&str>,
        duration_ms: Option<i64>,
    ) {
        connection
            .execute(
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
                    call_id,
                    thread_id,
                    parent_session_id,
                    child_session_id,
                    started_at,
                    ended_at,
                    duration_ms,
                ],
            )
            .expect("insert wait span");
    }

    fn insert_tool_span(
        connection: &Connection,
        call_id: &str,
        thread_id: &str,
        agent_session_id: Option<&str>,
        tool_name: &str,
        started_at: &str,
        ended_at: Option<&str>,
        duration_ms: Option<i64>,
    ) {
        connection
            .execute(
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
                    call_id,
                    thread_id,
                    agent_session_id,
                    tool_name,
                    started_at,
                    ended_at,
                    duration_ms,
                ],
            )
            .expect("insert tool span");
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
                .expect("insert state thread row");
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
        fs::write(path, lines).expect("write live session");
    }
}
