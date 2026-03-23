use crate::domain::{
    ingest_policy::DEFAULT_THREAD_TITLE,
    session::SessionEntrySnapshot,
};

use super::{is_system_boilerplate_text, truncate_utf8_safe};

pub(crate) fn extract_first_user_message(entries: &[SessionEntrySnapshot]) -> Option<String> {
    entries.iter().find_map(|entry| {
        if entry.entry_type != "message" || entry.role.as_deref() != Some("user") {
            return None;
        }

        let text = entry.text.as_deref()?.trim();
        if text.is_empty() || is_system_boilerplate_text(text) {
            return None;
        }

        Some(truncate_utf8_safe(text, 200))
    })
}

pub(crate) fn derive_recent_index_title(entries: &[SessionEntrySnapshot]) -> String {
    let title = extract_first_user_message(entries)
        .map(|message| sanitize_summary_text(&message))
        .filter(|message| !message.is_empty())
        .unwrap_or_else(|| DEFAULT_THREAD_TITLE.to_owned());

    truncate_utf8_safe(&title, 120)
}

pub(crate) fn derive_recent_index_status(entries: &[SessionEntrySnapshot]) -> String {
    let has_abort = has_abort_event(entries);
    let Some(latest_message) = find_latest_meaningful_message(entries) else {
        return fallback_status(has_abort);
    };

    if message_marks_interrupted(latest_message) || abort_happened_after(entries, latest_message) {
        return "interrupted".to_owned();
    }

    if latest_message.role.as_deref() == Some("user") {
        return user_message_status(entries, latest_message);
    }

    "done".to_owned()
}

pub(crate) fn derive_recent_index_last_summary(entries: &[SessionEntrySnapshot]) -> String {
    entries
        .iter()
        .rev()
        .find_map(summarize_recent_entry)
        .unwrap_or_else(|| "No event summary yet.".to_owned())
}

fn has_abort_event(entries: &[SessionEntrySnapshot]) -> bool {
    entries.iter().any(is_abort_entry)
}

fn is_abort_entry(entry: &SessionEntrySnapshot) -> bool {
    matches!(
        entry.entry_type.as_str(),
        "turn_aborted" | "thread_rolled_back"
    )
}

fn find_latest_meaningful_message(
    entries: &[SessionEntrySnapshot],
) -> Option<&SessionEntrySnapshot> {
    entries.iter().rev().find(|entry| {
        entry.entry_type == "message"
            && entry
                .text
                .as_deref()
                .map(is_meaningful_message_text)
                .unwrap_or(false)
    })
}

fn is_meaningful_message_text(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed.starts_with("<turn_aborted>") || !is_system_boilerplate_text(trimmed)
}

fn fallback_status(has_abort: bool) -> String {
    if has_abort {
        "interrupted".to_owned()
    } else {
        "done".to_owned()
    }
}

fn message_marks_interrupted(entry: &SessionEntrySnapshot) -> bool {
    entry.text
        .as_deref()
        .is_some_and(|text| text.contains("<turn_aborted>"))
}

fn abort_happened_after(
    entries: &[SessionEntrySnapshot],
    latest_message: &SessionEntrySnapshot,
) -> bool {
    entries
        .iter()
        .rev()
        .find(|entry| is_abort_entry(entry))
        .is_some_and(|last_abort| last_abort.timestamp >= latest_message.timestamp)
}

fn user_message_status(
    entries: &[SessionEntrySnapshot],
    latest_message: &SessionEntrySnapshot,
) -> String {
    if has_completion_after(entries, latest_message) {
        "done".to_owned()
    } else {
        "running".to_owned()
    }
}

fn has_completion_after(
    entries: &[SessionEntrySnapshot],
    latest_message: &SessionEntrySnapshot,
) -> bool {
    entries.iter().any(|entry| {
        entry.entry_type == "task_complete" && entry.timestamp >= latest_message.timestamp
    })
}

fn summarize_recent_entry(entry: &SessionEntrySnapshot) -> Option<String> {
    match entry.entry_type.as_str() {
        "message" => summarize_message(entry),
        "function_call_output"
        | "task_complete"
        | "agent_message"
        | "agent_reasoning"
        | "item_completed"
        | "turn_aborted"
        | "thread_rolled_back" => summarize_text_entry(entry),
        "function_call" => summarize_function_call(entry),
        _ => None,
    }
}

fn summarize_message(entry: &SessionEntrySnapshot) -> Option<String> {
    let text = entry.text.as_deref()?;
    let trimmed = text.trim();
    if trimmed.is_empty() || is_system_boilerplate_text(trimmed) {
        return None;
    }

    Some(truncate_utf8_safe(&sanitize_summary_text(trimmed), 160))
}

fn summarize_text_entry(entry: &SessionEntrySnapshot) -> Option<String> {
    let text = entry.text.as_deref()?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(truncate_utf8_safe(&sanitize_summary_text(trimmed), 160))
}

fn summarize_function_call(entry: &SessionEntrySnapshot) -> Option<String> {
    if let Some(arguments) = entry.function_arguments_preview.as_deref() {
        let trimmed = arguments.trim();
        if !trimmed.is_empty() {
            let summary = format!(
                "{}: {}",
                entry.function_name.as_deref().unwrap_or("tool"),
                sanitize_summary_text(trimmed)
            );
            return Some(truncate_utf8_safe(&summary, 160));
        }
    }

    entry.function_name
        .as_deref()
        .map(|name| truncate_utf8_safe(name, 160))
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn sanitize_summary_text(text: &str) -> String {
    collapse_whitespace(text)
        .trim()
        .trim_start_matches('$')
        .to_owned()
}
