use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader};

use chrono::{DateTime, Duration, Utc};
use rusqlite::Connection;
use serde_json::Value;

use crate::commands::error::CommandError;
use crate::domain::{
    HistoryHealth, HistoryRoleSummary, HistorySlowThread, HistorySourceKey, HistorySummary,
    HistorySummaryPayload,
};
use crate::index_db::open_monitor_db;
use crate::state::AppState;

use super::decode::parse_timestamp;

const HISTORY_WINDOW_DAYS: i64 = 6;
const MAX_SLOW_THREADS: usize = 8;
const SOURCE_STATUS_MISSING: &str = "missing";
const SOURCE_STATUS_DEGRADED: &str = "degraded";

#[derive(Debug)]
struct ThreadCandidateRow {
    thread_id: String,
    title: String,
    cwd: String,
    rollout_path: String,
    updated_at: DateTime<Utc>,
    latest_activity_summary: Option<String>,
    duration_ms: Option<u64>,
}

#[derive(Debug)]
struct AgentSessionRow {
    session_id: String,
    thread_id: String,
    agent_role: String,
    duration_ms: Option<u64>,
}

#[derive(Debug, Default, Clone)]
struct ThreadDerivedMetrics {
    spawn_count: u32,
    timeout_count: u32,
    role_timeout_counts: HashMap<String, u32>,
}

#[derive(Debug, Default)]
struct RolloutMetricsSummary {
    metrics_by_thread: HashMap<String, ThreadDerivedMetrics>,
    degraded_rollout_threads: u32,
}

#[derive(Debug, Default)]
struct RolloutMetricsResult {
    metrics: ThreadDerivedMetrics,
    degraded: bool,
}

#[derive(Debug, Default)]
struct RoleAccumulator {
    session_count: u32,
    spawn_count: u32,
    timeout_count: u32,
    duration_sum_ms: u64,
    duration_count: u32,
}

#[derive(Debug, Default)]
struct WaitCallRecord {
    argument_ids: Vec<String>,
}

pub(super) fn build_history_summary(
    state: &AppState,
) -> Result<HistorySummaryPayload, CommandError> {
    build_history_summary_at(state, Utc::now())
}

pub(super) fn build_history_summary_at(
    state: &AppState,
    now: DateTime<Utc>,
) -> Result<HistorySummaryPayload, CommandError> {
    let connection =
        open_monitor_db(state).map_err(|error| CommandError::Internal(error.to_string()))?;
    let window_start = now - Duration::days(HISTORY_WINDOW_DAYS);
    let threads = load_candidate_threads(&connection, window_start, now)?;
    let thread_ids = threads
        .iter()
        .map(|thread| thread.thread_id.clone())
        .collect::<HashSet<_>>();
    let sessions = load_agent_sessions(&connection, &thread_ids)?;
    let agent_roles_by_thread = collect_agent_roles_by_thread(&sessions);
    let session_role_map = sessions
        .iter()
        .map(|session| (session.session_id.clone(), session.agent_role.clone()))
        .collect::<HashMap<_, _>>();
    let rollout_metrics = collect_thread_metrics(&threads, &session_role_map);
    let thread_metrics = &rollout_metrics.metrics_by_thread;
    let recorded_source_health = load_recorded_source_health(&connection)?;

    let thread_count = u32::try_from(threads.len()).unwrap_or(u32::MAX);
    let average_duration_ms =
        average_duration_ms(threads.iter().filter_map(|thread| thread.duration_ms));
    let timeout_count = threads
        .iter()
        .map(|thread| {
            thread_metrics
                .get(&thread.thread_id)
                .map(|metrics| metrics.timeout_count)
                .unwrap_or_default()
        })
        .sum();
    let spawn_count = threads
        .iter()
        .map(|thread| {
            thread_metrics
                .get(&thread.thread_id)
                .map(|metrics| metrics.spawn_count)
                .unwrap_or_default()
        })
        .sum();

    let mut role_accumulators = BTreeMap::<String, RoleAccumulator>::new();
    for session in &sessions {
        let accumulator = role_accumulators
            .entry(session.agent_role.clone())
            .or_default();
        accumulator.session_count += 1;
        accumulator.spawn_count += 1;
        if let Some(duration_ms) = session.duration_ms {
            accumulator.duration_sum_ms = accumulator.duration_sum_ms.saturating_add(duration_ms);
            accumulator.duration_count += 1;
        }
    }

    for metrics in thread_metrics.values() {
        for (agent_role, timeout_count) in &metrics.role_timeout_counts {
            role_accumulators
                .entry(agent_role.clone())
                .or_default()
                .timeout_count += *timeout_count;
        }
    }

    let mut roles = role_accumulators
        .into_iter()
        .map(|(agent_role, accumulator)| HistoryRoleSummary {
            agent_role,
            session_count: accumulator.session_count,
            average_duration_ms: if accumulator.duration_count == 0 {
                None
            } else {
                Some(accumulator.duration_sum_ms / u64::from(accumulator.duration_count))
            },
            timeout_count: accumulator.timeout_count,
            spawn_count: accumulator.spawn_count,
        })
        .collect::<Vec<_>>();
    roles.sort_by(|left, right| {
        right
            .spawn_count
            .cmp(&left.spawn_count)
            .then_with(|| right.timeout_count.cmp(&left.timeout_count))
            .then_with(|| left.agent_role.cmp(&right.agent_role))
    });

    let mut slow_threads = threads
        .into_iter()
        .map(|thread| {
            let metrics = thread_metrics
                .get(&thread.thread_id)
                .cloned()
                .unwrap_or_default();

            HistorySlowThread {
                thread_id: thread.thread_id.clone(),
                title: thread.title,
                cwd: thread.cwd,
                updated_at: thread.updated_at,
                latest_activity_summary: thread.latest_activity_summary,
                duration_ms: thread.duration_ms,
                timeout_count: metrics.timeout_count,
                spawn_count: metrics.spawn_count,
                agent_roles: agent_roles_by_thread
                    .get(&thread.thread_id)
                    .cloned()
                    .unwrap_or_default(),
                rollout_path: normalize_optional_text(&thread.rollout_path),
            }
        })
        .collect::<Vec<_>>();
    slow_threads.sort_by(|left, right| {
        right
            .duration_ms
            .unwrap_or_default()
            .cmp(&left.duration_ms.unwrap_or_default())
            .then_with(|| right.timeout_count.cmp(&left.timeout_count))
            .then_with(|| right.updated_at.cmp(&left.updated_at))
            .then_with(|| left.thread_id.cmp(&right.thread_id))
    });
    slow_threads.truncate(MAX_SLOW_THREADS);

    Ok(HistorySummaryPayload {
        history: HistorySummary {
            from_date: window_start.date_naive().to_string(),
            to_date: now.date_naive().to_string(),
            thread_count,
            average_duration_ms,
            timeout_count,
            spawn_count,
        },
        health: HistoryHealth {
            missing_sources: merge_source_keys(
                detect_missing_sources(state),
                recorded_source_health.missing_sources,
            ),
            degraded_sources: recorded_source_health.degraded_sources,
            degraded_rollout_threads: rollout_metrics.degraded_rollout_threads,
        },
        roles,
        slow_threads,
    })
}

fn load_candidate_threads(
    connection: &Connection,
    window_start: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<Vec<ThreadCandidateRow>, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              thread_id,
              title,
              cwd,
              rollout_path,
              started_at,
              updated_at,
              latest_activity_summary
            from threads
            where status = 'completed'
              and updated_at is not null
            order by updated_at desc, thread_id asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut threads = Vec::new();
    for row in rows {
        let (thread_id, title, cwd, rollout_path, started_at, updated_at, latest_activity_summary) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let Some(updated_at) = parse_timestamp(updated_at) else {
            continue;
        };
        if updated_at < window_start || updated_at > now {
            continue;
        }

        threads.push(ThreadCandidateRow {
            thread_id,
            title,
            cwd,
            rollout_path,
            updated_at,
            latest_activity_summary,
            duration_ms: duration_ms_from_started_at(started_at.as_deref(), updated_at),
        });
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
              session_id,
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
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut sessions = Vec::new();
    for row in rows {
        let (session_id, thread_id, agent_role, started_at, updated_at) =
            row.map_err(|error| CommandError::Internal(error.to_string()))?;
        if !thread_ids.contains(&thread_id) {
            continue;
        }

        sessions.push(AgentSessionRow {
            session_id,
            thread_id,
            agent_role,
            duration_ms: duration_ms_between(started_at.as_deref(), updated_at.as_deref()),
        });
    }

    Ok(sessions)
}

fn collect_agent_roles_by_thread(sessions: &[AgentSessionRow]) -> HashMap<String, Vec<String>> {
    let mut roles_by_thread = HashMap::<String, BTreeSet<String>>::new();
    for session in sessions {
        roles_by_thread
            .entry(session.thread_id.clone())
            .or_default()
            .insert(session.agent_role.clone());
    }

    roles_by_thread
        .into_iter()
        .map(|(thread_id, roles)| (thread_id, roles.into_iter().collect::<Vec<_>>()))
        .collect()
}

fn collect_thread_metrics(
    threads: &[ThreadCandidateRow],
    session_role_map: &HashMap<String, String>,
) -> RolloutMetricsSummary {
    let mut metrics_by_thread = HashMap::with_capacity(threads.len());
    let mut degraded_rollout_threads = 0;

    for thread in threads {
        let result = collect_metrics_from_rollout(&thread.rollout_path, session_role_map);
        if result.degraded {
            degraded_rollout_threads += 1;
        }
        metrics_by_thread.insert(thread.thread_id.clone(), result.metrics);
    }

    RolloutMetricsSummary {
        metrics_by_thread,
        degraded_rollout_threads,
    }
}

fn collect_metrics_from_rollout(
    rollout_path: &str,
    session_role_map: &HashMap<String, String>,
) -> RolloutMetricsResult {
    let Some(rollout_path) = normalize_optional_text(rollout_path) else {
        return RolloutMetricsResult {
            degraded: true,
            ..RolloutMetricsResult::default()
        };
    };
    let Ok(metadata) = std::fs::metadata(&rollout_path) else {
        return RolloutMetricsResult {
            degraded: true,
            ..RolloutMetricsResult::default()
        };
    };
    if !metadata.is_file() {
        return RolloutMetricsResult {
            degraded: true,
            ..RolloutMetricsResult::default()
        };
    }
    let Ok(file) = File::open(&rollout_path) else {
        return RolloutMetricsResult {
            degraded: true,
            ..RolloutMetricsResult::default()
        };
    };

    let reader = BufReader::new(file);
    let mut result = RolloutMetricsResult::default();
    let mut wait_calls = HashMap::<String, WaitCallRecord>::new();

    for line in reader.lines() {
        let Ok(line) = line else {
            result.degraded = true;
            break;
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            result.degraded = true;
            continue;
        };
        if value.get("type").and_then(Value::as_str) != Some("response_item") {
            continue;
        }

        let Some(payload) = value.get("payload") else {
            continue;
        };
        match payload.get("type").and_then(Value::as_str) {
            Some("function_call") => {
                let Some(call_id) = payload
                    .get("call_id")
                    .and_then(Value::as_str)
                    .and_then(normalize_optional_text)
                else {
                    continue;
                };
                match payload
                    .get("name")
                    .and_then(Value::as_str)
                    .and_then(normalize_optional_text)
                    .as_deref()
                {
                    Some("spawn_agent") => result.metrics.spawn_count += 1,
                    Some("wait") => {
                        wait_calls.insert(
                            call_id,
                            WaitCallRecord {
                                argument_ids: parse_wait_argument_ids(payload.get("arguments")),
                            },
                        );
                    }
                    _ => {}
                }
            }
            Some("function_call_output") => {
                let Some(call_id) = payload
                    .get("call_id")
                    .and_then(Value::as_str)
                    .and_then(normalize_optional_text)
                else {
                    continue;
                };
                let Some(output) = parse_embedded_json(payload.get("output")) else {
                    continue;
                };
                let Some(wait_record) = wait_calls.get(&call_id) else {
                    continue;
                };
                if output.get("timed_out").and_then(Value::as_bool) != Some(true) {
                    continue;
                }

                result.metrics.timeout_count += 1;
                if let Some(session_id) = resolve_wait_child_session_id(wait_record, &output) {
                    if let Some(agent_role) = session_role_map.get(&session_id) {
                        *result
                            .metrics
                            .role_timeout_counts
                            .entry(agent_role.clone())
                            .or_default() += 1;
                    }
                }
            }
            _ => {}
        }
    }

    result
}

fn detect_missing_sources(state: &AppState) -> Vec<HistorySourceKey> {
    let mut missing_sources = Vec::new();

    if !state.source_paths.live_sessions_dir.is_dir() {
        missing_sources.push(HistorySourceKey::LiveSessions);
    }
    if !state.source_paths.archived_sessions_dir.is_dir() {
        missing_sources.push(HistorySourceKey::ArchivedSessions);
    }
    if !state.source_paths.state_db_path.is_file() {
        missing_sources.push(HistorySourceKey::StateDb);
    }

    missing_sources
}

#[derive(Debug, Default)]
struct RecordedSourceHealth {
    missing_sources: Vec<HistorySourceKey>,
    degraded_sources: Vec<HistorySourceKey>,
}

fn load_recorded_source_health(
    connection: &Connection,
) -> Result<RecordedSourceHealth, CommandError> {
    let mut statement = connection
        .prepare(
            "
            select
              source_key,
              status
            from ingest_source_health
            order by source_key asc
            ",
        )
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| CommandError::Internal(error.to_string()))?;

    let mut missing_sources = Vec::new();
    let mut degraded_sources = Vec::new();

    for row in rows {
        let (source_key, status) = row.map_err(|error| CommandError::Internal(error.to_string()))?;
        let Some(source_key) = parse_source_key(&source_key) else {
            continue;
        };
        match status.as_str() {
            SOURCE_STATUS_MISSING => missing_sources.push(source_key),
            SOURCE_STATUS_DEGRADED => degraded_sources.push(source_key),
            _ => {}
        }
    }

    Ok(RecordedSourceHealth {
        missing_sources: sort_and_dedup_source_keys(missing_sources),
        degraded_sources: sort_and_dedup_source_keys(degraded_sources),
    })
}

fn merge_source_keys(
    base: Vec<HistorySourceKey>,
    additional: Vec<HistorySourceKey>,
) -> Vec<HistorySourceKey> {
    let mut merged = base;
    merged.extend(additional);
    sort_and_dedup_source_keys(merged)
}

fn sort_and_dedup_source_keys(mut sources: Vec<HistorySourceKey>) -> Vec<HistorySourceKey> {
    sources.sort_by_key(source_order_key);
    sources.dedup();
    sources
}

fn source_order_key(source: &HistorySourceKey) -> usize {
    match source {
        HistorySourceKey::LiveSessions => 0,
        HistorySourceKey::ArchivedSessions => 1,
        HistorySourceKey::StateDb => 2,
    }
}

fn parse_source_key(raw: &str) -> Option<HistorySourceKey> {
    match raw {
        "live_sessions" => Some(HistorySourceKey::LiveSessions),
        "archived_sessions" => Some(HistorySourceKey::ArchivedSessions),
        "state_db" => Some(HistorySourceKey::StateDb),
        _ => None,
    }
}

fn parse_wait_argument_ids(raw_arguments: Option<&Value>) -> Vec<String> {
    parse_embedded_json(raw_arguments)
        .and_then(|arguments| arguments.get("ids").cloned())
        .and_then(|ids| ids.as_array().cloned())
        .map(|ids| {
            ids.into_iter()
                .filter_map(|value| value.as_str().and_then(normalize_optional_text))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn resolve_wait_child_session_id(wait_record: &WaitCallRecord, output: &Value) -> Option<String> {
    if wait_record.argument_ids.len() == 1 {
        return wait_record.argument_ids.first().cloned();
    }

    let mut status_ids = output
        .get("status")
        .and_then(Value::as_object)
        .map(|status| {
            status
                .keys()
                .filter_map(|session_id| normalize_optional_text(session_id))
                .collect::<BTreeSet<_>>()
        })
        .unwrap_or_default()
        .into_iter()
        .collect::<Vec<_>>();
    if status_ids.len() == 1 {
        return status_ids.pop();
    }

    None
}

fn duration_ms_between(started_at: Option<&str>, ended_at: Option<&str>) -> Option<u64> {
    let started_at = parse_timestamp(started_at.map(str::to_string))?;
    let ended_at = parse_timestamp(ended_at.map(str::to_string))?;
    let duration_ms = ended_at
        .signed_duration_since(started_at)
        .num_milliseconds();
    u64::try_from(duration_ms.max(0)).ok()
}

fn duration_ms_from_started_at(started_at: Option<&str>, ended_at: DateTime<Utc>) -> Option<u64> {
    let started_at = parse_timestamp(started_at.map(str::to_string))?;
    let duration_ms = ended_at
        .signed_duration_since(started_at)
        .num_milliseconds();
    u64::try_from(duration_ms.max(0)).ok()
}

fn average_duration_ms(values: impl Iterator<Item = u64>) -> Option<u64> {
    let mut sum = 0_u64;
    let mut count = 0_u64;
    for value in values {
        sum = sum.saturating_add(value);
        count += 1;
    }

    if count == 0 {
        None
    } else {
        Some(sum / count)
    }
}

fn parse_embedded_json(value: Option<&Value>) -> Option<Value> {
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

fn normalize_optional_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
