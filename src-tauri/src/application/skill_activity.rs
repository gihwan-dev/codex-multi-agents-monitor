use crate::{
    domain::session::{SkillActivityScanResult, SkillInvocationRecord},
    infrastructure::filesystem::{
        collect_jsonl_files, recent_file_modified_at, resolve_codex_home,
    },
    support::text::extract_skill_name_public,
};
use serde_json::Value;
use std::{
    fs::File,
    io::{self, BufRead, BufReader},
    path::PathBuf,
};

fn collect_session_files(limit: usize) -> io::Result<Vec<PathBuf>> {
    let codex_home = resolve_codex_home()?;
    let mut files = Vec::new();
    collect_jsonl_files(&codex_home.join("sessions"), &mut files)?;
    collect_jsonl_files(&codex_home.join("archived_sessions"), &mut files)?;
    files.sort_by_key(|b| std::cmp::Reverse(recent_file_modified_at(b)));
    if limit > 0 {
        files.truncate(limit);
    }
    Ok(files)
}

fn extract_session_id(entry: &Value) -> Option<String> {
    entry
        .get("payload")
        .and_then(|p| p.get("id"))
        .and_then(Value::as_str)
        .map(String::from)
}

struct SessionScanState {
    session_id: String,
    last_timestamp: String,
    records: Vec<SkillInvocationRecord>,
}

fn parse_line(line: &str) -> Option<Value> {
    serde_json::from_str(line).ok()
}

fn process_entry(entry: &Value, state: &mut SessionScanState) {
    let entry_type = entry.get("type").and_then(Value::as_str).unwrap_or("");

    if entry_type == "session_meta" {
        if let Some(id) = extract_session_id(entry) {
            state.session_id = id;
        }
    }

    if let Some(ts) = entry.get("timestamp").and_then(Value::as_str) {
        state.last_timestamp = ts.to_owned();
    }

    if entry_type == "response_item" {
        collect_skill_names_from_entry(entry, state);
    }
}

fn collect_skill_names_from_entry(entry: &Value, state: &mut SessionScanState) {
    let payload = match entry.get("payload").and_then(Value::as_object) {
        Some(p) if p.get("role").and_then(Value::as_str) == Some("user") => p,
        _ => return,
    };
    let content = match payload.get("content").and_then(Value::as_array) {
        Some(c) => c,
        None => return,
    };

    for item in content {
        if let Some(text) = item.get("text").and_then(Value::as_str) {
            let trimmed = text.trim();
            if trimmed.starts_with("<skill>") {
                state.records.push(SkillInvocationRecord {
                    skill_name: extract_skill_name_public(trimmed),
                    session_id: state.session_id.clone(),
                    timestamp: state.last_timestamp.clone(),
                });
            }
        }
    }
}

fn scan_skill_invocations_in_file(path: &PathBuf) -> Vec<SkillInvocationRecord> {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let mut state = SessionScanState {
        session_id: String::new(),
        last_timestamp: String::new(),
        records: Vec::new(),
    };

    for line in BufReader::new(file).lines().map_while(Result::ok) {
        if let Some(entry) = parse_line(&line) {
            process_entry(&entry, &mut state);
        }
    }

    state.records
}

pub(crate) fn scan_skill_activity_from_disk(limit: usize) -> io::Result<SkillActivityScanResult> {
    let files = collect_session_files(limit)?;
    let mut invocations = Vec::new();

    for path in &files {
        invocations.extend(scan_skill_invocations_in_file(path));
    }

    Ok(SkillActivityScanResult { invocations })
}
