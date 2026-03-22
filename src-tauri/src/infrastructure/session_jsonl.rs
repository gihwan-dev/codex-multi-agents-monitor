use crate::{
    domain::session::{PromptAssemblyLayer, SessionEntrySnapshot, SubagentSnapshot},
    support::text::{
        derive_recent_index_last_summary, derive_recent_index_status, derive_recent_index_title,
        extract_entry_snapshot, extract_error_hint, extract_first_user_message,
        extract_prompt_layers, extract_turn_context_model, is_system_boilerplate_text,
        truncate_utf8_safe,
    },
};
use serde_json::Value;
use std::{
    fs::File,
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom},
    path::Path,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ParsedRecentIndexEntry {
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
    pub(crate) session_id: String,
    pub(crate) forked_from_id: Option<String>,
    pub(crate) workspace_path: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) entries: Vec<SessionEntrySnapshot>,
    pub(crate) prompt_assembly: Vec<PromptAssemblyLayer>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ParsedArchivedIndexEntry {
    pub(crate) session_id: String,
    pub(crate) workspace_path: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) first_user_message: Option<String>,
}

pub(crate) fn read_subagent_snapshot(session_file: &Path) -> io::Result<Option<SubagentSnapshot>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "payload missing"))?;

    let thread_spawn = payload
        .get("source")
        .and_then(|source| source.get("subagent"))
        .and_then(|subagent| subagent.get("thread_spawn"))
        .and_then(Value::as_object);

    let thread_spawn = match thread_spawn {
        Some(thread_spawn) => thread_spawn,
        None => return Ok(None),
    };

    let parent_thread_id = thread_spawn
        .get("parent_thread_id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let depth = thread_spawn
        .get("depth")
        .and_then(Value::as_u64)
        .unwrap_or(1) as u32;
    let agent_nickname = thread_spawn
        .get("agent_nickname")
        .and_then(Value::as_str)
        .unwrap_or("Subagent")
        .to_owned();
    let agent_role = thread_spawn
        .get("agent_role")
        .or_else(|| thread_spawn.get("subagent_type"))
        .and_then(Value::as_str)
        .unwrap_or("agent")
        .to_owned();

    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;
    let mut error: Option<String> = None;
    let mut past_fork_boundary = true;
    let mut has_open_turn = false;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if entry.get("type").and_then(Value::as_str) == Some("session_meta") {
            past_fork_boundary = false;
            continue;
        }

        if !past_fork_boundary {
            let payload_type = entry
                .get("payload")
                .and_then(|payload| payload.get("type"))
                .and_then(Value::as_str);
            match payload_type {
                Some("task_started") => {
                    if has_open_turn {
                        past_fork_boundary = true;
                    }
                    has_open_turn = true;
                }
                Some("task_complete") => {
                    has_open_turn = false;
                }
                _ => {}
            }
        }

        if let Some(model_name) = extract_turn_context_model(&entry) {
            model = Some(model_name);
        }

        if past_fork_boundary {
            if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
                updated_at = snapshot_entry.timestamp.clone();
                entries.push(snapshot_entry);
            } else if error.is_none() {
                error = extract_error_hint(&entry);
            }
        }
    }

    Ok(Some(SubagentSnapshot {
        session_id,
        parent_thread_id,
        depth,
        agent_nickname,
        agent_role,
        model,
        started_at,
        updated_at,
        entries,
        error,
    }))
}

pub(crate) fn parse_recent_index_entry(
    session_file: &Path,
    prefix_scan_limit: usize,
    tail_bytes: u64,
    tail_entry_limit: usize,
) -> io::Result<Option<ParsedRecentIndexEntry>> {
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = match session_meta.get("payload").and_then(Value::as_object) {
        Some(payload) => payload,
        None => return Ok(None),
    };
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();

    let mut prefix_entries = Vec::new();
    let mut model: Option<String> = None;
    for line in reader.lines().take(prefix_scan_limit).flatten() {
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if model.is_none() {
            model = extract_turn_context_model(&entry);
        }

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            prefix_entries.push(snapshot_entry);
        }
    }

    let tail_entries = read_tail_entry_snapshots(session_file, tail_bytes, tail_entry_limit)?;
    let title = derive_recent_index_title(&prefix_entries);
    let first_user_message = extract_first_user_message(&prefix_entries);
    let updated_at = tail_entries
        .last()
        .map(|entry| entry.timestamp.clone())
        .unwrap_or_else(|| started_at.clone());
    let status = derive_recent_index_status(&tail_entries);
    let last_event_summary = derive_recent_index_last_summary(&tail_entries);

    Ok(Some(ParsedRecentIndexEntry {
        started_at,
        updated_at,
        model,
        first_user_message,
        title,
        status,
        last_event_summary,
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
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = match session_meta.get("payload").and_then(Value::as_object) {
        Some(payload) => payload,
        None => return Ok(None),
    };

    if payload
        .get("source")
        .and_then(|source| source.get("subagent"))
        .is_some()
    {
        return Ok(None);
    }
    if payload.get("source").and_then(Value::as_str).is_none() {
        return Ok(None);
    }

    let workspace_path = payload
        .get("cwd")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_default()
        .to_owned();
    if should_skip_workspace(&workspace_path) {
        return Ok(None);
    }
    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();

    let mut model: Option<String> = None;
    let mut first_user_message: Option<String> = None;
    for line in reader.lines().take(scan_limit) {
        let line = match line {
            Ok(line) => line,
            Err(_) => break,
        };
        if line.trim().is_empty() {
            continue;
        }
        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if model.is_none() {
            model = extract_turn_context_model(&entry);
        }

        if first_user_message.is_none() {
            if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
                if snapshot_entry.entry_type == "message"
                    && snapshot_entry.role.as_deref() == Some("user")
                {
                    if let Some(text) = snapshot_entry.text {
                        if !is_system_boilerplate_text(&text) {
                            first_user_message = Some(truncate_utf8_safe(&text, 200));
                        }
                    }
                }
            }
        }

        if model.is_some() && first_user_message.is_some() {
            break;
        }
    }

    Ok(Some(ParsedArchivedIndexEntry {
        session_id,
        workspace_path,
        started_at: started_at.clone(),
        updated_at: started_at,
        model,
        first_user_message,
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

fn parse_session_snapshot<F>(
    session_file: &Path,
    is_supported_payload: F,
) -> io::Result<Option<ParsedSessionSnapshot>>
where
    F: Fn(&serde_json::Map<String, Value>) -> bool,
{
    let file = File::open(session_file)?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let session_meta = serde_json::from_str::<Value>(&first_line)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let payload = session_meta
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "payload missing"))?;

    if !is_supported_payload(payload) {
        return Ok(None);
    }

    let workspace_path = payload
        .get("cwd")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_default()
        .to_owned();
    let started_at = payload
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| session_meta.get("timestamp").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned();
    let session_id = payload
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| session_file.display().to_string());
    let forked_from_id = payload
        .get("forked_from_id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned);

    let mut prompt_assembly = Vec::new();
    if let Some(base_instructions) = payload
        .get("base_instructions")
        .and_then(|base_instructions| base_instructions.get("text"))
        .and_then(Value::as_str)
    {
        prompt_assembly.push(PromptAssemblyLayer {
            layer_type: "system".to_owned(),
            label: "Base Instructions".to_owned(),
            content_length: base_instructions.len(),
            preview: truncate_utf8_safe(base_instructions, 120),
            raw_content: base_instructions.to_owned(),
        });
    }

    let mut entries = Vec::new();
    let mut updated_at = started_at.clone();
    let mut model: Option<String> = None;
    let mut prompt_assembly_done = false;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(&line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if model.is_none() {
            model = extract_turn_context_model(&entry);
        }

        if !prompt_assembly_done {
            if let Some(payload) = entry.get("payload").and_then(Value::as_object) {
                if payload.get("type").and_then(Value::as_str) == Some("task_complete") {
                    prompt_assembly_done = true;
                }
            }
        }

        if !prompt_assembly_done
            && entry.get("type").and_then(Value::as_str) == Some("response_item")
        {
            extract_prompt_layers(&entry, &mut prompt_assembly);
        }

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            updated_at = snapshot_entry.timestamp.clone();
            entries.push(snapshot_entry);
        }
    }

    Ok(Some(ParsedSessionSnapshot {
        session_id,
        forked_from_id,
        workspace_path,
        started_at,
        updated_at,
        model,
        entries,
        prompt_assembly,
    }))
}

pub(crate) fn read_tail_entry_snapshots(
    session_file: &Path,
    max_bytes: u64,
    max_entries: usize,
) -> io::Result<Vec<SessionEntrySnapshot>> {
    let mut file = File::open(session_file)?;
    let file_len = file.metadata()?.len();
    let offset = file_len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(offset))?;

    let mut buffer = String::new();
    file.read_to_string(&mut buffer)?;
    let mut lines = buffer.lines();
    if offset > 0 {
        let _ = lines.next();
    }

    let mut entries = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if let Some(snapshot_entry) = extract_entry_snapshot(&entry) {
            entries.push(snapshot_entry);
        }
    }

    if entries.len() > max_entries {
        entries.drain(0..entries.len() - max_entries);
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::{
        parse_archived_index_entry, parse_archived_session_snapshot, read_subagent_snapshot,
    };
    use crate::test_support::TempDir;
    use std::fs;

    #[test]
    fn strips_fork_context_from_subagent_entries() {
        let temp_dir = TempDir::new("fork-context");
        let subagent_file = temp_dir.path.join("sub.jsonl");

        let lines = [
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

        fs::write(&subagent_file, lines.join("\n")).unwrap();

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
}
