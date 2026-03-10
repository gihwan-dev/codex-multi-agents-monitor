use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rusqlite::params;
use serde_json::Value;

use crate::index_db::open_monitor_db;
use crate::state::AppState;

const STATUS_COMPLETED: &str = "completed";
const STATUS_INFLIGHT: &str = "inflight";

#[derive(Debug, Clone, PartialEq, Eq)]
struct ThreadOverviewRow {
    thread_id: String,
    title: String,
    cwd: String,
    status: String,
    started_at: Option<String>,
    updated_at: Option<String>,
    latest_activity_summary: Option<String>,
}

#[derive(Debug, Default)]
struct SessionAccumulator {
    saw_session_meta: bool,
    is_main_thread: bool,
    thread_id: Option<String>,
    cwd: Option<String>,
    started_at: Option<String>,
    updated_at: Option<String>,
    has_task_complete: bool,
    title: Option<String>,
    last_agent_message: Option<String>,
    task_complete_last_agent_message: Option<String>,
    last_user_message: Option<String>,
    last_function_call_name: Option<String>,
}

impl SessionAccumulator {
    fn consume_line(&mut self, line: &str) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }

        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            return;
        };

        self.consume_value(&value);
    }

    fn consume_value(&mut self, value: &Value) {
        let timestamp = value
            .get("timestamp")
            .and_then(Value::as_str)
            .map(str::to_string);
        if self.started_at.is_none() {
            self.started_at = timestamp.clone();
        }
        if timestamp.is_some() {
            self.updated_at = timestamp;
        }

        match value.get("type").and_then(Value::as_str) {
            Some("session_meta") => self.consume_session_meta(value.get("payload")),
            Some("event_msg") => self.consume_event_msg(value.get("payload")),
            Some("response_item") => self.consume_response_item(value.get("payload")),
            _ => {}
        }
    }

    fn consume_session_meta(&mut self, payload: Option<&Value>) {
        let Some(payload) = payload else {
            return;
        };

        self.saw_session_meta = true;

        if let Some(thread_id) = payload.get("id").and_then(Value::as_str) {
            self.thread_id = Some(thread_id.to_string());
        }

        if let Some(cwd) = payload.get("cwd").and_then(Value::as_str) {
            self.cwd = Some(cwd.to_string());
        }

        if let Some(started_at) = payload.get("timestamp").and_then(Value::as_str) {
            let started_at = started_at.to_string();
            self.started_at = Some(started_at.clone());
            if self.updated_at.is_none() {
                self.updated_at = Some(started_at);
            }
        }

        let source = payload.get("source");
        let source_is_vscode = source.and_then(Value::as_str) == Some("vscode");
        let has_subagent_spawn = source
            .and_then(|value| value.get("subagent"))
            .and_then(|value| value.get("thread_spawn"))
            .is_some();

        self.is_main_thread = source_is_vscode || !has_subagent_spawn;
    }

    fn consume_event_msg(&mut self, payload: Option<&Value>) {
        let Some(payload) = payload else {
            return;
        };

        match payload.get("type").and_then(Value::as_str) {
            Some("user_message") => {
                let Some(message) = payload.get("message").and_then(Value::as_str) else {
                    return;
                };

                if self.title.is_none() {
                    if let Some(first_line) = message.lines().next().map(str::trim) {
                        if !first_line.is_empty() {
                            self.title = Some(first_line.to_string());
                        }
                    }
                }

                if let Some(message) = normalize_text(message) {
                    self.last_user_message = Some(message);
                }
            }
            Some("agent_message") => {
                if let Some(message) = payload
                    .get("message")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                {
                    self.last_agent_message = Some(message);
                }
            }
            Some("task_complete") => {
                self.has_task_complete = true;
                if let Some(message) = payload
                    .get("last_agent_message")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                {
                    self.task_complete_last_agent_message = Some(message);
                }
            }
            _ => {}
        }
    }

    fn consume_response_item(&mut self, payload: Option<&Value>) {
        let Some(payload) = payload else {
            return;
        };

        let is_function_call = payload.get("type").and_then(Value::as_str) == Some("function_call");
        if !is_function_call {
            return;
        }

        if let Some(function_name) = payload
            .get("name")
            .and_then(Value::as_str)
            .and_then(normalize_text)
        {
            self.last_function_call_name = Some(function_name);
        }
    }

    fn finish(self) -> Option<ThreadOverviewRow> {
        if !self.saw_session_meta || !self.is_main_thread {
            return None;
        }

        let thread_id = self.thread_id?;
        let title = self.title.unwrap_or_else(|| thread_id.clone());
        let latest_activity_summary = self
            .last_agent_message
            .or(self.task_complete_last_agent_message)
            .or(self.last_user_message)
            .or(self.last_function_call_name);
        let status = if self.has_task_complete {
            STATUS_COMPLETED
        } else {
            STATUS_INFLIGHT
        };

        Some(ThreadOverviewRow {
            thread_id,
            title,
            cwd: self.cwd.unwrap_or_default(),
            status: status.to_string(),
            started_at: self.started_at,
            updated_at: self.updated_at,
            latest_activity_summary,
        })
    }
}

fn normalize_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn collect_live_session_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(error).with_context(|| format!("failed to read {}", dir.display()));
        }
    };

    for entry in entries {
        let entry = entry.with_context(|| format!("failed to read entry in {}", dir.display()))?;
        let path = entry.path();
        if path.is_dir() {
            collect_live_session_files(&path, files)?;
            continue;
        }

        if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }

    Ok(())
}

fn parse_live_session_file(path: &Path) -> Result<Option<ThreadOverviewRow>> {
    let file = File::open(path)
        .with_context(|| format!("failed to open live session file {}", path.display()))?;
    let reader = BufReader::new(file);
    let mut accumulator = SessionAccumulator {
        is_main_thread: true,
        ..SessionAccumulator::default()
    };

    for line in reader.lines() {
        let line =
            line.with_context(|| format!("failed to read line from {}", path.display()))?;
        accumulator.consume_line(&line);
    }

    Ok(accumulator.finish())
}

pub fn run_incremental_ingest(state: &AppState) -> Result<()> {
    let mut session_files = Vec::new();
    collect_live_session_files(&state.source_paths.live_sessions_dir, &mut session_files)?;
    session_files.sort();

    let mut connection = open_monitor_db(state)?;
    let tx = connection
        .transaction()
        .context("failed to open live ingest transaction")?;

    for session_file in session_files {
        let Some(thread) = parse_live_session_file(&session_file)? else {
            continue;
        };

        tx.execute(
            "
            insert into threads (
              thread_id, title, cwd, status, started_at, updated_at, latest_activity_summary
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            on conflict(thread_id) do update set
              title = excluded.title,
              cwd = excluded.cwd,
              status = excluded.status,
              started_at = excluded.started_at,
              updated_at = excluded.updated_at,
              latest_activity_summary = excluded.latest_activity_summary
            ",
            params![
                thread.thread_id,
                thread.title,
                thread.cwd,
                thread.status,
                thread.started_at,
                thread.updated_at,
                thread.latest_activity_summary,
            ],
        )
        .with_context(|| format!("failed to upsert thread from {}", session_file.display()))?;
    }

    tx.commit().context("failed to commit live ingest transaction")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::SessionAccumulator;

    #[test]
    fn parses_main_thread_overview_fields() {
        let lines = [
            json!({
                "timestamp": "2026-03-10T01:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-main-1",
                    "timestamp": "2026-03-10T01:00:00Z",
                    "cwd": "/workspace/repo",
                    "source": "vscode"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "  First user line  \nsecond line"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:02Z",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "name": "exec_command"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:03Z",
                "type": "event_msg",
                "payload": {
                    "type": "task_complete",
                    "last_agent_message": "task complete summary"
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:04Z",
                "type": "event_msg",
                "payload": {
                    "type": "agent_message",
                    "message": "latest agent summary"
                }
            })
            .to_string(),
        ];

        let mut accumulator = SessionAccumulator {
            is_main_thread: true,
            ..SessionAccumulator::default()
        };
        for line in lines {
            accumulator.consume_line(&line);
        }
        let parsed = accumulator.finish().expect("main thread should be parsed");

        assert_eq!(parsed.thread_id, "thread-main-1");
        assert_eq!(parsed.title, "First user line");
        assert_eq!(parsed.status, "completed");
        assert_eq!(
            parsed.latest_activity_summary.as_deref(),
            Some("latest agent summary")
        );
    }

    #[test]
    fn skips_subagent_session_from_spawn_metadata() {
        let lines = [
            json!({
                "timestamp": "2026-03-10T01:00:00Z",
                "type": "session_meta",
                "payload": {
                    "id": "thread-subagent-1",
                    "cwd": "/workspace/repo",
                    "source": {
                        "subagent": {
                            "thread_spawn": {
                                "parent_thread_id": "thread-main-1"
                            }
                        }
                    }
                }
            })
            .to_string(),
            json!({
                "timestamp": "2026-03-10T01:00:01Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "child session message"
                }
            })
            .to_string(),
        ];

        let mut accumulator = SessionAccumulator {
            is_main_thread: true,
            ..SessionAccumulator::default()
        };
        for line in lines {
            accumulator.consume_line(&line);
        }

        assert!(accumulator.finish().is_none());
    }
}
