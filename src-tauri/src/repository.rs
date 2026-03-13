use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::normalize::{
    CanonicalEvent, CanonicalSession, CanonicalSessionBundle, DetailLevel, EventKind,
    SessionStatus, SourceKind,
};

pub struct Repository {
    conn: Connection,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionSummaryRecord {
    pub session_id: String,
    pub workspace_path: String,
    pub title: Option<String>,
    pub status: SessionStatus,
    pub source_kind: SourceKind,
    pub is_archived: bool,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub last_event_at: Option<String>,
    pub event_count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PersistedSessionDetail {
    pub bundle: CanonicalSessionBundle,
    pub last_event_at: Option<String>,
    pub event_count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceSessionGroup {
    pub workspace_path: String,
    pub sessions: Vec<SessionSummaryRecord>,
}

pub type SessionSummary = SessionSummaryRecord;
pub type SessionDetailSnapshot = PersistedSessionDetail;

#[derive(Debug)]
pub enum RepositoryError {
    Open {
        path: PathBuf,
        source: rusqlite::Error,
    },
    Sql(rusqlite::Error),
    Serialize(serde_json::Error),
    Deserialize(serde_json::Error),
    InvalidEnum {
        field: &'static str,
        value: String,
    },
    EventSessionMismatch {
        bundle_session_id: String,
        event_id: String,
        event_session_id: String,
    },
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Open { path, source } => {
                write!(
                    f,
                    "failed to open repository {}: {}",
                    path.display(),
                    source
                )
            }
            Self::Sql(source) => write!(f, "repository query failed: {}", source),
            Self::Serialize(source) => write!(f, "repository serialization failed: {}", source),
            Self::Deserialize(source) => {
                write!(f, "repository deserialization failed: {}", source)
            }
            Self::InvalidEnum { field, value } => {
                write!(f, "invalid enum value for {}: {}", field, value)
            }
            Self::EventSessionMismatch {
                bundle_session_id,
                event_id,
                event_session_id,
            } => write!(
                f,
                "bundle session_id {} does not match event {} session_id {}",
                bundle_session_id, event_id, event_session_id
            ),
        }
    }
}

impl Error for RepositoryError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Open { source, .. } => Some(source),
            Self::Sql(source) => Some(source),
            Self::Serialize(source) => Some(source),
            Self::Deserialize(source) => Some(source),
            Self::InvalidEnum { .. } | Self::EventSessionMismatch { .. } => None,
        }
    }
}

impl Repository {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, RepositoryError> {
        let path = path.as_ref().to_path_buf();
        let conn = Connection::open(&path).map_err(|source| RepositoryError::Open {
            path: path.clone(),
            source,
        })?;
        initialize_schema(&conn)?;
        Ok(Self { conn })
    }

    pub fn upsert_session_bundle(
        &mut self,
        bundle: &CanonicalSessionBundle,
    ) -> Result<(), RepositoryError> {
        validate_bundle_session_ids(bundle)?;
        let transaction = self.conn.transaction().map_err(RepositoryError::Sql)?;
        transaction
            .execute(
                r#"
                INSERT INTO sessions (
                  session_id,
                  parent_session_id,
                  workspace_path,
                  title,
                  status,
                  started_at,
                  ended_at,
                  is_archived,
                  source_kind
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ON CONFLICT(session_id) DO UPDATE SET
                  parent_session_id = excluded.parent_session_id,
                  workspace_path = excluded.workspace_path,
                  title = excluded.title,
                  status = excluded.status,
                  started_at = excluded.started_at,
                  ended_at = excluded.ended_at,
                  is_archived = excluded.is_archived,
                  source_kind = excluded.source_kind
                "#,
                params![
                    bundle.session.session_id,
                    bundle.session.parent_session_id,
                    bundle.session.workspace_path,
                    bundle.session.title,
                    session_status_text(bundle.session.status),
                    bundle.session.started_at,
                    bundle.session.ended_at,
                    i64::from(bundle.session.is_archived),
                    source_kind_text(bundle.session.source_kind),
                ],
            )
            .map_err(RepositoryError::Sql)?;

        transaction
            .execute(
                "DELETE FROM timeline_events WHERE session_id = ?1",
                params![bundle.session.session_id],
            )
            .map_err(RepositoryError::Sql)?;

        for event in &bundle.events {
            transaction
                .execute(
                    r#"
                    INSERT INTO timeline_events (
                      event_id,
                      session_id,
                      parent_event_id,
                      agent_instance_id,
                      lane_id,
                      kind,
                      detail_level,
                      occurred_at,
                      duration_ms,
                      summary,
                      payload_preview,
                      payload_ref,
                      token_input,
                      token_output,
                      meta_json
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                    "#,
                    params![
                        event.event_id,
                        event.session_id,
                        event.parent_event_id,
                        event.agent_instance_id,
                        event.lane_id,
                        event_kind_text(event.kind),
                        detail_level_text(event.detail_level),
                        event.occurred_at,
                        event.duration_ms.map(|value| value as i64),
                        event.summary,
                        event.payload_preview,
                        event.payload_ref,
                        event.token_input.map(|value| value as i64),
                        event.token_output.map(|value| value as i64),
                        serde_json::to_string(&event.meta).map_err(RepositoryError::Serialize)?,
                    ],
                )
                .map_err(RepositoryError::Sql)?;
        }

        transaction.commit().map_err(RepositoryError::Sql)
    }

    pub fn list_session_summaries(&self) -> Result<Vec<SessionSummaryRecord>, RepositoryError> {
        let mut statement = self
            .conn
            .prepare(
                r#"
                SELECT
                  s.session_id,
                  s.workspace_path,
                  s.title,
                  s.status,
                  s.source_kind,
                  s.is_archived,
                  s.started_at,
                  s.ended_at,
                  MAX(e.occurred_at) AS last_event_at,
                  COUNT(e.event_id) AS event_count
                FROM sessions s
                LEFT JOIN timeline_events e ON e.session_id = s.session_id
                GROUP BY
                  s.session_id,
                  s.workspace_path,
                  s.title,
                  s.status,
                  s.source_kind,
                  s.is_archived,
                  s.started_at,
                  s.ended_at
                ORDER BY
                  s.workspace_path ASC,
                  last_event_at DESC,
                  s.session_id ASC
                "#,
            )
            .map_err(RepositoryError::Sql)?;

        let rows = statement
            .query_map([], |row| {
                Ok(RawSessionSummaryRecord {
                    session_id: row.get(0)?,
                    workspace_path: row.get(1)?,
                    title: row.get(2)?,
                    status: row.get(3)?,
                    source_kind: row.get(4)?,
                    is_archived: row.get::<_, i64>(5)? != 0,
                    started_at: row.get(6)?,
                    ended_at: row.get(7)?,
                    last_event_at: row.get(8)?,
                    event_count: row.get(9)?,
                })
            })
            .map_err(RepositoryError::Sql)?;

        let mut summaries = Vec::new();
        for row in rows {
            let row = row.map_err(RepositoryError::Sql)?;
            summaries.push(SessionSummaryRecord {
                session_id: row.session_id,
                workspace_path: row.workspace_path,
                title: row.title,
                status: parse_session_status(&row.status)?,
                source_kind: parse_source_kind(&row.source_kind)?,
                is_archived: row.is_archived,
                started_at: row.started_at,
                ended_at: row.ended_at,
                last_event_at: row.last_event_at,
                event_count: row.event_count as u64,
            });
        }

        Ok(summaries)
    }

    pub fn list_workspace_sessions(&self) -> Result<Vec<WorkspaceSessionGroup>, RepositoryError> {
        let summaries = self.list_session_summaries()?;
        let mut groups: Vec<WorkspaceSessionGroup> = Vec::new();

        for summary in summaries {
            let workspace_path = summary.workspace_path.clone();
            match groups.last_mut() {
                Some(group) if group.workspace_path == workspace_path => {
                    group.sessions.push(summary);
                }
                _ => groups.push(WorkspaceSessionGroup {
                    workspace_path,
                    sessions: vec![summary],
                }),
            }
        }

        Ok(groups)
    }

    pub fn load_session_summary(
        &self,
        session_id: &str,
    ) -> Result<Option<SessionSummaryRecord>, RepositoryError> {
        Ok(self
            .list_session_summaries()?
            .into_iter()
            .find(|summary| summary.session_id == session_id))
    }

    pub fn load_session_detail(
        &self,
        session_id: &str,
    ) -> Result<PersistedSessionDetail, RepositoryError> {
        let row = self
            .conn
            .query_row(
                r#"
                SELECT
                  session_id,
                  parent_session_id,
                  workspace_path,
                  title,
                  status,
                  started_at,
                  ended_at,
                  is_archived,
                  source_kind
                FROM sessions
                WHERE session_id = ?1
                "#,
                params![session_id],
                |row| {
                    Ok(RawSessionRecord {
                        session_id: row.get(0)?,
                        parent_session_id: row.get(1)?,
                        workspace_path: row.get(2)?,
                        title: row.get(3)?,
                        status: row.get(4)?,
                        started_at: row.get(5)?,
                        ended_at: row.get(6)?,
                        is_archived: row.get::<_, i64>(7)? != 0,
                        source_kind: row.get(8)?,
                    })
                },
            )
            .map_err(RepositoryError::Sql)?;

        let session = CanonicalSession {
            session_id: row.session_id,
            parent_session_id: row.parent_session_id,
            workspace_path: row.workspace_path,
            title: row.title,
            status: parse_session_status(&row.status)?,
            started_at: row.started_at,
            ended_at: row.ended_at,
            is_archived: row.is_archived,
            source_kind: parse_source_kind(&row.source_kind)?,
        };

        let mut statement = self
            .conn
            .prepare(
                r#"
                SELECT
                  event_id,
                  session_id,
                  parent_event_id,
                  agent_instance_id,
                  lane_id,
                  kind,
                  detail_level,
                  occurred_at,
                  duration_ms,
                  summary,
                  payload_preview,
                  payload_ref,
                  token_input,
                  token_output,
                  meta_json
                FROM timeline_events
                WHERE session_id = ?1
                ORDER BY occurred_at ASC, event_id ASC
                "#,
            )
            .map_err(RepositoryError::Sql)?;

        let rows = statement
            .query_map(params![session_id], |row| {
                Ok(RawEventRecord {
                    event_id: row.get(0)?,
                    session_id: row.get(1)?,
                    parent_event_id: row.get(2)?,
                    agent_instance_id: row.get(3)?,
                    lane_id: row.get(4)?,
                    kind: row.get(5)?,
                    detail_level: row.get(6)?,
                    occurred_at: row.get(7)?,
                    duration_ms: row.get::<_, Option<i64>>(8)?,
                    summary: row.get(9)?,
                    payload_preview: row.get(10)?,
                    payload_ref: row.get(11)?,
                    token_input: row.get::<_, Option<i64>>(12)?,
                    token_output: row.get::<_, Option<i64>>(13)?,
                    meta_json: row.get(14)?,
                })
            })
            .map_err(RepositoryError::Sql)?;

        let mut events = Vec::new();
        for row in rows {
            let row = row.map_err(RepositoryError::Sql)?;
            events.push(CanonicalEvent {
                event_id: row.event_id,
                session_id: row.session_id,
                parent_event_id: row.parent_event_id,
                agent_instance_id: row.agent_instance_id,
                lane_id: row.lane_id,
                kind: parse_event_kind(&row.kind)?,
                detail_level: parse_detail_level(&row.detail_level)?,
                occurred_at: row.occurred_at,
                duration_ms: row.duration_ms.map(|value| value as u64),
                summary: row.summary,
                payload_preview: row.payload_preview,
                payload_ref: row.payload_ref,
                token_input: row.token_input.map(|value| value as u64),
                token_output: row.token_output.map(|value| value as u64),
                meta: serde_json::from_str::<Map<String, Value>>(&row.meta_json)
                    .map_err(RepositoryError::Deserialize)?,
            });
        }

        let event_count = events.len() as u64;
        let last_event_at = events.last().map(|event| event.occurred_at.clone());

        Ok(PersistedSessionDetail {
            bundle: CanonicalSessionBundle {
                session,
                events,
                metrics: Vec::new(),
            },
            last_event_at,
            event_count,
        })
    }

    pub fn session_event_counts(&self, session_id: &str) -> Result<i64, RepositoryError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM timeline_events WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .map_err(RepositoryError::Sql)
    }

    pub fn current_timestamp(&self) -> Result<String, RepositoryError> {
        self.conn
            .query_row("SELECT STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| {
                row.get(0)
            })
            .map_err(RepositoryError::Sql)
    }
}

#[derive(Debug)]
struct RawSessionSummaryRecord {
    session_id: String,
    workspace_path: String,
    title: Option<String>,
    status: String,
    source_kind: String,
    is_archived: bool,
    started_at: String,
    ended_at: Option<String>,
    last_event_at: Option<String>,
    event_count: i64,
}

#[derive(Debug)]
struct RawSessionRecord {
    session_id: String,
    parent_session_id: Option<String>,
    workspace_path: String,
    title: Option<String>,
    status: String,
    started_at: String,
    ended_at: Option<String>,
    is_archived: bool,
    source_kind: String,
}

#[derive(Debug)]
struct RawEventRecord {
    event_id: String,
    session_id: String,
    parent_event_id: Option<String>,
    agent_instance_id: Option<String>,
    lane_id: String,
    kind: String,
    detail_level: String,
    occurred_at: String,
    duration_ms: Option<i64>,
    summary: Option<String>,
    payload_preview: Option<String>,
    payload_ref: Option<String>,
    token_input: Option<i64>,
    token_output: Option<i64>,
    meta_json: String,
}

fn initialize_schema(conn: &Connection) -> Result<(), RepositoryError> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          parent_session_id TEXT,
          workspace_path TEXT NOT NULL,
          title TEXT,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          is_archived INTEGER NOT NULL,
          source_kind TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS timeline_events (
          event_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          parent_event_id TEXT,
          agent_instance_id TEXT,
          lane_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          detail_level TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          duration_ms INTEGER,
          summary TEXT,
          payload_preview TEXT,
          payload_ref TEXT,
          token_input INTEGER,
          token_output INTEGER,
          meta_json TEXT NOT NULL,
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS parser_checkpoints (
          session_id TEXT PRIMARY KEY,
          byte_offset INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_timeline_events_session_id
          ON timeline_events(session_id, occurred_at);
        "#,
    )
    .map_err(RepositoryError::Sql)
}

fn session_status_text(value: SessionStatus) -> &'static str {
    value.as_str()
}

fn source_kind_text(value: SourceKind) -> &'static str {
    value.as_str()
}

fn event_kind_text(value: EventKind) -> &'static str {
    value.as_str()
}

fn detail_level_text(value: DetailLevel) -> &'static str {
    value.as_str()
}

fn parse_session_status(value: &str) -> Result<SessionStatus, RepositoryError> {
    match value {
        "live" => Ok(SessionStatus::Live),
        "archived" => Ok(SessionStatus::Archived),
        "stalled" => Ok(SessionStatus::Stalled),
        "aborted" => Ok(SessionStatus::Aborted),
        "completed" => Ok(SessionStatus::Completed),
        _ => Err(RepositoryError::InvalidEnum {
            field: "sessions.status",
            value: value.to_string(),
        }),
    }
}

fn parse_source_kind(value: &str) -> Result<SourceKind, RepositoryError> {
    match value {
        "session_log" => Ok(SourceKind::SessionLog),
        "archive_log" => Ok(SourceKind::ArchiveLog),
        _ => Err(RepositoryError::InvalidEnum {
            field: "sessions.source_kind",
            value: value.to_string(),
        }),
    }
}

fn parse_event_kind(value: &str) -> Result<EventKind, RepositoryError> {
    match value {
        "session_start" => Ok(EventKind::SessionStart),
        "user_message" => Ok(EventKind::UserMessage),
        "agent_message" => Ok(EventKind::AgentMessage),
        "reasoning" => Ok(EventKind::Reasoning),
        "tool_call" => Ok(EventKind::ToolCall),
        "tool_output" => Ok(EventKind::ToolOutput),
        "tool_span" => Ok(EventKind::ToolSpan),
        "spawn" => Ok(EventKind::Spawn),
        "agent_complete" => Ok(EventKind::AgentComplete),
        "token_delta" => Ok(EventKind::TokenDelta),
        "error" => Ok(EventKind::Error),
        "turn_aborted" => Ok(EventKind::TurnAborted),
        _ => Err(RepositoryError::InvalidEnum {
            field: "timeline_events.kind",
            value: value.to_string(),
        }),
    }
}

fn parse_detail_level(value: &str) -> Result<DetailLevel, RepositoryError> {
    match value {
        "operational" => Ok(DetailLevel::Operational),
        "diagnostic" => Ok(DetailLevel::Diagnostic),
        "raw" => Ok(DetailLevel::Raw),
        _ => Err(RepositoryError::InvalidEnum {
            field: "timeline_events.detail_level",
            value: value.to_string(),
        }),
    }
}

fn validate_bundle_session_ids(bundle: &CanonicalSessionBundle) -> Result<(), RepositoryError> {
    if let Some(event) = bundle
        .events
        .iter()
        .find(|event| event.session_id != bundle.session.session_id)
    {
        return Err(RepositoryError::EventSessionMismatch {
            bundle_session_id: bundle.session.session_id.clone(),
            event_id: event.event_id.clone(),
            event_session_id: event.session_id.clone(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn refreshes_session_without_duplicate_events() {
        let db_path = temp_db_path("refresh");
        let mut repository = Repository::open(&db_path).expect("expected repository open");
        let bundle = sample_bundle(
            "session-1",
            "/tmp/workspace-a",
            vec![sample_event(
                "event-1",
                "session-1",
                "2026-03-12T06:33:43.000Z",
                "Task complete",
            )],
        );

        repository
            .upsert_session_bundle(&bundle)
            .expect("expected first insert");
        repository
            .upsert_session_bundle(&bundle)
            .expect("expected second insert");

        let event_count = repository
            .session_event_counts("session-1")
            .expect("expected event count");
        assert_eq!(event_count, 1);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn stores_enum_fields_as_plain_text() {
        let db_path = temp_db_path("enum-text");
        let mut repository = Repository::open(&db_path).expect("expected repository open");
        let bundle = sample_bundle(
            "session-plain",
            "/tmp/workspace-a",
            vec![sample_event(
                "event-plain",
                "session-plain",
                "2026-03-12T06:33:43.000Z",
                "Task complete",
            )],
        );

        repository
            .upsert_session_bundle(&bundle)
            .expect("expected insert");

        let status: String = repository
            .conn
            .query_row(
                "SELECT status FROM sessions WHERE session_id = ?1",
                params!["session-plain"],
                |row| row.get(0),
            )
            .expect("expected session status");
        let source_kind: String = repository
            .conn
            .query_row(
                "SELECT source_kind FROM sessions WHERE session_id = ?1",
                params!["session-plain"],
                |row| row.get(0),
            )
            .expect("expected session source_kind");
        let kind: String = repository
            .conn
            .query_row(
                "SELECT kind FROM timeline_events WHERE event_id = ?1",
                params!["event-plain"],
                |row| row.get(0),
            )
            .expect("expected event kind");
        let detail_level: String = repository
            .conn
            .query_row(
                "SELECT detail_level FROM timeline_events WHERE event_id = ?1",
                params!["event-plain"],
                |row| row.get(0),
            )
            .expect("expected event detail level");

        assert_eq!(status, "completed");
        assert_eq!(source_kind, "session_log");
        assert_eq!(kind, "agent_complete");
        assert_eq!(detail_level, "operational");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn lists_session_summaries_by_workspace_and_last_event() {
        let db_path = temp_db_path("summaries");
        let mut repository = Repository::open(&db_path).expect("expected repository open");

        repository
            .upsert_session_bundle(&sample_bundle(
                "session-a-older",
                "/tmp/workspace-a",
                vec![sample_event(
                    "event-a-older",
                    "session-a-older",
                    "2026-03-12T06:33:43.000Z",
                    "older",
                )],
            ))
            .expect("expected insert");
        repository
            .upsert_session_bundle(&sample_bundle(
                "session-a-newer",
                "/tmp/workspace-a",
                vec![
                    sample_event(
                        "event-a-newer-2",
                        "session-a-newer",
                        "2026-03-12T06:33:45.000Z",
                        "later",
                    ),
                    sample_event(
                        "event-a-newer-1",
                        "session-a-newer",
                        "2026-03-12T06:33:44.000Z",
                        "earlier",
                    ),
                ],
            ))
            .expect("expected insert");
        repository
            .upsert_session_bundle(&sample_bundle(
                "session-b-only",
                "/tmp/workspace-b",
                vec![sample_event(
                    "event-b-only",
                    "session-b-only",
                    "2026-03-12T06:33:40.000Z",
                    "workspace-b",
                )],
            ))
            .expect("expected insert");

        let summaries = repository
            .list_session_summaries()
            .expect("expected session summaries");

        assert_eq!(summaries.len(), 3);
        assert_eq!(summaries[0].workspace_path, "/tmp/workspace-a");
        assert_eq!(summaries[0].session_id, "session-a-newer");
        assert_eq!(summaries[0].event_count, 2);
        assert_eq!(
            summaries[0].last_event_at.as_deref(),
            Some("2026-03-12T06:33:45.000Z")
        );
        assert_eq!(summaries[1].session_id, "session-a-older");
        assert_eq!(summaries[2].workspace_path, "/tmp/workspace-b");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn loads_session_detail_round_trip_in_event_time_order() {
        let db_path = temp_db_path("detail");
        let mut repository = Repository::open(&db_path).expect("expected repository open");
        let bundle = sample_bundle(
            "session-detail",
            "/tmp/workspace-a",
            vec![
                sample_event(
                    "event-late",
                    "session-detail",
                    "2026-03-12T06:33:45.000Z",
                    "later",
                ),
                sample_event(
                    "event-early",
                    "session-detail",
                    "2026-03-12T06:33:44.000Z",
                    "earlier",
                ),
            ],
        );

        repository
            .upsert_session_bundle(&bundle)
            .expect("expected insert");

        let detail = repository
            .load_session_detail("session-detail")
            .expect("expected session detail");

        assert_eq!(detail.event_count, 2);
        assert_eq!(
            detail.last_event_at.as_deref(),
            Some("2026-03-12T06:33:45.000Z")
        );
        assert_eq!(detail.bundle.session.session_id, "session-detail");
        assert_eq!(detail.bundle.events[0].event_id, "event-early");
        assert_eq!(detail.bundle.events[1].event_id, "event-late");
        assert_eq!(detail.bundle.events[0].summary.as_deref(), Some("earlier"));
        assert_eq!(detail.bundle.events[1].summary.as_deref(), Some("later"));

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn rejects_mixed_session_bundles_before_sql_insert() {
        let db_path = temp_db_path("mixed-session");
        let mut repository = Repository::open(&db_path).expect("expected repository open");
        let bundle = sample_bundle(
            "session-owner",
            "/tmp/workspace-a",
            vec![sample_event(
                "event-foreign",
                "session-foreign",
                "2026-03-12T06:33:45.000Z",
                "foreign",
            )],
        );

        let error = repository
            .upsert_session_bundle(&bundle)
            .expect_err("expected mixed session bundle rejection");

        assert!(matches!(
            error,
            RepositoryError::EventSessionMismatch {
                bundle_session_id,
                event_id,
                event_session_id,
            } if bundle_session_id == "session-owner"
                && event_id == "event-foreign"
                && event_session_id == "session-foreign"
        ));

        let session_count: i64 = repository
            .conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .expect("expected session count");
        let event_count: i64 = repository
            .conn
            .query_row("SELECT COUNT(*) FROM timeline_events", [], |row| row.get(0))
            .expect("expected event count");

        assert_eq!(session_count, 0);
        assert_eq!(event_count, 0);

        let _ = fs::remove_file(db_path);
    }

    fn sample_bundle(
        session_id: &str,
        workspace_path: &str,
        events: Vec<CanonicalEvent>,
    ) -> CanonicalSessionBundle {
        CanonicalSessionBundle {
            session: CanonicalSession {
                session_id: session_id.to_string(),
                parent_session_id: None,
                workspace_path: workspace_path.to_string(),
                title: Some("hello".to_string()),
                status: SessionStatus::Completed,
                started_at: "2026-03-12T06:33:38.907Z".to_string(),
                ended_at: Some("2026-03-12T06:33:45.000Z".to_string()),
                is_archived: false,
                source_kind: SourceKind::SessionLog,
            },
            events,
            metrics: Vec::new(),
        }
    }

    fn sample_event(
        event_id: &str,
        session_id: &str,
        occurred_at: &str,
        summary: &str,
    ) -> CanonicalEvent {
        CanonicalEvent {
            event_id: event_id.to_string(),
            session_id: session_id.to_string(),
            parent_event_id: None,
            agent_instance_id: Some(session_id.to_string()),
            lane_id: "main".to_string(),
            kind: EventKind::AgentComplete,
            detail_level: DetailLevel::Operational,
            occurred_at: occurred_at.to_string(),
            duration_ms: None,
            summary: Some(summary.to_string()),
            payload_preview: None,
            payload_ref: None,
            token_input: None,
            token_output: None,
            meta: Map::<String, Value>::new(),
        }
    }

    fn temp_db_path(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("expected time after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("codex-monitor-{name}-{suffix}.sqlite"))
    }
}
