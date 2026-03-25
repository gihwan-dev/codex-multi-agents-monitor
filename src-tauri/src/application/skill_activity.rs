use crate::{
    domain::session::{SkillActivityScanResult, SkillInvocationRecord},
    infrastructure::filesystem::{collect_jsonl_files, recent_file_modified_at, resolve_codex_home},
    support::text::extract_skill_name_public,
};
use serde_json::Value;
use std::{
    fs::File,
    io::{self, BufRead, BufReader},
    path::PathBuf,
};

const MAX_SCAN_FILES: usize = 200;

fn collect_session_files() -> io::Result<Vec<PathBuf>> {
    let codex_home = resolve_codex_home()?;
    let mut files = Vec::new();
    collect_jsonl_files(&codex_home.join("sessions"), &mut files)?;
    collect_jsonl_files(&codex_home.join("archived_sessions"), &mut files)?;
    files.sort_by(|a, b| recent_file_modified_at(b).cmp(&recent_file_modified_at(a)));
    files.truncate(MAX_SCAN_FILES);
    Ok(files)
}

fn extract_session_id(entry: &Value) -> Option<String> {
    entry.get("payload")
        .and_then(|p| p.get("id"))
        .and_then(Value::as_str)
        .map(String::from)
}

fn extract_updated_at(entry: &Value) -> Option<String> {
    entry.get("timestamp")
        .and_then(Value::as_str)
        .map(String::from)
}

fn scan_skill_invocations_in_file(path: &PathBuf) -> Vec<SkillInvocationRecord> {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let reader = BufReader::new(file);
    let mut records = Vec::new();
    let mut session_id = String::new();
    let mut last_timestamp = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let entry: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let entry_type = entry.get("type").and_then(Value::as_str).unwrap_or("");
        if entry_type == "session_meta" {
            if let Some(id) = extract_session_id(&entry) {
                session_id = id;
            }
        }

        if let Some(ts) = extract_updated_at(&entry) {
            last_timestamp = ts;
        }

        if entry_type != "response_item" {
            continue;
        }

        scan_entry_for_skills(&entry, &session_id, &last_timestamp, &mut records);
    }

    records
}

fn scan_entry_for_skills(
    entry: &Value,
    session_id: &str,
    timestamp: &str,
    records: &mut Vec<SkillInvocationRecord>,
) {
    let payload = match entry.get("payload").and_then(Value::as_object) {
        Some(p) => p,
        None => return,
    };
    let role = payload.get("role").and_then(Value::as_str).unwrap_or("");
    if role != "user" {
        return;
    }
    let content = match payload.get("content").and_then(Value::as_array) {
        Some(c) => c,
        None => return,
    };

    for item in content {
        let text = match item.get("text").and_then(Value::as_str) {
            Some(t) => t,
            None => continue,
        };
        let trimmed = text.trim();
        if !trimmed.starts_with("<skill>") {
            continue;
        }
        let name = extract_skill_name_public(trimmed);
        records.push(SkillInvocationRecord {
            skill_name: name,
            session_id: session_id.to_owned(),
            timestamp: timestamp.to_owned(),
        });
    }
}

pub(crate) fn scan_skill_activity_from_disk() -> io::Result<SkillActivityScanResult> {
    let files = collect_session_files()?;
    let mut invocations = Vec::new();

    for path in &files {
        invocations.extend(scan_skill_invocations_in_file(path));
    }

    Ok(SkillActivityScanResult { invocations })
}
