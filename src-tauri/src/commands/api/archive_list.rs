use std::collections::{BTreeSet, HashMap, HashSet};

use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::commands::error::CommandError;
use crate::domain::{ArchiveListFilters, ArchivedSessionListPayload, ArchivedSessionSummary};
use crate::domain::models::ThreadStatus;
use crate::state::AppState;

use super::decode::{parse_status, parse_timestamp};

#[derive(Debug)]
struct ArchivedThreadRow {
    thread_id: String,
    title: String,
    cwd: String,
    archived: bool,
    status: ThreadStatus,
    started_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
    latest_activity_summary: Option<String>,
    rollout_path: Option<String>,
}

pub(super) fn list_archived_sessions_from_db(
    state: &AppState,
    filters: Option<ArchiveListFilters>,
) -> Result<ArchivedSessionListPayload, CommandError> {
    let connection = Connection::open(&state.monitor_db_path)
        .map_err(|error| CommandError::Internal(error.to_string()))?;
    let filters = normalize_filters(filters.unwrap_or_default());
    let archived_threads = load_archived_threads(&connection)?;
    let workspaces = archived_threads
        .iter()
        .map(|thread| thread.cwd.clone())
        .filter(|workspace| !workspace.trim().is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let filtered_threads = archived_threads
        .into_iter()
        .filter(|thread| matches_filters(thread, &filters))
        .collect::<Vec<_>>();
    let thread_ids = filtered_threads
        .iter()
        .map(|thread| thread.thread_id.clone())
        .collect::<HashSet<_>>();
    let roles_map = load_agent_roles_map(&connection, &thread_ids)?;

    let sessions = filtered_threads
        .into_iter()
        .map(|thread| ArchivedSessionSummary {
            thread_id: thread.thread_id.clone(),
            title: thread.title,
            cwd: thread.cwd,
            archived: thread.archived,
            status: thread.status,
            started_at: thread.started_at,
            updated_at: thread.updated_at,
            latest_activity_summary: thread.latest_activity_summary,
            agent_roles: roles_map.get(&thread.thread_id).cloned().unwrap_or_default(),
            rollout_path: thread.rollout_path,
        })
        .collect::<Vec<_>>();

    Ok(ArchivedSessionListPayload {
        filters,
        workspaces,
        sessions,
    })
}

fn normalize_filters(filters: ArchiveListFilters) -> ArchiveListFilters {
    ArchiveListFilters {
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

fn load_archived_threads(connection: &Connection) -> Result<Vec<ArchivedThreadRow>, CommandError> {
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
            where archived = 1
            order by updated_at desc, thread_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            Ok(ArchivedThreadRow {
                thread_id: row.get(0)?,
                title: row.get(1)?,
                cwd: row.get(2)?,
                archived: row.get::<_, i64>(3)? != 0,
                status: parse_status(row.get::<_, String>(4)?.as_str()),
                started_at: parse_timestamp(row.get(5)?),
                updated_at: parse_timestamp(row.get(6)?),
                latest_activity_summary: row.get(7)?,
                rollout_path: normalize_text(row.get::<_, Option<String>>(8)?),
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
    thread_ids: &HashSet<String>,
) -> Result<HashMap<String, Vec<String>>, CommandError> {
    if thread_ids.is_empty() {
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
        let (thread_id, agent_role) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if !thread_ids.contains(&thread_id) {
            continue;
        }

        let roles = roles_map.entry(thread_id).or_insert_with(Vec::new);
        if !roles.iter().any(|role| role == &agent_role) {
            roles.push(agent_role);
        }
    }

    Ok(roles_map)
}

fn matches_filters(thread: &ArchivedThreadRow, filters: &ArchiveListFilters) -> bool {
    if let Some(workspace) = filters.workspace.as_deref() {
        if thread.cwd != workspace {
            return false;
        }
    }

    if let Some(query) = filters.query.as_deref() {
        let query = query.to_lowercase();
        let haystacks = [
            thread.thread_id.to_lowercase(),
            thread.title.to_lowercase(),
            thread.cwd.to_lowercase(),
            thread
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
