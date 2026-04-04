use crate::{
    domain::session::{
        PromptAssemblyLayer, SessionEntrySnapshot, SessionProvider, SubagentSnapshot,
    },
    support::text::{
        derive_recent_index_last_summary, derive_recent_index_status, derive_recent_index_title,
        extract_entry_snapshot, extract_error_hint, extract_first_user_message,
        extract_prompt_layers, extract_turn_context_model, is_system_boilerplate_text,
        truncate_utf8_safe,
    },
};
use serde_json::{Map, Value};
use std::{
    fs::File,
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom},
    path::Path,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct RecentIndexParseOptions {
    pub(crate) prefix_scan_limit: usize,
    pub(crate) tail_bytes: u64,
    pub(crate) tail_entry_limit: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ParsedRecentIndexEntry {
    pub(crate) provider: SessionProvider,
    pub(crate) session_id: String,
    pub(crate) workspace_path: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) first_user_message: Option<String>,
    pub(crate) title: String,
    pub(crate) status: String,
    pub(crate) last_event_summary: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ParsedSessionSnapshot {
    pub(crate) provider: SessionProvider,
    pub(crate) session_id: String,
    pub(crate) forked_from_id: Option<String>,
    pub(crate) workspace_path: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) max_context_window_tokens: Option<u64>,
    pub(crate) entries: Vec<SessionEntrySnapshot>,
    pub(crate) prompt_assembly: Vec<PromptAssemblyLayer>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ParsedArchivedIndexEntry {
    pub(crate) provider: SessionProvider,
    pub(crate) session_id: String,
    pub(crate) workspace_path: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) first_user_message: Option<String>,
}

#[derive(Clone)]
struct SessionMetaRecord {
    session_meta: Value,
    payload: Map<String, Value>,
}

struct SubagentMeta {
    session_id: String,
    parent_thread_id: String,
    depth: u32,
    agent_nickname: String,
    agent_role: String,
    started_at: String,
}

struct SnapshotMeta {
    session_id: String,
    forked_from_id: Option<String>,
    workspace_path: String,
    started_at: String,
}

#[derive(Default)]
struct RecentIndexPrefixScan {
    prefix_entries: Vec<SessionEntrySnapshot>,
    model: Option<String>,
}

#[derive(Default)]
struct ArchivedIndexScan {
    model: Option<String>,
    first_user_message: Option<String>,
    last_timestamp: Option<String>,
}

struct SessionSnapshotCollector {
    updated_at: String,
    model: Option<String>,
    max_context_window_tokens: Option<u64>,
    entries: Vec<SessionEntrySnapshot>,
    prompt_assembly: Vec<PromptAssemblyLayer>,
    prompt_assembly_done: bool,
}

struct SubagentCollector {
    updated_at: String,
    model: Option<String>,
    max_context_window_tokens: Option<u64>,
    entries: Vec<SessionEntrySnapshot>,
    error: Option<String>,
    capture_entries: bool,
    has_open_turn: bool,
    embedded_context: bool,
}

pub(crate) fn read_subagent_snapshot(session_file: &Path) -> io::Result<Option<SubagentSnapshot>> {
    let reader = BufReader::new(File::open(session_file)?);
    let mut subagent_meta = None;
    let mut collector = None;
    let mut saw_prelude_entries = false;

    for line in reader.lines() {
        let line = line?;

        if subagent_meta.is_none() {
            if let Some(found_subagent_meta) =
                find_subagent_meta(session_file, &line, &mut saw_prelude_entries)
            {
                collector = Some(SubagentCollector::new(
                    found_subagent_meta.started_at.clone(),
                    saw_prelude_entries,
                ));
                subagent_meta = Some(found_subagent_meta);
            }
            continue;
        }

        consume_subagent_entry_line(&line, collector.as_mut());
    }

    match (subagent_meta, collector) {
        (Some(subagent_meta), Some(collector)) => Ok(Some(collector.finish(subagent_meta))),
        _ => Ok(None),
    }
}

fn find_subagent_meta(
    session_file: &Path,
    line: &str,
    saw_prelude_entries: &mut bool,
) -> Option<SubagentMeta> {
    let Some(meta) = parse_session_meta_line(line) else {
        *saw_prelude_entries |= parse_entry_line(line).is_some();
        return None;
    };

    let found_subagent_meta = build_subagent_meta(session_file, &meta);
    *saw_prelude_entries |= found_subagent_meta.is_none();
    found_subagent_meta
}

fn consume_subagent_entry_line(line: &str, collector: Option<&mut SubagentCollector>) {
    let Some(entry) = parse_entry_line(line) else {
        return;
    };
    if let Some(collector) = collector {
        collector.consume(entry);
    }
}

pub(crate) fn parse_recent_index_entry(
    session_file: &Path,
    options: RecentIndexParseOptions,
) -> io::Result<Option<ParsedRecentIndexEntry>> {
    let mut reader = BufReader::new(File::open(session_file)?);
    let Some(meta) = read_session_meta(&mut reader)? else {
        return Ok(None);
    };
    let started_at = started_at_from_meta(&meta);

    let mut scan = RecentIndexPrefixScan::default();
    visit_entries_with_limit_lossy(reader, options.prefix_scan_limit, |entry| {
        scan.consume(entry);
    });

    let tail_entries =
        read_tail_entry_snapshots(session_file, options.tail_bytes, options.tail_entry_limit)?;
    let updated_at = tail_entries
        .last()
        .map(|entry| entry.timestamp.clone())
        .unwrap_or_else(|| started_at.clone());

    Ok(Some(ParsedRecentIndexEntry {
        provider: SessionProvider::Codex,
        session_id: session_id_from_meta(session_file, &meta),
        workspace_path: workspace_path_from_meta(&meta),
        started_at,
        updated_at,
        model: scan.model,
        first_user_message: extract_first_user_message(&scan.prefix_entries),
        title: derive_recent_index_title(&scan.prefix_entries),
        status: derive_recent_index_status(&tail_entries),
        last_event_summary: derive_recent_index_last_summary(&tail_entries),
    }))
}

pub(crate) fn parse_live_session_snapshot(
    session_file: &Path,
    supported_sources: &[&str],
) -> io::Result<Option<ParsedSessionSnapshot>> {
    parse_session_snapshot(session_file, |payload| {
        payload
            .get("source")
            .and_then(Value::as_str)
            .is_some_and(|source| supported_sources.contains(&source))
    })
}

pub(crate) fn parse_archived_index_entry<F>(
    session_file: &Path,
    scan_limit: usize,
    should_skip_workspace: F,
) -> io::Result<Option<ParsedArchivedIndexEntry>>
where
    F: Fn(&str) -> bool,
{
    let mut reader = BufReader::new(File::open(session_file)?);
    let Some(meta) = read_session_meta(&mut reader)? else {
        return Ok(None);
    };
    if is_subagent_session(&meta.payload) || !has_archived_source(&meta.payload) {
        return Ok(None);
    }

    let workspace_path = workspace_path_from_meta(&meta);
    if should_skip_workspace(&workspace_path) {
        return Ok(None);
    }

    let started_at = started_at_from_meta(&meta);
    let mut scan = ArchivedIndexScan::default();
    visit_entries_with_limit_until_error(reader, scan_limit, |entry| scan.consume(entry));

    Ok(Some(ParsedArchivedIndexEntry {
        provider: SessionProvider::Codex,
        session_id: session_id_from_meta(session_file, &meta),
        workspace_path,
        started_at: started_at.clone(),
        updated_at: scan.last_timestamp.unwrap_or(started_at),
        model: scan.model,
        first_user_message: scan.first_user_message,
    }))
}

pub(crate) fn parse_archived_session_snapshot<F>(
    session_file: &Path,
    should_skip_workspace: F,
) -> io::Result<Option<ParsedSessionSnapshot>>
where
    F: Fn(&str) -> bool,
{
    parse_session_snapshot(session_file, |payload| {
        let Some(source) = payload.get("source").and_then(Value::as_str) else {
            return false;
        };
        if source.trim().is_empty() {
            return false;
        }

        let workspace_path = payload
            .get("cwd")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_default();

        !should_skip_workspace(workspace_path)
    })
}

pub(crate) fn read_tail_entry_snapshots(
    session_file: &Path,
    max_bytes: u64,
    max_entries: usize,
) -> io::Result<Vec<SessionEntrySnapshot>> {
    let (buffer, skip_first_line) = read_tail_buffer(session_file, max_bytes)?;
    let mut entries = parse_tail_entries(&buffer, skip_first_line);

    if entries.len() > max_entries {
        entries.drain(0..entries.len() - max_entries);
    }

    Ok(entries)
}

fn parse_session_snapshot<F>(
    session_file: &Path,
    is_supported_payload: F,
) -> io::Result<Option<ParsedSessionSnapshot>>
where
    F: Fn(&Map<String, Value>) -> bool,
{
    let mut reader = BufReader::new(File::open(session_file)?);
    let Some(meta) = read_session_meta(&mut reader)? else {
        return Ok(None);
    };
    if !is_supported_payload(&meta.payload) {
        return Ok(None);
    }

    let snapshot_meta = build_snapshot_meta(session_file, &meta);
    let mut collector =
        SessionSnapshotCollector::new(&meta.payload, snapshot_meta.started_at.clone());
    visit_entries(reader, |entry| collector.consume(entry))?;

    Ok(Some(collector.finish(snapshot_meta)))
}

fn read_session_meta(reader: &mut impl BufRead) -> io::Result<Option<SessionMetaRecord>> {
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line).map_err(invalid_data_error)?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .cloned()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "payload missing"))?;

    Ok(Some(SessionMetaRecord {
        session_meta,
        payload,
    }))
}

fn parse_session_meta_line(line: &str) -> Option<SessionMetaRecord> {
    let session_meta = parse_entry_line(line)?;
    if session_meta.get("type").and_then(Value::as_str) != Some("session_meta") {
        return None;
    }

    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)?
        .clone();

    Some(SessionMetaRecord {
        session_meta,
        payload,
    })
}

fn invalid_data_error(error: serde_json::Error) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, error)
}

fn build_subagent_meta(session_file: &Path, meta: &SessionMetaRecord) -> Option<SubagentMeta> {
    let thread_spawn = meta
        .payload
        .get("source")
        .and_then(|source| source.get("subagent"))
        .and_then(|subagent| subagent.get("thread_spawn"))
        .and_then(Value::as_object)?;

    Some(SubagentMeta {
        session_id: session_id_from_meta(session_file, meta),
        parent_thread_id: payload_string(thread_spawn, "parent_thread_id")
            .unwrap_or_default()
            .to_owned(),
        depth: thread_spawn
            .get("depth")
            .and_then(Value::as_u64)
            .unwrap_or(1) as u32,
        agent_nickname: payload_string(thread_spawn, "agent_nickname")
            .unwrap_or("Subagent")
            .to_owned(),
        agent_role: thread_spawn
            .get("agent_role")
            .or_else(|| thread_spawn.get("subagent_type"))
            .and_then(Value::as_str)
            .unwrap_or("agent")
            .to_owned(),
        started_at: started_at_from_meta(meta),
    })
}

fn build_snapshot_meta(session_file: &Path, meta: &SessionMetaRecord) -> SnapshotMeta {
    SnapshotMeta {
        session_id: session_id_from_meta(session_file, meta),
        forked_from_id: optional_payload_string(&meta.payload, "forked_from_id"),
        workspace_path: workspace_path_from_meta(meta),
        started_at: started_at_from_meta(meta),
    }
}

fn started_at_from_meta(meta: &SessionMetaRecord) -> String {
    payload_string(&meta.payload, "timestamp")
        .or_else(|| meta.session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned()
}

fn session_id_from_meta(session_file: &Path, meta: &SessionMetaRecord) -> String {
    optional_payload_string(&meta.payload, "id")
        .unwrap_or_else(|| session_file.display().to_string())
}

fn workspace_path_from_meta(meta: &SessionMetaRecord) -> String {
    payload_string(&meta.payload, "cwd")
        .unwrap_or_default()
        .to_owned()
}

fn optional_payload_string(payload: &Map<String, Value>, key: &str) -> Option<String> {
    payload_string(payload, key).map(ToOwned::to_owned)
}

fn payload_string<'a>(payload: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    payload
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
}

fn is_subagent_session(payload: &Map<String, Value>) -> bool {
    payload
        .get("source")
        .and_then(|source| source.get("subagent"))
        .is_some()
}

fn has_archived_source(payload: &Map<String, Value>) -> bool {
    payload.get("source").and_then(Value::as_str).is_some()
}

fn visit_entries<R, F>(reader: R, mut visit: F) -> io::Result<()>
where
    R: BufRead,
    F: FnMut(Value),
{
    for line in reader.lines() {
        let line = line?;
        let Some(entry) = parse_entry_line(&line) else {
            continue;
        };
        visit(entry);
    }

    Ok(())
}

fn visit_entries_with_limit_lossy<R, F>(reader: R, limit: usize, mut visit: F)
where
    R: BufRead,
    F: FnMut(Value),
{
    for line in reader.lines().take(limit).flatten() {
        let Some(entry) = parse_entry_line(&line) else {
            continue;
        };
        visit(entry);
    }
}

fn visit_entries_with_limit_until_error<R, F>(reader: R, limit: usize, mut visit: F)
where
    R: BufRead,
    F: FnMut(Value),
{
    for line in reader.lines().take(limit) {
        let Ok(line) = line else {
            break;
        };
        let Some(entry) = parse_entry_line(&line) else {
            continue;
        };
        visit(entry);
    }
}

fn parse_entry_line(line: &str) -> Option<Value> {
    if line.trim().is_empty() {
        return None;
    }

    serde_json::from_str::<Value>(line).ok()
}

impl RecentIndexPrefixScan {
    fn consume(&mut self, entry: Value) {
        self.capture_model(&entry);

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            self.prefix_entries.push(snapshot_entry);
        }
    }

    fn capture_model(&mut self, entry: &Value) {
        if self.model.is_none() {
            self.model = extract_turn_context_model(entry);
        }
    }
}

impl ArchivedIndexScan {
    fn consume(&mut self, entry: Value) {
        self.capture_model(&entry);
        self.capture_first_user_message(&entry);
        self.capture_last_timestamp(&entry);
    }

    fn capture_model(&mut self, entry: &Value) {
        if self.model.is_none() {
            self.model = extract_turn_context_model(entry);
        }
    }

    fn capture_first_user_message(&mut self, entry: &Value) {
        if self.first_user_message.is_some() {
            return;
        }

        let Some(snapshot_entry) = extract_entry_snapshot(entry) else {
            return;
        };
        if snapshot_entry.entry_type != "message" || snapshot_entry.role.as_deref() != Some("user")
        {
            return;
        }

        let Some(text) = snapshot_entry.text else {
            return;
        };
        if is_system_boilerplate_text(&text) {
            return;
        }

        self.first_user_message = Some(truncate_utf8_safe(&text, 200));
    }

    fn capture_last_timestamp(&mut self, entry: &Value) {
        if let Some(timestamp) = entry.get("timestamp").and_then(Value::as_str) {
            if !timestamp.trim().is_empty() {
                self.last_timestamp = Some(timestamp.to_owned());
            }
        }
    }
}

impl SessionSnapshotCollector {
    fn new(payload: &Map<String, Value>, started_at: String) -> Self {
        let prompt_assembly = build_base_prompt_layers(payload);

        Self {
            updated_at: started_at,
            model: None,
            max_context_window_tokens: resolve_model_context_window_from_payload(payload),
            entries: Vec::new(),
            prompt_assembly,
            prompt_assembly_done: false,
        }
    }

    fn consume(&mut self, entry: Value) {
        self.capture_model(&entry);
        self.capture_runtime_window(&entry);
        self.capture_prompt_layers(&entry);
        self.capture_snapshot_entry(&entry);
    }

    fn finish(self, meta: SnapshotMeta) -> ParsedSessionSnapshot {
        ParsedSessionSnapshot {
            provider: SessionProvider::Codex,
            session_id: meta.session_id,
            forked_from_id: meta.forked_from_id,
            workspace_path: meta.workspace_path,
            started_at: meta.started_at,
            updated_at: self.updated_at,
            model: self.model,
            max_context_window_tokens: self.max_context_window_tokens,
            entries: self.entries,
            prompt_assembly: self.prompt_assembly,
        }
    }

    fn capture_model(&mut self, entry: &Value) {
        if self.model.is_none() {
            self.model = extract_turn_context_model(entry);
        }
    }

    fn capture_runtime_window(&mut self, entry: &Value) {
        if self.max_context_window_tokens.is_some() {
            return;
        }

        self.max_context_window_tokens = extract_entry_model_context_window(entry);
    }

    fn capture_prompt_layers(&mut self, entry: &Value) {
        self.update_prompt_assembly_boundary(entry);

        if !self.prompt_assembly_done
            && entry.get("type").and_then(Value::as_str) == Some("response_item")
        {
            extract_prompt_layers(entry, &mut self.prompt_assembly);
        }
    }

    fn update_prompt_assembly_boundary(&mut self, entry: &Value) {
        if self.prompt_assembly_done {
            return;
        }

        if entry
            .get("payload")
            .and_then(Value::as_object)
            .and_then(|payload| payload.get("type"))
            .and_then(Value::as_str)
            == Some("task_complete")
        {
            self.prompt_assembly_done = true;
        }
    }

    fn capture_snapshot_entry(&mut self, entry: &Value) {
        let Some(snapshot_entry) = extract_entry_snapshot(entry) else {
            return;
        };

        self.updated_at = snapshot_entry.timestamp.clone();
        self.entries.push(snapshot_entry);
    }
}

impl SubagentCollector {
    fn new(started_at: String, embedded_context: bool) -> Self {
        Self {
            updated_at: started_at,
            model: None,
            max_context_window_tokens: None,
            entries: Vec::new(),
            error: None,
            capture_entries: true,
            has_open_turn: false,
            embedded_context,
        }
    }

    fn consume(&mut self, entry: Value) {
        if self.consume_session_meta_entry(&entry) {
            return;
        }

        self.capture_model(&entry);
        self.capture_runtime_window(&entry);

        if !self.capture_entries && !self.embedded_context {
            self.update_fork_boundary(&entry);
        }

        if self.capture_entries {
            self.capture_snapshot_entry(&entry);
        }

        self.update_embedded_boundary(&entry);
    }

    fn finish(self, meta: SubagentMeta) -> SubagentSnapshot {
        SubagentSnapshot {
            provider: SessionProvider::Codex,
            session_id: meta.session_id,
            parent_thread_id: meta.parent_thread_id,
            depth: meta.depth,
            agent_nickname: meta.agent_nickname,
            agent_role: meta.agent_role,
            model: self.model,
            max_context_window_tokens: self.max_context_window_tokens,
            started_at: meta.started_at,
            updated_at: self.updated_at,
            entries: self.entries,
            error: self.error,
        }
    }

    fn consume_session_meta_entry(&mut self, entry: &Value) -> bool {
        if entry.get("type").and_then(Value::as_str) == Some("session_meta") {
            self.capture_entries = false;
            self.has_open_turn = false;
            return true;
        }

        false
    }

    fn update_fork_boundary(&mut self, entry: &Value) {
        if self.capture_entries || self.embedded_context {
            return;
        }

        match entry_payload_type(entry) {
            Some("task_started") => self.handle_task_started(),
            Some("task_complete") => self.has_open_turn = false,
            _ => {}
        }
    }

    fn handle_task_started(&mut self) {
        if self.has_open_turn {
            self.capture_entries = true;
        }
        self.has_open_turn = true;
    }

    fn update_embedded_boundary(&mut self, entry: &Value) {
        if !self.embedded_context || !self.capture_entries {
            return;
        }

        match entry_payload_type(entry) {
            Some("task_started") => self.has_open_turn = true,
            Some("task_complete") if self.has_open_turn => {
                self.has_open_turn = false;
                self.capture_entries = false;
            }
            _ => {}
        }
    }

    fn capture_model(&mut self, entry: &Value) {
        if self.model.is_none() {
            self.model = extract_turn_context_model(entry);
        }
    }

    fn capture_runtime_window(&mut self, entry: &Value) {
        if self.max_context_window_tokens.is_some() {
            return;
        }

        self.max_context_window_tokens = extract_entry_model_context_window(entry);
    }

    fn capture_snapshot_entry(&mut self, entry: &Value) {
        if let Some(snapshot_entry) = extract_entry_snapshot(entry) {
            self.updated_at = snapshot_entry.timestamp.clone();
            self.entries.push(snapshot_entry);
            return;
        }

        if self.error.is_none() {
            self.error = extract_error_hint(entry);
        }
    }
}

fn entry_payload_type(entry: &Value) -> Option<&str> {
    entry
        .get("payload")
        .and_then(Value::as_object)
        .and_then(|payload| payload.get("type"))
        .and_then(Value::as_str)
}

fn extract_entry_model_context_window(entry: &Value) -> Option<u64> {
    entry
        .get("payload")
        .and_then(Value::as_object)
        .and_then(resolve_model_context_window_from_payload)
}

fn resolve_model_context_window_from_payload(payload: &Map<String, Value>) -> Option<u64> {
    payload
        .get("model_context_window")
        .and_then(Value::as_u64)
        .or_else(|| {
            payload
                .get("info")
                .and_then(Value::as_object)
                .and_then(|info| info.get("model_context_window"))
                .and_then(Value::as_u64)
        })
        .filter(|window| *window > 0)
}

fn build_base_prompt_layers(payload: &Map<String, Value>) -> Vec<PromptAssemblyLayer> {
    payload
        .get("base_instructions")
        .and_then(|base_instructions| base_instructions.get("text"))
        .and_then(Value::as_str)
        .map(|base_instructions| PromptAssemblyLayer {
            layer_type: "system".to_owned(),
            label: "Base Instructions".to_owned(),
            content_length: base_instructions.len(),
            preview: truncate_utf8_safe(base_instructions, 120),
            raw_content: base_instructions.to_owned(),
        })
        .into_iter()
        .collect()
}

fn read_tail_buffer(session_file: &Path, max_bytes: u64) -> io::Result<(String, bool)> {
    let mut file = File::open(session_file)?;
    let file_len = file.metadata()?.len();
    let offset = file_len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(offset))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    let buffer = String::from_utf8_lossy(&buffer).into_owned();

    Ok((buffer, offset > 0))
}

fn parse_tail_entries(buffer: &str, skip_first_line: bool) -> Vec<SessionEntrySnapshot> {
    let mut lines = buffer.lines();
    if skip_first_line {
        let _ = lines.next();
    }

    let mut entries = Vec::new();
    for line in lines {
        let Some(entry) = parse_entry_line(line) else {
            continue;
        };
        let Some(snapshot_entry) = extract_entry_snapshot(&entry) else {
            continue;
        };
        entries.push(snapshot_entry);
    }

    entries
}

#[cfg(test)]
mod tests {
    use super::{
        parse_archived_index_entry, parse_archived_session_snapshot, parse_live_session_snapshot,
        read_subagent_snapshot, read_tail_entry_snapshots,
    };
    use crate::test_support::TempDir;
    use std::fs;

    const FORK_CONTEXT_LINES: &[&str] = &[
        r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-001","forked_from_id":"parent-001","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Gibbs","agent_role":"explorer"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
        r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#,
        r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#,
        r#"{"timestamp":"2026-03-18T09:12:04.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Hello parent"}]}}"#,
        r#"{"timestamp":"2026-03-18T09:12:10.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"I will help you."}]}}"#,
        r#"{"timestamp":"2026-03-18T09:12:15.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-p1","last_agent_message":"done"}}"#,
        r#"{"timestamp":"2026-03-18T09:13:00.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p2"}}"#,
        r#"{"timestamp":"2026-03-18T09:13:05.000Z","type":"response_item","payload":{"type":"function_call","name":"spawn_agent","call_id":"call-001","arguments":"{\"agent_type\":\"explorer\",\"message\":\"do stuff\",\"fork_context\":true}"}}"#,
        r#"{"timestamp":"2026-03-18T09:13:06.000Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call-001","output":"You are the newly spawned agent."}}"#,
        r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
        r#"{"timestamp":"2026-03-18T09:14:10.100Z","type":"turn_context","payload":{"model":"gpt-5.3-codex-spark","turn_id":"turn-sub-1"}}"#,
        r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"do stuff"}]}}"#,
        r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":null}}"#,
    ];

    #[test]
    fn strips_fork_context_from_subagent_entries() {
        let temp_dir = TempDir::new("fork-context");
        let subagent_file = temp_dir.path.join("sub.jsonl");
        fs::write(&subagent_file, FORK_CONTEXT_LINES.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse subagent file")
            .expect("should produce a snapshot");

        assert_eq!(snapshot.session_id, "sub-001");
        assert_eq!(snapshot.parent_thread_id, "parent-001");
        assert_eq!(snapshot.agent_nickname, "Gibbs");
        assert_eq!(snapshot.agent_role, "explorer");
        assert_eq!(snapshot.model, Some("gpt-5.3-codex-spark".to_owned()));
        assert_eq!(snapshot.entries.len(), 3);
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(snapshot.entries[1].role.as_deref(), Some("user"));
        assert_eq!(snapshot.entries[1].text.as_deref(), Some("do stuff"));
        assert_eq!(snapshot.entries[2].entry_type, "task_complete");
        assert_eq!(snapshot.updated_at, "2026-03-18T09:14:30.000Z");
    }

    #[test]
    fn reads_subagent_without_fork_context() {
        let temp_dir = TempDir::new("no-fork");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-002","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Pasteur","agent_role":"researcher"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.100Z","type":"turn_context","payload":{"model":"gpt-5","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"research this"}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:20.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Here are my findings."}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse subagent file")
            .expect("should produce a snapshot");

        assert_eq!(snapshot.agent_nickname, "Pasteur");
        assert_eq!(snapshot.entries.len(), 4);
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(snapshot.entries[1].role.as_deref(), Some("user"));
        assert_eq!(snapshot.entries[2].entry_type, "message");
        assert_eq!(snapshot.entries[2].role.as_deref(), Some("assistant"));
        assert_eq!(snapshot.entries[3].entry_type, "task_complete");
    }

    #[test]
    fn fork_context_single_incomplete_parent_turn() {
        let temp_dir = TempDir::new("single-turn-fork");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-003","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Hume","agent_role":"explorer"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:10.000Z","type":"response_item","payload":{"type":"function_call","name":"spawn_agent","call_id":"call-x","arguments":"{}"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Working on it."}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse")
            .expect("should produce snapshot");

        assert_eq!(snapshot.agent_nickname, "Hume");
        assert_eq!(snapshot.entries.len(), 3);
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(snapshot.entries[1].role.as_deref(), Some("assistant"));
        assert_eq!(snapshot.entries[2].entry_type, "task_complete");
    }

    #[test]
    fn reads_subagent_when_child_session_meta_appears_after_parent_prelude() {
        let temp_dir = TempDir::new("late-subagent-meta");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#,
            r##"{"timestamp":"2026-03-18T09:12:04.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"# AGENTS.md instructions for /tmp/test"}]}}"##,
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-late","forked_from_id":"parent-001","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Ada","agent_role":"explorer"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.100Z","type":"turn_context","payload":{"model":"gpt-5.3-codex-spark","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Late child marker works."}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse subagent file")
            .expect("should produce a snapshot");

        assert_eq!(snapshot.session_id, "sub-late");
        assert_eq!(snapshot.parent_thread_id, "parent-001");
        assert_eq!(snapshot.agent_nickname, "Ada");
        assert_eq!(snapshot.entries.len(), 3);
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].entry_type, "message");
        assert_eq!(
            snapshot.entries[1].text.as_deref(),
            Some("Late child marker works.")
        );
    }

    #[test]
    fn reads_tail_entries_when_offset_splits_a_utf8_sequence() {
        let temp_dir = TempDir::new("tail-buffer-utf8");
        let session_file = temp_dir.path.join("tail.jsonl");
        let tail_line = r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Tail entry survives"}]}}"#;
        let mut raw = Vec::new();
        raw.extend_from_slice("😀\n".as_bytes());
        raw.extend_from_slice(tail_line.as_bytes());
        fs::write(&session_file, raw).expect("session file should be written");

        let entries = read_tail_entry_snapshots(&session_file, tail_line.len() as u64 + 2, 10)
            .expect("tail entries should load");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].text.as_deref(), Some("Tail entry survives"));
    }

    #[test]
    fn late_subagent_snapshot_stops_before_resumed_parent_turn() {
        let temp_dir = TempDir::new("late-subagent-parent-resume");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
            r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#,
            r#"{"timestamp":"2026-03-18T09:12:04.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Parent prelude"}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{"id":"sub-late","forked_from_id":"parent-001","source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent-001","depth":1,"agent_nickname":"Ada","agent_role":"explorer"}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#,
            r#"{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Child work"}]}}"#,
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#,
            r#"{"timestamp":"2026-03-18T09:15:00.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p2"}}"#,
            r#"{"timestamp":"2026-03-18T09:15:05.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Parent resumed"}]}}"#,
        ];

        fs::write(&subagent_file, lines.join("\n")).unwrap();

        let snapshot = read_subagent_snapshot(&subagent_file)
            .expect("should parse subagent file")
            .expect("should produce a snapshot");

        assert_eq!(snapshot.session_id, "sub-late");
        assert_eq!(snapshot.entries.len(), 3);
        assert_eq!(snapshot.entries[0].entry_type, "task_started");
        assert_eq!(snapshot.entries[1].text.as_deref(), Some("Child work"));
        assert_eq!(snapshot.entries[2].entry_type, "task_complete");
    }

    #[test]
    fn skips_conductor_archived_index_entries() {
        let temp_dir = TempDir::new("archived-index-conductor");
        let session_file = temp_dir.path.join("rollout.jsonl");

        fs::write(
            &session_file,
            r#"{"timestamp":"2026-03-04T10:14:39.570Z","type":"session_meta","payload":{"id":"conductor-archived","timestamp":"2026-03-04T10:14:39.570Z","cwd":"/Users/choegihwan/conductor/workspaces/React-Dashboard/hanoi","source":"exec"}}"#,
        )
        .unwrap();

        let entry = parse_archived_index_entry(&session_file, 50, |workspace_path| {
            workspace_path.contains("/conductor/workspaces/")
        })
        .expect("archived index read should succeed");

        assert!(entry.is_none());
    }

    #[test]
    fn archived_index_uses_last_entry_timestamp_for_updated_at() {
        let temp_dir = TempDir::new("archived-index-last-timestamp");
        let session_file = temp_dir.path.join("rollout.jsonl");

        fs::write(
            &session_file,
            [
                r#"{"timestamp":"2026-03-04T10:14:39.570Z","type":"session_meta","payload":{"id":"archived-001","timestamp":"2026-03-04T10:14:39.570Z","cwd":"/tmp/workspace","source":"desktop"}}"#,
                r#"{"timestamp":"2026-03-04T10:14:40.000Z","type":"turn_context","payload":{"model":"gpt-5"}}"#,
                r#"{"timestamp":"2026-03-04T10:15:00.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Investigate archived run"}]}}"#,
                r#"{"timestamp":"2026-03-04T10:16:45.000Z","type":"event_msg","payload":{"type":"task_complete"}}"#,
            ]
            .join("\n"),
        )
        .unwrap();

        let entry = parse_archived_index_entry(&session_file, 50, |_| false)
            .expect("archived index read should succeed")
            .expect("archived index should parse");

        assert_eq!(entry.started_at, "2026-03-04T10:14:39.570Z");
        assert_eq!(entry.updated_at, "2026-03-04T10:16:45.000Z");
        assert_eq!(entry.model, Some("gpt-5".to_owned()));
        assert_eq!(
            entry.first_user_message.as_deref(),
            Some("Investigate archived run")
        );
    }

    #[test]
    fn skips_conductor_archived_snapshots() {
        let temp_dir = TempDir::new("archived-full-conductor");
        let session_file = temp_dir.path.join("rollout.jsonl");

        fs::write(
            &session_file,
            r#"{"timestamp":"2026-03-04T10:14:39.570Z","type":"session_meta","payload":{"id":"conductor-archived","timestamp":"2026-03-04T10:14:39.570Z","cwd":"/Users/choegihwan/conductor/workspaces/React-Dashboard/hanoi","source":"exec"}}"#,
        )
        .unwrap();

        let snapshot = parse_archived_session_snapshot(&session_file, |workspace_path| {
            workspace_path.contains("/conductor/workspaces/")
        })
        .expect("archived snapshot read should succeed");

        assert!(snapshot.is_none());
    }

    #[test]
    fn parses_runtime_context_window_from_task_started_entries() {
        let temp_dir = TempDir::new("live-runtime-window-task-started");
        let session_file = temp_dir.path.join("rollout.jsonl");

        fs::write(
            &session_file,
            [
                r#"{"timestamp":"2026-03-20T00:00:00.000Z","type":"session_meta","payload":{"id":"runtime-window-main","source":"desktop","cwd":"/tmp/workspace","timestamp":"2026-03-20T00:00:00.000Z"}}"#,
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-main","model_context_window":258400}}"#,
                r#"{"timestamp":"2026-03-20T00:00:02.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Runtime task window found."}]}}"#,
            ]
            .join("\n"),
        )
        .unwrap();

        let snapshot = parse_live_session_snapshot(&session_file, &["desktop"])
            .expect("live snapshot read should succeed")
            .expect("snapshot should parse");

        assert_eq!(snapshot.max_context_window_tokens, Some(258_400));
    }

    #[test]
    fn parses_runtime_context_window_from_token_count_info() {
        let temp_dir = TempDir::new("live-runtime-window-token-count");
        let session_file = temp_dir.path.join("rollout.jsonl");

        fs::write(
            &session_file,
            [
                r#"{"timestamp":"2026-03-20T00:00:00.000Z","type":"session_meta","payload":{"id":"runtime-window-token","source":"desktop","cwd":"/tmp/workspace","timestamp":"2026-03-20T00:00:00.000Z"}}"#,
                r#"{"timestamp":"2026-03-20T00:00:01.000Z","type":"event_msg","payload":{"type":"token_count","info":{"model_context_window":258400,"last_token_usage":{"input_tokens":100,"cached_input_tokens":40,"output_tokens":20,"reasoning_output_tokens":5,"total_tokens":120},"total_token_usage":{"input_tokens":200,"cached_input_tokens":80,"output_tokens":35,"reasoning_output_tokens":5,"total_tokens":235}}}}"#,
            ]
            .join("\n"),
        )
        .unwrap();

        let snapshot = parse_live_session_snapshot(&session_file, &["desktop"])
            .expect("live snapshot read should succeed")
            .expect("snapshot should parse");

        assert_eq!(snapshot.max_context_window_tokens, Some(258_400));
    }
}
