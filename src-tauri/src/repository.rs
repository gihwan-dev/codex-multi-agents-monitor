use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};

use crate::normalize::{CanonicalSessionBundle, DetailLevel, EventKind, SessionStatus, SourceKind};

pub struct Repository {
    conn: Connection,
}

#[derive(Debug)]
pub enum RepositoryError {
    Open {
        path: PathBuf,
        source: rusqlite::Error,
    },
    Sql(rusqlite::Error),
    Serialize(serde_json::Error),
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
        }
    }
}

impl Error for RepositoryError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Open { source, .. } => Some(source),
            Self::Sql(source) => Some(source),
            Self::Serialize(source) => Some(source),
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

    pub fn session_event_counts(&self, session_id: &str) -> Result<i64, RepositoryError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM timeline_events WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .map_err(RepositoryError::Sql)
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_json::{Map, Value};

    use crate::normalize::{
        CanonicalEvent, CanonicalSession, CanonicalSessionBundle, DetailLevel, EventKind,
        SessionStatus, SourceKind,
    };

    #[test]
    fn refreshes_session_without_duplicate_events() {
        let db_path = temp_db_path("refresh");
        let mut repository = Repository::open(&db_path).expect("expected repository open");
        let bundle = sample_bundle("session-1", "event-1");

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
        let bundle = sample_bundle("session-plain", "event-plain");

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

    fn sample_bundle(session_id: &str, event_id: &str) -> CanonicalSessionBundle {
        CanonicalSessionBundle {
            session: CanonicalSession {
                session_id: session_id.to_string(),
                parent_session_id: None,
                workspace_path: "/tmp/workspace".to_string(),
                title: Some("hello".to_string()),
                status: SessionStatus::Completed,
                started_at: "2026-03-12T06:33:38.907Z".to_string(),
                ended_at: Some("2026-03-12T06:33:43.000Z".to_string()),
                is_archived: false,
                source_kind: SourceKind::SessionLog,
            },
            events: vec![CanonicalEvent {
                event_id: event_id.to_string(),
                session_id: session_id.to_string(),
                parent_event_id: None,
                agent_instance_id: Some(session_id.to_string()),
                lane_id: "main".to_string(),
                kind: EventKind::AgentComplete,
                detail_level: DetailLevel::Operational,
                occurred_at: "2026-03-12T06:33:43.000Z".to_string(),
                duration_ms: None,
                summary: Some("Task complete".to_string()),
                payload_preview: None,
                payload_ref: None,
                token_input: None,
                token_output: None,
                meta: Map::<String, Value>::new(),
            }],
            metrics: Vec::new(),
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
