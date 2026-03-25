#[path = "text_classification.rs"]
mod classification;
#[path = "text_entry_snapshot.rs"]
mod entry_snapshot;
#[path = "text_recent_index.rs"]
mod recent_index;

use crate::domain::{
    session::PromptAssemblyLayer,
};
use serde_json::Value;

use self::classification::{classify_developer_content, classify_user_context};

pub(crate) use self::classification::is_system_boilerplate_text;
pub(crate) use self::entry_snapshot::{
    extract_entry_snapshot, extract_error_hint, extract_turn_context_model,
};
pub(crate) use self::recent_index::{
    derive_recent_index_last_summary, derive_recent_index_status, derive_recent_index_title,
    extract_first_user_message,
};

pub(crate) fn extract_prompt_layers(entry: &Value, layers: &mut Vec<PromptAssemblyLayer>) {
    let payload = match entry.get("payload").and_then(Value::as_object) {
        Some(payload) => payload,
        None => return,
    };
    let role = payload.get("role").and_then(Value::as_str).unwrap_or("");
    let content = match payload.get("content").and_then(Value::as_array) {
        Some(content) => content,
        None => return,
    };

    for item in content {
        let text = match item.get("text").and_then(Value::as_str) {
            Some(text) if !text.trim().is_empty() => text,
            _ => continue,
        };
        let trimmed = text.trim();
        let (layer_type, label) = match role {
            "developer" => classify_developer_content(trimmed),
            "user" => classify_user_context(trimmed),
            _ => continue,
        };

        if matches!(
            layer_type.as_str(),
            "user" | "subagent-notification"
        ) {
            continue;
        }

        layers.push(PromptAssemblyLayer {
            layer_type,
            label,
            content_length: text.len(),
            preview: truncate_utf8_safe(text, 120),
            raw_content: text.to_owned(),
        });
    }
}

pub(crate) fn truncate_utf8_safe(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_owned();
    }

    trimmed.chars().take(max_chars).collect()
}
