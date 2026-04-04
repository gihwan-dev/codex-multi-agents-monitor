use crate::{
    domain::{
        claude_mapping::{map_claude_block_entry_type, map_claude_record_entry_type},
        ingest_policy::CLAUDE_DEFAULT_SUBAGENT_DEPTH,
        session::{SessionEntrySnapshot, SessionProvider, SubagentSnapshot},
    },
    support::text::{
        derive_recent_index_last_summary, derive_recent_index_status, derive_recent_index_title,
        extract_first_user_message, truncate_utf8_safe,
    },
};
use serde_json::{json, Map, Value};
use std::{
    fs,
    fs::File,
    io::{self, BufRead, BufReader},
    path::Path,
};

use super::{
    claude_session_discovery::{
        collect_claude_subagent_session_files, resolve_claude_subagent_meta_path,
    },
    session_jsonl::{ParsedArchivedIndexEntry, ParsedRecentIndexEntry, ParsedSessionSnapshot},
};

#[derive(Default)]
struct ClaudeTranscriptCollector {
    session_id: Option<String>,
    workspace_path: Option<String>,
    started_at: Option<String>,
    updated_at: Option<String>,
    model: Option<String>,
    entries: Vec<SessionEntrySnapshot>,
    cumulative_usage: ClaudeUsageMetrics,
    is_sidechain: bool,
    saw_record: bool,
}

struct ClaudeTranscript {
    session_id: String,
    workspace_path: String,
    started_at: String,
    updated_at: String,
    model: Option<String>,
    entries: Vec<SessionEntrySnapshot>,
    is_sidechain: bool,
}

struct ClaudeSubagentIdentity {
    depth: u32,
    agent_nickname: String,
    agent_role: String,
}

#[derive(Clone, Copy)]
struct ClaudeRecordContext<'a> {
    record_type: &'a str,
    timestamp: &'a str,
}

#[derive(Clone, Copy)]
struct ClaudeMessageContext<'a> {
    record_type: &'a str,
    role: &'a str,
    timestamp: &'a str,
}

#[derive(Clone, Copy)]
struct ClaudeEntryFinalizationContext<'a> {
    record: &'a Value,
    record_type: &'a str,
    timestamp: &'a str,
    entries_added: bool,
}

#[derive(Clone, Copy, Default)]
struct ClaudeUsageMetrics {
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_write_tokens: u64,
    reasoning_tokens: u64,
}

pub(crate) fn parse_claude_recent_index_entry(
    session_file: &Path,
) -> io::Result<Option<ParsedRecentIndexEntry>> {
    let Some(transcript) = parse_claude_transcript(session_file)? else {
        return Ok(None);
    };

    Ok(Some(ParsedRecentIndexEntry {
        provider: SessionProvider::Claude,
        session_id: transcript.session_id,
        workspace_path: transcript.workspace_path,
        started_at: transcript.started_at,
        updated_at: transcript.updated_at,
        model: transcript.model,
        first_user_message: extract_first_user_message(&transcript.entries),
        title: derive_recent_index_title(&transcript.entries),
        status: derive_recent_index_status(&transcript.entries),
        last_event_summary: derive_recent_index_last_summary(&transcript.entries),
    }))
}

pub(crate) fn parse_claude_archived_index_entry<F>(
    session_file: &Path,
    should_skip_workspace: F,
) -> io::Result<Option<ParsedArchivedIndexEntry>>
where
    F: Fn(&str) -> bool,
{
    let Some(transcript) = parse_claude_transcript(session_file)? else {
        return Ok(None);
    };
    if should_skip_workspace(&transcript.workspace_path) {
        return Ok(None);
    }

    Ok(Some(ParsedArchivedIndexEntry {
        provider: SessionProvider::Claude,
        session_id: transcript.session_id,
        workspace_path: transcript.workspace_path,
        started_at: transcript.started_at,
        updated_at: transcript.updated_at,
        model: transcript.model,
        first_user_message: extract_first_user_message(&transcript.entries),
    }))
}

pub(crate) fn parse_claude_session_snapshot(
    session_file: &Path,
) -> io::Result<Option<ParsedSessionSnapshot>> {
    let Some(transcript) = parse_claude_transcript(session_file)? else {
        return Ok(None);
    };

    Ok(Some(ParsedSessionSnapshot {
        provider: SessionProvider::Claude,
        session_id: transcript.session_id,
        forked_from_id: None,
        workspace_path: transcript.workspace_path,
        started_at: transcript.started_at,
        updated_at: transcript.updated_at,
        model: transcript.model,
        max_context_window_tokens: None,
        entries: transcript.entries,
        prompt_assembly: Vec::new(),
    }))
}

pub(crate) fn parse_claude_archived_session_snapshot<F>(
    session_file: &Path,
    should_skip_workspace: F,
) -> io::Result<Option<ParsedSessionSnapshot>>
where
    F: Fn(&str) -> bool,
{
    let Some(transcript) = parse_claude_transcript(session_file)? else {
        return Ok(None);
    };
    if should_skip_workspace(&transcript.workspace_path) {
        return Ok(None);
    }

    Ok(Some(ParsedSessionSnapshot {
        provider: SessionProvider::Claude,
        session_id: transcript.session_id,
        forked_from_id: None,
        workspace_path: transcript.workspace_path,
        started_at: transcript.started_at,
        updated_at: transcript.updated_at,
        model: transcript.model,
        max_context_window_tokens: None,
        entries: transcript.entries,
        prompt_assembly: Vec::new(),
    }))
}

pub(crate) fn read_claude_subagent_snapshots(
    session_file: &Path,
    parent_thread_id: &str,
) -> io::Result<Vec<SubagentSnapshot>> {
    let subagent_files = collect_claude_subagent_session_files(session_file)?;
    let mut subagents = Vec::new();

    for subagent_file in subagent_files {
        let Some(transcript) = parse_claude_transcript(&subagent_file)? else {
            continue;
        };
        let identity = read_claude_subagent_identity(&subagent_file, transcript.is_sidechain);
        subagents.push(SubagentSnapshot {
            provider: SessionProvider::Claude,
            session_id: transcript.session_id,
            parent_thread_id: parent_thread_id.to_owned(),
            depth: identity.depth,
            agent_nickname: identity.agent_nickname,
            agent_role: identity.agent_role,
            model: transcript.model,
            max_context_window_tokens: None,
            started_at: transcript.started_at,
            updated_at: transcript.updated_at,
            entries: transcript.entries,
            error: None,
        });
    }

    subagents.sort_by(|left, right| {
        left.started_at
            .cmp(&right.started_at)
            .then_with(|| left.session_id.cmp(&right.session_id))
    });
    Ok(subagents)
}

fn parse_claude_transcript(session_file: &Path) -> io::Result<Option<ClaudeTranscript>> {
    let reader = BufReader::new(File::open(session_file)?);
    let mut collector = ClaudeTranscriptCollector::default();

    for line in reader.lines() {
        let line = line?;
        collector.consume_line(&line);
    }

    Ok(collector.finish(session_file))
}

impl ClaudeTranscriptCollector {
    fn consume_line(&mut self, line: &str) {
        let Some(record) = parse_record(line) else {
            return;
        };
        let Some(record_type) = record.get("type").and_then(Value::as_str) else {
            return;
        };
        if !is_claude_record_type(record_type) {
            return;
        }

        self.saw_record = true;
        self.capture_shared_metadata(&record);
        self.capture_record_entries(&record, record_type);
    }

    fn finish(self, session_file: &Path) -> Option<ClaudeTranscript> {
        if !self.saw_record {
            return None;
        }

        let session_id = self.session_id.or_else(|| {
            session_file
                .file_stem()
                .and_then(|value| value.to_str())
                .map(ToOwned::to_owned)
        })?;
        let workspace_path = self.workspace_path.unwrap_or_default();
        let started_at = self.started_at.unwrap_or_default();
        let updated_at = self.updated_at.unwrap_or_else(|| started_at.clone());

        Some(ClaudeTranscript {
            session_id,
            workspace_path,
            started_at,
            updated_at,
            model: self.model,
            entries: self.entries,
            is_sidechain: self.is_sidechain,
        })
    }

    fn capture_shared_metadata(&mut self, record: &Value) {
        let Some(object) = record.as_object() else {
            return;
        };
        self.capture_timestamp_metadata(object);
        self.capture_session_metadata(object);
        self.capture_workspace_metadata(object);
        self.capture_sidechain_metadata(object);
        self.capture_model_metadata(object);
    }

    fn capture_timestamp_metadata(&mut self, object: &Map<String, Value>) {
        let timestamp = extract_object_string(object, "timestamp");
        if self.started_at.is_none() {
            self.started_at = timestamp.clone();
        }
        if timestamp.is_some() {
            self.updated_at = timestamp;
        }
    }

    fn capture_session_metadata(&mut self, object: &Map<String, Value>) {
        if self.session_id.is_none() {
            self.session_id = extract_object_string(object, "sessionId");
        }
    }

    fn capture_workspace_metadata(&mut self, object: &Map<String, Value>) {
        if self.workspace_path.is_none() {
            self.workspace_path = extract_object_string(object, "cwd");
        }
    }

    fn capture_sidechain_metadata(&mut self, object: &Map<String, Value>) {
        if !self.is_sidechain {
            self.is_sidechain = object
                .get("isSidechain")
                .and_then(Value::as_bool)
                .unwrap_or(false);
        }
    }

    fn capture_model_metadata(&mut self, object: &Map<String, Value>) {
        if self.model.is_none() {
            self.model =
                extract_message_model(object).or_else(|| extract_object_string(object, "model"));
        }
    }

    fn capture_record_entries(&mut self, record: &Value, record_type: &str) {
        let timestamp = record
            .get("timestamp")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        let before_len = self.entries.len();
        let context = ClaudeRecordContext {
            record_type,
            timestamp: &timestamp,
        };
        let usage = ClaudeUsageMetrics::from_record(record);

        if let Some(message) = record.get("message").and_then(Value::as_object) {
            self.capture_message_entries(message, context);
        } else {
            self.capture_record_note(record, context);
        }

        if let Some(usage) = usage {
            self.record_usage(&usage);
        }

        let finalization = ClaudeEntryFinalizationContext {
            record,
            record_type,
            timestamp: &timestamp,
            entries_added: self.entries.len() > before_len,
        };
        self.finalize_captured_entries(finalization, usage);
    }

    fn record_usage(&mut self, record: &ClaudeUsageMetrics) {
        self.cumulative_usage.accumulate(record);
    }

    fn finalize_captured_entries(
        &mut self,
        context: ClaudeEntryFinalizationContext<'_>,
        usage: Option<ClaudeUsageMetrics>,
    ) {
        if !context.entries_added {
            return;
        }

        if should_append_task_complete(context.record_type, context.record) {
            self.entries.push(SessionEntrySnapshot {
                timestamp: context.timestamp.to_owned(),
                entry_type: "task_complete".to_owned(),
                role: None,
                text: extract_record_text(context.record),
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            });
        }

        if let Some(usage) = usage.filter(|usage| !usage.is_empty()) {
            self.entries
                .push(build_usage_entry(&usage, &self.cumulative_usage, context.timestamp));
        }
    }

    fn capture_message_entries(
        &mut self,
        message: &Map<String, Value>,
        context: ClaudeRecordContext<'_>,
    ) {
        let role = resolve_message_role(context.record_type, message);
        let message_context = ClaudeMessageContext {
            record_type: context.record_type,
            role,
            timestamp: context.timestamp,
        };
        let Some(content) = message.get("content").and_then(Value::as_array) else {
            self.capture_message_note(message, message_context);
            return;
        };

        if message_context.role == "user" {
            self.capture_user_message_content(content, message_context.timestamp);
            return;
        }

        self.capture_non_user_message_content(content, message_context);
    }

    fn capture_user_message_content(&mut self, content: &[Value], timestamp: &str) {
        let text = content
            .iter()
            .filter_map(extract_block_text)
            .collect::<Vec<_>>()
            .join("\n");
        if !text.trim().is_empty() {
            self.entries
                .push(build_role_message_entry(timestamp, "user", text));
        }
    }

    fn capture_non_user_message_content(
        &mut self,
        content: &[Value],
        context: ClaudeMessageContext<'_>,
    ) {
        for block in content {
            self.capture_message_block(block, context);
        }
    }

    fn capture_message_block(&mut self, block: &Value, context: ClaudeMessageContext<'_>) {
        let Some(block_type) = block.get("type").and_then(Value::as_str) else {
            return;
        };
        let Some(entry_type) = map_claude_block_entry_type(block_type) else {
            return;
        };

        match entry_type {
            "reasoning" => self
                .entries
                .push(build_reasoning_entry(context.timestamp, block)),
            "message" => self.capture_text_block(block, context),
            "function_call" => {
                self.push_optional_entry(build_function_call_entry(context.timestamp, block))
            }
            "function_call_output" => {
                self.push_optional_entry(build_function_output_entry(context.timestamp, block));
            }
            _ => {}
        }
    }

    fn capture_text_block(&mut self, block: &Value, context: ClaudeMessageContext<'_>) {
        let Some(text) = extract_block_text(block) else {
            return;
        };
        if is_system_message_context(context) {
            self.entries
                .push(build_text_entry(context.timestamp, "agent_message", text));
            return;
        }

        self.entries.push(build_role_message_entry(
            context.timestamp,
            context.role,
            text,
        ));
    }

    fn capture_message_note(
        &mut self,
        message: &Map<String, Value>,
        context: ClaudeMessageContext<'_>,
    ) {
        let Some(text) = extract_message_note_text(message) else {
            return;
        };
        if context.role == "assistant" {
            self.entries.push(build_role_message_entry(
                context.timestamp,
                "assistant",
                text,
            ));
            return;
        }

        if let Some(entry_type) = map_claude_record_entry_type(context.record_type) {
            self.entries
                .push(build_text_entry(context.timestamp, entry_type, text));
        }
    }

    fn capture_record_note(&mut self, record: &Value, context: ClaudeRecordContext<'_>) {
        let Some(entry_type) = map_claude_record_entry_type(context.record_type) else {
            return;
        };
        let Some(text) = extract_record_text(record) else {
            return;
        };
        self.entries
            .push(build_text_entry(context.timestamp, entry_type, text));
    }

    fn push_optional_entry(&mut self, entry: Option<SessionEntrySnapshot>) {
        if let Some(entry) = entry {
            self.entries.push(entry);
        }
    }
}

fn is_claude_record_type(record_type: &str) -> bool {
    matches!(
        record_type,
        "user" | "assistant" | "system" | "progress" | "file-history-snapshot"
    )
}

fn parse_record(line: &str) -> Option<Value> {
    if line.trim().is_empty() {
        return None;
    }

    serde_json::from_str::<Value>(line).ok()
}

fn extract_record_text(record: &Value) -> Option<String> {
    if let Some(text) = record
        .get("message")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        return Some(text.to_owned());
    }

    if let Some(text) = record
        .get("text")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        return Some(text.to_owned());
    }

    record
        .get("summary")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
}

fn extract_object_string(object: &Map<String, Value>, key: &str) -> Option<String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
}

fn extract_message_model(object: &Map<String, Value>) -> Option<String> {
    object
        .get("message")
        .and_then(Value::as_object)
        .and_then(|message| extract_object_string(message, "model"))
}

fn resolve_message_role<'a>(record_type: &'a str, message: &'a Map<String, Value>) -> &'a str {
    message
        .get("role")
        .and_then(Value::as_str)
        .or(match record_type {
            "user" => Some("user"),
            "assistant" => Some("assistant"),
            "system" => Some("system"),
            _ => None,
        })
        .unwrap_or_default()
}

fn is_system_message_context(context: ClaudeMessageContext<'_>) -> bool {
    context.role == "system" || context.record_type == "system"
}

fn extract_message_note_text(message: &Map<String, Value>) -> Option<String> {
    extract_object_string(message, "text").or_else(|| extract_object_string(message, "content"))
}

fn build_reasoning_entry(timestamp: &str, block: &Value) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: timestamp.to_owned(),
        entry_type: "reasoning".to_owned(),
        role: None,
        text: extract_block_text(block),
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    }
}

fn build_text_entry(timestamp: &str, entry_type: &str, text: String) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: timestamp.to_owned(),
        entry_type: entry_type.to_owned(),
        role: None,
        text: Some(text),
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    }
}

fn build_role_message_entry(timestamp: &str, role: &str, text: String) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: timestamp.to_owned(),
        entry_type: "message".to_owned(),
        role: Some(role.to_owned()),
        text: Some(text),
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    }
}

fn build_function_call_entry(timestamp: &str, block: &Value) -> Option<SessionEntrySnapshot> {
    let block_object = block.as_object()?;
    let function_name = block_object
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("tool")
        .to_owned();
    let function_call_id = block_object
        .get("id")
        .or_else(|| block_object.get("tool_use_id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned);
    let function_arguments_preview = block_object
        .get("input")
        .or_else(|| block_object.get("arguments"))
        .map(serialize_preview_value);

    Some(SessionEntrySnapshot {
        timestamp: timestamp.to_owned(),
        entry_type: "function_call".to_owned(),
        role: None,
        text: None,
        function_name: Some(function_name),
        function_call_id,
        function_arguments_preview,
    })
}

fn build_function_output_entry(timestamp: &str, block: &Value) -> Option<SessionEntrySnapshot> {
    let block_object = block.as_object()?;
    let text = block_object
        .get("content")
        .and_then(extract_content_text)
        .or_else(|| {
            block_object
                .get("text")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| block_object.get("result").map(serialize_preview_value));
    let function_call_id = block_object
        .get("tool_use_id")
        .or_else(|| block_object.get("id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned);

    Some(SessionEntrySnapshot {
        timestamp: timestamp.to_owned(),
        entry_type: "function_call_output".to_owned(),
        role: None,
        text,
        function_name: None,
        function_call_id,
        function_arguments_preview: None,
    })
}

fn extract_content_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => (!text.trim().is_empty()).then(|| text.to_owned()),
        Value::Array(items) => {
            let combined = items
                .iter()
                .filter_map(extract_block_text)
                .collect::<Vec<_>>()
                .join("\n");
            (!combined.trim().is_empty()).then_some(combined)
        }
        Value::Object(map) => extract_block_text(&Value::Object(map.clone()))
            .or_else(|| Some(serialize_preview_value(value))),
        _ => Some(serialize_preview_value(value)),
    }
}

fn extract_block_text(block: &Value) -> Option<String> {
    let object = block.as_object()?;

    object
        .get("thinking")
        .and_then(Value::as_str)
        .or_else(|| object.get("text").and_then(Value::as_str))
        .or_else(|| object.get("content").and_then(Value::as_str))
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            object
                .get("content")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(extract_block_text)
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .filter(|value| !value.trim().is_empty())
        })
}

fn serialize_preview_value(value: &Value) -> String {
    let serialized = match value {
        Value::String(text) => text.clone(),
        _ => serde_json::to_string(value).unwrap_or_default(),
    };
    truncate_utf8_safe(&serialized, 2_000)
}

fn should_append_task_complete(record_type: &str, record: &Value) -> bool {
    if record_type != "assistant" {
        return false;
    }

    let Some(content) = record
        .get("message")
        .and_then(Value::as_object)
        .and_then(|message| message.get("content"))
        .and_then(Value::as_array)
    else {
        return false;
    };

    let mut has_completion_block = false;
    let mut has_tool_use = false;
    for block in content {
        match block.get("type").and_then(Value::as_str) {
            Some("tool_use") => has_tool_use = true,
            Some("text" | "tool_result") => has_completion_block = true,
            _ => {}
        }
    }

    has_completion_block && !has_tool_use
}

fn build_usage_entry(
    usage: &ClaudeUsageMetrics,
    cumulative_usage: &ClaudeUsageMetrics,
    timestamp: &str,
) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: timestamp.to_owned(),
        entry_type: "token_count".to_owned(),
        role: None,
        text: Some(usage.build_payload(cumulative_usage).to_string()),
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    }
}

fn read_claude_subagent_identity(
    session_file: &Path,
    is_sidechain: bool,
) -> ClaudeSubagentIdentity {
    let default_identity = default_claude_subagent_identity(is_sidechain);
    let Some(meta) = read_claude_subagent_meta(session_file) else {
        return default_identity;
    };
    let depth = meta
        .get("depth")
        .and_then(Value::as_u64)
        .map(|value| value as u32)
        .unwrap_or(CLAUDE_DEFAULT_SUBAGENT_DEPTH);
    let agent_nickname = extract_meta_string(&meta, &["displayName", "nickname", "name"])
        .unwrap_or_else(|| default_identity.agent_nickname.clone());
    let agent_role = extract_meta_string(&meta, &["agentType", "agent_type", "role"])
        .unwrap_or_else(|| default_identity.agent_role.clone());

    ClaudeSubagentIdentity {
        depth,
        agent_nickname,
        agent_role,
    }
}

impl ClaudeUsageMetrics {
    fn from_record(record: &Value) -> Option<Self> {
        let usage = record
            .get("message")
            .and_then(Value::as_object)
            .and_then(|message| message.get("usage"))
            .and_then(Value::as_object)?;

        Some(Self {
            input_tokens: read_usage_metric(usage, "input_tokens"),
            output_tokens: read_usage_metric(usage, "output_tokens"),
            cache_read_tokens: read_usage_metric(usage, "cache_read_input_tokens"),
            cache_write_tokens: read_usage_metric(usage, "cache_creation_input_tokens"),
            reasoning_tokens: read_usage_metric(usage, "reasoning_output_tokens"),
        })
    }

    fn is_empty(&self) -> bool {
        self.input_tokens == 0
            && self.output_tokens == 0
            && self.cache_read_tokens == 0
            && self.cache_write_tokens == 0
            && self.reasoning_tokens == 0
    }

    fn total_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens + self.reasoning_tokens
    }

    fn accumulate(&mut self, other: &Self) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
        self.cache_read_tokens += other.cache_read_tokens;
        self.cache_write_tokens += other.cache_write_tokens;
        self.reasoning_tokens += other.reasoning_tokens;
    }

    fn usage_totals_json(&self) -> Value {
        json!({
            "in": self.input_tokens,
            "out": self.output_tokens,
            "cached": self.cache_read_tokens,
            "cache_write": self.cache_write_tokens,
            "reasoning": self.reasoning_tokens,
            "total": self.total_tokens(),
        })
    }

    fn build_payload(&self, total: &Self) -> Value {
        json!({
            "last": self.usage_totals_json(),
            "total": total.usage_totals_json(),
        })
    }
}

fn read_usage_metric(usage: &Map<String, Value>, key: &str) -> u64 {
    usage.get(key).and_then(Value::as_u64).unwrap_or(0)
}

fn default_claude_subagent_identity(is_sidechain: bool) -> ClaudeSubagentIdentity {
    let agent_role = if is_sidechain {
        "sidechain"
    } else {
        "subagent"
    };
    let agent_nickname = if is_sidechain {
        "Sidechain"
    } else {
        "Subagent"
    };
    ClaudeSubagentIdentity {
        depth: CLAUDE_DEFAULT_SUBAGENT_DEPTH,
        agent_nickname: agent_nickname.to_owned(),
        agent_role: agent_role.to_owned(),
    }
}

fn read_claude_subagent_meta(session_file: &Path) -> Option<Value> {
    let meta_path = resolve_claude_subagent_meta_path(session_file)?;
    let contents = fs::read_to_string(meta_path).ok()?;
    serde_json::from_str::<Value>(&contents).ok()
}

fn extract_meta_string(meta: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        meta.get(*key)
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
    })
}

#[cfg(test)]
mod tests {
    use super::{
        parse_claude_archived_session_snapshot, parse_claude_recent_index_entry,
        parse_claude_session_snapshot, read_claude_subagent_snapshots,
    };
    use crate::{domain::session::SessionProvider, test_support::TempDir};
    use serde_json::Value;
    use std::fs;

    fn write_claude_main_fixture(path: &std::path::Path) {
        fs::write(
            path,
            [
                r#"{"type":"user","sessionId":"claude-main","timestamp":"2026-04-01T00:00:00.000Z","cwd":"/tmp/workspace","message":{"role":"user","content":[{"type":"text","text":"Investigate the workspace tree."}]}}"#,
                r#"{"type":"assistant","sessionId":"claude-main","timestamp":"2026-04-01T00:00:01.000Z","cwd":"/tmp/workspace","message":{"role":"assistant","model":"claude-opus-4-6","content":[{"type":"thinking","thinking":"Need to inspect the layout first."},{"type":"text","text":"I found the tree issue."}],"usage":{"input_tokens":120,"output_tokens":48,"cache_read_input_tokens":32,"cache_creation_input_tokens":8}}}"#,
            ]
            .join("\n"),
        )
        .expect("claude fixture should be written");
    }

    fn write_claude_multi_turn_fixture(path: &std::path::Path) {
        fs::write(
            path,
            [
                r#"{"type":"user","sessionId":"claude-main","timestamp":"2026-04-01T00:00:00.000Z","cwd":"/tmp/workspace","message":{"role":"user","content":[{"type":"text","text":"Investigate the workspace tree."}]}}"#,
                r#"{"type":"assistant","sessionId":"claude-main","timestamp":"2026-04-01T00:00:01.000Z","cwd":"/tmp/workspace","message":{"role":"assistant","model":"claude-opus-4-6","content":[{"type":"text","text":"I found the tree issue."}],"usage":{"input_tokens":120,"output_tokens":48,"cache_read_input_tokens":32,"cache_creation_input_tokens":8}}}"#,
                r#"{"type":"user","sessionId":"claude-main","timestamp":"2026-04-01T00:00:02.000Z","cwd":"/tmp/workspace","message":{"role":"user","content":[{"type":"text","text":"Apply the fix."}]}}"#,
                r#"{"type":"assistant","sessionId":"claude-main","timestamp":"2026-04-01T00:00:03.000Z","cwd":"/tmp/workspace","message":{"role":"assistant","model":"claude-opus-4-6","content":[{"type":"text","text":"Applied the patch."}],"usage":{"input_tokens":30,"output_tokens":20,"cache_read_input_tokens":10,"cache_creation_input_tokens":5,"reasoning_output_tokens":7}}}"#,
            ]
            .join("\n"),
        )
        .expect("claude fixture should be written");
    }

    #[test]
    fn parses_claude_recent_index_entry_with_usage_and_reasoning() {
        let temp_dir = TempDir::new("claude-recent-index");
        let session_file = temp_dir.path.join("session.jsonl");
        write_claude_main_fixture(&session_file);

        let parsed = parse_claude_recent_index_entry(&session_file)
            .expect("recent parse should succeed")
            .expect("entry should parse");

        assert_eq!(parsed.provider, SessionProvider::Claude);
        assert_eq!(parsed.model.as_deref(), Some("claude-opus-4-6"));
        assert_eq!(parsed.status, "done");
        assert_eq!(parsed.title, "Investigate the workspace tree.");
    }

    #[test]
    fn parses_claude_session_snapshot_entries() {
        let temp_dir = TempDir::new("claude-snapshot");
        let session_file = temp_dir.path.join("session.jsonl");
        write_claude_main_fixture(&session_file);

        let parsed = parse_claude_session_snapshot(&session_file)
            .expect("snapshot parse should succeed")
            .expect("snapshot should parse");

        assert_eq!(parsed.provider, SessionProvider::Claude);
        assert_eq!(parsed.entries.len(), 5);
        assert_eq!(parsed.entries[1].entry_type, "reasoning");
        assert_eq!(
            parsed.entries[1].text.as_deref(),
            Some("Need to inspect the layout first.")
        );
        assert_eq!(parsed.entries[2].entry_type, "message");
        assert_eq!(parsed.entries[3].entry_type, "task_complete");
        assert_eq!(parsed.entries[4].entry_type, "token_count");
    }

    #[test]
    fn parses_claude_session_snapshot_usage_totals_across_turns() {
        let temp_dir = TempDir::new("claude-snapshot-usage-total");
        let session_file = temp_dir.path.join("session.jsonl");
        write_claude_multi_turn_fixture(&session_file);

        let parsed = parse_claude_session_snapshot(&session_file)
            .expect("snapshot parse should succeed")
            .expect("snapshot should parse");
        let token_payloads = parsed
            .entries
            .iter()
            .filter(|entry| entry.entry_type == "token_count")
            .map(|entry| {
                serde_json::from_str::<Value>(
                    entry
                        .text
                        .as_deref()
                        .expect("token_count entry should have payload"),
                )
                .expect("token_count payload should parse")
            })
            .collect::<Vec<_>>();

        assert_eq!(token_payloads.len(), 2);
        assert_eq!(token_payloads[1]["last"]["in"].as_u64(), Some(30));
        assert_eq!(token_payloads[1]["last"]["out"].as_u64(), Some(20));
        assert_eq!(token_payloads[1]["last"]["cached"].as_u64(), Some(10));
        assert_eq!(token_payloads[1]["last"]["cache_write"].as_u64(), Some(5));
        assert_eq!(token_payloads[1]["last"]["reasoning"].as_u64(), Some(7));
        assert_eq!(token_payloads[1]["last"]["total"].as_u64(), Some(57));
        assert_eq!(token_payloads[1]["total"]["in"].as_u64(), Some(150));
        assert_eq!(token_payloads[1]["total"]["out"].as_u64(), Some(68));
        assert_eq!(token_payloads[1]["total"]["cached"].as_u64(), Some(42));
        assert_eq!(token_payloads[1]["total"]["cache_write"].as_u64(), Some(13));
        assert_eq!(token_payloads[1]["total"]["reasoning"].as_u64(), Some(7));
        assert_eq!(token_payloads[1]["total"]["total"].as_u64(), Some(225));
    }

    #[test]
    fn skips_archived_claude_snapshot_when_workspace_is_filtered() {
        let temp_dir = TempDir::new("claude-archived-filter");
        let session_file = temp_dir.path.join("session.jsonl");
        write_claude_main_fixture(&session_file);

        let parsed = parse_claude_archived_session_snapshot(&session_file, |workspace_path| {
            workspace_path == "/tmp/workspace"
        })
        .expect("archived parse should succeed");

        assert!(parsed.is_none());
    }

    #[test]
    fn reads_claude_subagents_from_adjacent_directory() {
        let temp_dir = TempDir::new("claude-subagents");
        let session_file = temp_dir.path.join("demo/session-001.jsonl");
        let subagents_dir = temp_dir.path.join("demo/session-001/subagents");
        fs::create_dir_all(&subagents_dir).expect("subagents dir should exist");
        fs::write(&session_file, "").expect("main session file should exist");
        fs::write(
            subagents_dir.join("agent-1.jsonl"),
            [
                r#"{"type":"assistant","sessionId":"agent-1","timestamp":"2026-04-01T00:00:10.000Z","cwd":"/tmp/workspace","isSidechain":true,"message":{"role":"assistant","model":"claude-sonnet-4","content":[{"type":"text","text":"Sidechain result"}]}}"#,
            ]
            .join("\n"),
        )
        .expect("subagent transcript should exist");
        fs::write(
            subagents_dir.join("agent-1.meta.json"),
            r#"{"agentType":"researcher","displayName":"Scout"}"#,
        )
        .expect("subagent meta should exist");

        let subagents = read_claude_subagent_snapshots(&session_file, "claude-main")
            .expect("subagents should load");

        assert_eq!(subagents.len(), 1);
        assert_eq!(subagents[0].provider, SessionProvider::Claude);
        assert_eq!(subagents[0].parent_thread_id, "claude-main");
        assert_eq!(subagents[0].agent_nickname, "Scout");
        assert_eq!(subagents[0].agent_role, "researcher");
    }
}
