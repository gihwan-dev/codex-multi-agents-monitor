use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::commands::error::CommandError;
use crate::domain::models::ThreadStatus;
use crate::domain::{
    SummaryDashboardFilters, SummaryDashboardKpis, SummaryDashboardPayload, SummaryRoleMetric,
    SummarySessionCompareRow, SummaryWorkspaceMetric,
};
use crate::state::AppState;

use super::decode::{parse_status, parse_timestamp};

#[derive(Debug)]
struct ThreadRow {
    thread_id: String,
    title: String,
    cwd: String,
    status: ThreadStatus,
    started_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
    latest_activity_summary: Option<String>,
}

#[derive(Debug)]
struct AgentSessionRow {
    thread_id: String,
    agent_role: String,
    started_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
}

pub(super) fn get_summary_dashboard_from_db(
    state: &AppState,
    filters: Option<SummaryDashboardFilters>,
) -> Result<SummaryDashboardPayload, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let filters = normalize_filters(filters.unwrap_or_default());
    let all_threads = load_threads(&connection)?;
    let filtered_threads = all_threads
        .into_iter()
        .filter(|thread| matches_filters(thread, &filters))
        .collect::<Vec<_>>();
    let thread_ids = filtered_threads
        .iter()
        .map(|thread| thread.thread_id.clone())
        .collect::<HashSet<_>>();
    let sessions = load_agent_sessions(&connection, &thread_ids)?;
    let agent_roles_by_thread = collect_agent_roles_by_thread(&sessions);

    let session_count = u32::try_from(filtered_threads.len()).unwrap_or(u32::MAX);
    let active_session_count = u32::try_from(
        filtered_threads
            .iter()
            .filter(|thread| matches!(thread.status, ThreadStatus::Inflight))
            .count(),
    )
    .unwrap_or(u32::MAX);
    let completed_session_count = u32::try_from(
        filtered_threads
            .iter()
            .filter(|thread| matches!(thread.status, ThreadStatus::Completed))
            .count(),
    )
    .unwrap_or(u32::MAX);
    let workspace_count = u32::try_from(
        filtered_threads
            .iter()
            .map(|thread| thread.cwd.clone())
            .collect::<BTreeSet<_>>()
            .len(),
    )
    .unwrap_or(u32::MAX);
    let overall_average_duration_ms = average_duration_ms(
        filtered_threads
            .iter()
            .filter_map(|thread| duration_ms(thread.started_at, thread.updated_at)),
    );

    let mut workspace_accumulators = BTreeMap::<String, Vec<&ThreadRow>>::new();
    for thread in &filtered_threads {
        workspace_accumulators
            .entry(thread.cwd.clone())
            .or_default()
            .push(thread);
    }
    let workspace_distribution = workspace_accumulators
        .into_iter()
        .map(|(workspace, threads)| SummaryWorkspaceMetric {
            workspace,
            session_count: u32::try_from(threads.len()).unwrap_or(u32::MAX),
            average_duration_ms: average_duration_ms(
                threads
                    .iter()
                    .filter_map(|thread| duration_ms(thread.started_at, thread.updated_at)),
            ),
            latest_updated_at: threads.iter().filter_map(|thread| thread.updated_at).max(),
        })
        .collect::<Vec<_>>();

    let mut role_accumulators = BTreeMap::<String, Vec<&AgentSessionRow>>::new();
    for session in &sessions {
        role_accumulators
            .entry(session.agent_role.clone())
            .or_default()
            .push(session);
    }
    let role_mix = role_accumulators
        .into_iter()
        .map(|(agent_role, sessions)| SummaryRoleMetric {
            agent_role,
            session_count: u32::try_from(sessions.len()).unwrap_or(u32::MAX),
            average_duration_ms: average_duration_ms(
                sessions
                    .iter()
                    .filter_map(|session| duration_ms(session.started_at, session.updated_at)),
            ),
        })
        .collect::<Vec<_>>();

    let mut session_compare = filtered_threads
        .into_iter()
        .map(|thread| SummarySessionCompareRow {
            thread_id: thread.thread_id.clone(),
            title: thread.title,
            cwd: thread.cwd,
            status: thread.status,
            updated_at: thread.updated_at,
            latest_activity_summary: thread.latest_activity_summary,
            duration_ms: duration_ms(thread.started_at, thread.updated_at),
            agent_roles: agent_roles_by_thread
                .get(&thread.thread_id)
                .cloned()
                .unwrap_or_default(),
        })
        .collect::<Vec<_>>();
    session_compare.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.thread_id.cmp(&right.thread_id))
    });

    Ok(SummaryDashboardPayload {
        filters,
        kpis: SummaryDashboardKpis {
            session_count,
            active_session_count,
            completed_session_count,
            average_duration_ms: overall_average_duration_ms,
            workspace_count,
        },
        workspace_distribution,
        role_mix,
        session_compare,
    })
}

fn normalize_filters(filters: SummaryDashboardFilters) -> SummaryDashboardFilters {
    SummaryDashboardFilters {
        workspace: normalize_text(filters.workspace),
        session_id: normalize_text(filters.session_id),
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

fn load_threads(connection: &Connection) -> Result<Vec<ThreadRow>, CommandError> {
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
            order by updated_at desc, thread_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            Ok(ThreadRow {
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

fn load_agent_sessions(
    connection: &Connection,
    thread_ids: &HashSet<String>,
) -> Result<Vec<AgentSessionRow>, CommandError> {
    if thread_ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              agent_role,
              started_at,
              updated_at
            from agent_sessions
            where trim(agent_role) <> ''
            order by thread_id asc, depth asc, session_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            Ok(AgentSessionRow {
                thread_id: row.get(0)?,
                agent_role: row.get(1)?,
                started_at: parse_timestamp(row.get(2)?),
                updated_at: parse_timestamp(row.get(3)?),
            })
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut sessions = Vec::new();
    for row in rows {
        let session = row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if thread_ids.contains(&session.thread_id) {
            sessions.push(session);
        }
    }

    Ok(sessions)
}

fn collect_agent_roles_by_thread(
    sessions: &[AgentSessionRow],
) -> HashMap<String, Vec<String>> {
    let mut roles_by_thread = BTreeMap::<String, BTreeSet<String>>::new();
    for session in sessions {
        roles_by_thread
            .entry(session.thread_id.clone())
            .or_default()
            .insert(session.agent_role.clone());
    }

    roles_by_thread
        .into_iter()
        .map(|(thread_id, roles)| (thread_id, roles.into_iter().collect()))
        .collect()
}

fn matches_filters(thread: &ThreadRow, filters: &SummaryDashboardFilters) -> bool {
    if let Some(workspace) = filters.workspace.as_deref() {
        if thread.cwd != workspace {
            return false;
        }
    }

    if let Some(session_id) = filters.session_id.as_deref() {
        if thread.thread_id != session_id {
            return false;
        }
    }

    if let Some(from_date) = filters.from_date.as_deref() {
        let Some(updated_at) = thread.updated_at else {
            return false;
        };
        let updated_date = updated_at.date_naive().to_string();
        if updated_date.as_str() < from_date {
            return false;
        }
    }

    if let Some(to_date) = filters.to_date.as_deref() {
        let Some(updated_at) = thread.updated_at else {
            return false;
        };
        let updated_date = updated_at.date_naive().to_string();
        if updated_date.as_str() > to_date {
            return false;
        }
    }

    true
}

fn duration_ms(
    started_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
) -> Option<u64> {
    let started_at = started_at?;
    let updated_at = updated_at?;
    let duration_ms = updated_at.signed_duration_since(started_at).num_milliseconds();
    u64::try_from(duration_ms.max(0)).ok()
}

fn average_duration_ms<I>(values: I) -> Option<u64>
where
    I: Iterator<Item = u64>,
{
    let mut count = 0u64;
    let mut sum = 0u64;
    for value in values {
        count += 1;
        sum = sum.saturating_add(value);
    }

    (count > 0).then_some(sum / count)
}
