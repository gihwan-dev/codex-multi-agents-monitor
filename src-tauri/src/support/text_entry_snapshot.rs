use crate::domain::session::SessionEntrySnapshot;
use serde_json::{Map, Value};

use super::truncate_utf8_safe;

struct SnapshotContext<'a> {
    timestamp: String,
    payload: &'a Map<String, Value>,
}

struct FunctionCallData {
    name: String,
    call_id: Option<String>,
    arguments: Option<String>,
}

pub(crate) fn extract_error_hint(entry: &Value) -> Option<String> {
    let payload = entry.get("payload")?.as_object()?;
    let payload_type = payload.get("type").and_then(Value::as_str)?;

    if payload_type == "error" {
        return payload
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| {
                payload
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
            })
            .map(ToOwned::to_owned);
    }

    if payload_type == "turn_aborted" {
        return payload
            .get("reason")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or(Some("Turn aborted".to_owned()));
    }

    None
}

pub(crate) fn extract_entry_snapshot(entry: &Value) -> Option<SessionEntrySnapshot> {
    let context = SnapshotContext::from_entry(entry)?;
    if entry.get("type").and_then(Value::as_str) == Some("compacted") {
        return Some(build_compacted_summary_snapshot(&context));
    }

    if let Some(snapshot) = build_message_entry(&context) {
        return Some(snapshot);
    }
    if let Some(snapshot) = build_function_entry(&context) {
        return Some(snapshot);
    }

    build_state_entry(&context)
}

pub(crate) fn extract_turn_context_model(entry: &Value) -> Option<String> {
    if entry.get("type").and_then(Value::as_str) != Some("turn_context") {
        return None;
    }

    entry
        .get("payload")
        .and_then(|payload| payload.get("model"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
}

fn extract_message_text(content: &Value) -> Option<String> {
    let items = content.as_array()?;
    let mut parts = Vec::new();

    for item in items {
        let Some(part) = extract_message_part(item) else {
            continue;
        };
        parts.push(part);
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn extract_message_part(item: &Value) -> Option<String> {
    match item {
        Value::String(value) => trimmed_string(value),
        Value::Object(value) => extract_object_message_part(value),
        _ => None,
    }
}

fn extract_object_message_part(value: &Map<String, Value>) -> Option<String> {
    let content_type = value.get("type").and_then(Value::as_str).unwrap_or_default();
    if content_type == "input_image" {
        return Some("[Image]".to_owned());
    }
    if !matches!(content_type, "input_text" | "output_text" | "text") {
        return None;
    }

    value
        .get("text")
        .and_then(Value::as_str)
        .and_then(trimmed_string)
}

fn trimmed_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

impl<'a> SnapshotContext<'a> {
    fn from_entry(entry: &'a Value) -> Option<Self> {
        let timestamp = entry.get("timestamp")?.as_str()?.to_owned();
        let payload = entry.get("payload")?.as_object()?;

        Some(Self { timestamp, payload })
    }

    fn payload_type(&self) -> Option<&str> {
        self.payload.get("type").and_then(Value::as_str)
    }

    fn string(&self, key: &str) -> Option<&str> {
        self.payload.get(key).and_then(Value::as_str)
    }
}

fn build_message_entry(context: &SnapshotContext<'_>) -> Option<SessionEntrySnapshot> {
    if context.payload_type()? != "message" {
        return None;
    }

    let role = context.string("role")?;
    if !matches!(role, "user" | "assistant") {
        return None;
    }

    let text = extract_message_text(context.payload.get("content")?);
    Some(SessionEntrySnapshot {
        timestamp: context.timestamp.clone(),
        entry_type: "message".to_owned(),
        role: Some(role.to_owned()),
        text,
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    })
}

fn build_function_entry(context: &SnapshotContext<'_>) -> Option<SessionEntrySnapshot> {
    let payload_type = context.payload_type()?;
    match payload_type {
        "function_call" => Some(build_function_call_entry(context)),
        "function_call_output" => Some(build_function_output_entry(context)),
        "custom_tool_call" => Some(build_custom_tool_call_entry(context)),
        "custom_tool_call_output" => Some(build_custom_tool_output_entry(context)),
        "web_search_call" => Some(build_web_search_entry(context)),
        _ => None,
    }
}

fn build_state_entry(context: &SnapshotContext<'_>) -> Option<SessionEntrySnapshot> {
    match context.payload_type()? {
        "reasoning" => Some(build_empty_snapshot(context, "reasoning")),
        "task_started" => Some(build_empty_snapshot(context, "task_started")),
        "task_complete" => Some(build_task_complete_entry(context)),
        "agent_message" => Some(build_agent_message_entry(context)),
        "context_compacted" => {
            let text = context
                .string("summary")
                .map(|s| truncate_utf8_safe(s, 2000));
            Some(build_text_snapshot(context, "context_compacted", text))
        }
        "turn_aborted" => Some(build_reason_entry(context, "turn_aborted")),
        "thread_rolled_back" => Some(build_reason_entry(context, "thread_rolled_back")),
        "agent_reasoning" => Some(build_agent_reasoning_entry(context)),
        "item_completed" => Some(build_item_completed_entry(context)),
        "token_count" => build_token_count_entry(context),
        _ => None,
    }
}

fn build_function_call_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let name = context.string("name").unwrap_or("unknown").to_owned();
    let arguments = preview_function_call_arguments(context, &name);
    let call = FunctionCallData {
        name,
        call_id: context.string("call_id").map(ToOwned::to_owned),
        arguments,
    };

    build_function_call_snapshot(context, call)
}

fn build_function_output_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let call_id = context.string("call_id").map(ToOwned::to_owned);
    let output = context
        .string("output")
        .map(|output| truncate_utf8_safe(output, 2000));

    build_function_output_snapshot(context, call_id, output)
}

fn build_custom_tool_call_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let name = context.string("name").unwrap_or("custom_tool").to_owned();
    let arguments = preview_custom_tool_arguments(context, &name);
    let call = FunctionCallData {
        name,
        call_id: context.string("call_id").map(ToOwned::to_owned),
        arguments,
    };

    build_function_call_snapshot(context, call)
}

fn build_custom_tool_output_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let call_id = context.string("call_id").map(ToOwned::to_owned);
    let output = context
        .string("output")
        .map(|output| truncate_utf8_safe(output, 2000));

    build_function_output_snapshot(context, call_id, output)
}

fn build_web_search_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let preview = build_web_search_preview(context);
    let call = FunctionCallData {
        name: "web_search".to_owned(),
        call_id: None,
        arguments: preview,
    };

    build_function_call_snapshot(context, call)
}

fn build_task_complete_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let text = context
        .string("last_agent_message")
        .filter(|value| !value.trim().is_empty())
        .map(|text| truncate_utf8_safe(text, 500));

    build_text_snapshot(context, "task_complete", text)
}

fn build_agent_message_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let text = context
        .string("message")
        .or_else(|| context.string("text"))
        .map(|text| truncate_utf8_safe(text, 1000));

    build_text_snapshot(context, "agent_message", text)
}

fn build_reason_entry(context: &SnapshotContext<'_>, entry_type: &str) -> SessionEntrySnapshot {
    let reason = context.string("reason").map(ToOwned::to_owned);
    build_text_snapshot(context, entry_type, reason)
}

fn build_agent_reasoning_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let text = context
        .string("text")
        .map(|text| truncate_utf8_safe(text, 1000));

    build_text_snapshot(context, "agent_reasoning", text)
}

fn build_item_completed_entry(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let text = context
        .payload
        .get("item")
        .and_then(|item| item.get("text"))
        .and_then(Value::as_str)
        .map(|text| truncate_utf8_safe(text, 1000));

    build_text_snapshot(context, "item_completed", text)
}

fn build_token_count_entry(context: &SnapshotContext<'_>) -> Option<SessionEntrySnapshot> {
    let usage = context
        .payload
        .get("info")
        .and_then(Value::as_object)?
        .get("last_token_usage")
        .and_then(Value::as_object)?;

    let text = format!(
        r#"{{"in":{},"cached":{},"out":{},"reasoning":{}}}"#,
        usage.get("input_tokens").and_then(Value::as_u64).unwrap_or(0),
        usage.get("cached_input_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        usage.get("output_tokens").and_then(Value::as_u64).unwrap_or(0),
        usage.get("reasoning_output_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0)
    );

    Some(build_text_snapshot(context, "token_count", Some(text)))
}

fn preview_function_call_arguments(
    context: &SnapshotContext<'_>,
    name: &str,
) -> Option<String> {
    let arguments = context.string("arguments")?;
    match name {
        "exec_command" => preview_exec_command_arguments(arguments),
        "spawn_agent" | "close_agent" | "wait" | "wait_agent" | "resume_agent"
        | "send_input" => Some(truncate_utf8_safe(arguments, 2000)),
        _ => Some(truncate_utf8_safe(arguments, 200)),
    }
}

fn preview_exec_command_arguments(arguments: &str) -> Option<String> {
    serde_json::from_str::<Value>(arguments)
        .ok()
        .and_then(|value| {
            value
                .get("cmd")
                .and_then(Value::as_str)
                .map(|command| truncate_utf8_safe(command, 500))
        })
        .or_else(|| Some(truncate_utf8_safe(arguments, 500)))
}

fn preview_custom_tool_arguments(
    context: &SnapshotContext<'_>,
    name: &str,
) -> Option<String> {
    let arguments = raw_custom_tool_arguments(context)?;
    match name {
        "apply_patch" => Some(preview_apply_patch_arguments(arguments)),
        "spawn_agent" | "close_agent" | "wait" | "wait_agent" | "resume_agent"
        | "send_input" => Some(truncate_utf8_safe(arguments, 2000)),
        _ => Some(truncate_utf8_safe(arguments, 200)),
    }
}

fn raw_custom_tool_arguments<'a>(context: &'a SnapshotContext<'_>) -> Option<&'a str> {
    context
        .string("arguments")
        .or_else(|| context.string("input"))
}

fn preview_apply_patch_arguments(arguments: &str) -> String {
    let file_paths = arguments
        .lines()
        .filter_map(parse_patch_file_path)
        .collect::<Vec<_>>();

    match file_paths.as_slice() {
        [] => truncate_utf8_safe(arguments, 200),
        [path] => truncate_utf8_safe(path.trim(), 200),
        [first, rest @ ..] => format!(
            "{} (+{} more)",
            truncate_utf8_safe(first.trim(), 200),
            rest.len()
        ),
    }
}

fn parse_patch_file_path(line: &str) -> Option<&str> {
    line.strip_prefix("*** Add File: ")
        .or_else(|| line.strip_prefix("*** Update File: "))
        .or_else(|| line.strip_prefix("*** Delete File: "))
}

fn build_web_search_preview(context: &SnapshotContext<'_>) -> Option<String> {
    let action = context.payload.get("action")?;

    action
        .get("queries")
        .and_then(Value::as_array)
        .filter(|queries| !queries.is_empty())
        .map(|queries| {
            let joined = queries
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(" | ");
            truncate_utf8_safe(&joined, 500)
        })
        .or_else(|| {
            action
                .get("query")
                .and_then(Value::as_str)
                .map(|query| truncate_utf8_safe(query, 200))
        })
}

fn build_compacted_summary_snapshot(context: &SnapshotContext<'_>) -> SessionEntrySnapshot {
    let summary = summarize_replacement_history(context.payload);
    build_text_snapshot(context, "context_compacted", summary)
}

fn summarize_replacement_history(payload: &Map<String, Value>) -> Option<String> {
    let items = payload.get("replacement_history").and_then(Value::as_array)?;
    if items.is_empty() {
        return None;
    }

    let (user_count, developer_count, assistant_count) = count_roles_in_history(items);
    let tool_names = collect_tool_names_from_history(items, 5);

    let total = items.len();
    let mut summary = format!(
        "{total} messages compacted ({user_count} user, {developer_count} developer, {assistant_count} assistant)"
    );

    if !tool_names.is_empty() {
        summary.push_str(" · tools: ");
        summary.push_str(&tool_names.join(", "));
    }

    Some(summary)
}

fn count_roles_in_history(items: &[Value]) -> (usize, usize, usize) {
    let mut user = 0;
    let mut developer = 0;
    let mut assistant = 0;

    for item in items {
        match item.get("role").and_then(Value::as_str) {
            Some("user") => user += 1,
            Some("developer") => developer += 1,
            Some("assistant") => assistant += 1,
            _ => {}
        }
    }

    (user, developer, assistant)
}

fn collect_tool_names_from_history(items: &[Value], max: usize) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();

    for item in items {
        let Some(content) = item.get("content").and_then(Value::as_array) else {
            continue;
        };
        for part in content {
            if part.get("type").and_then(Value::as_str) != Some("tool_use") {
                continue;
            }
            if let Some(name) = part.get("name").and_then(Value::as_str) {
                if names.len() < max && !names.iter().any(|n| n == name) {
                    names.push(name.to_owned());
                }
            }
        }
    }

    names
}

fn build_empty_snapshot(context: &SnapshotContext<'_>, entry_type: &str) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: context.timestamp.clone(),
        entry_type: entry_type.to_owned(),
        role: None,
        text: None,
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    }
}

fn build_text_snapshot(
    context: &SnapshotContext<'_>,
    entry_type: &str,
    text: Option<String>,
) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: context.timestamp.clone(),
        entry_type: entry_type.to_owned(),
        role: None,
        text,
        function_name: None,
        function_call_id: None,
        function_arguments_preview: None,
    }
}

fn build_function_call_snapshot(
    context: &SnapshotContext<'_>,
    call: FunctionCallData,
) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: context.timestamp.clone(),
        entry_type: "function_call".to_owned(),
        role: None,
        text: None,
        function_name: Some(call.name),
        function_call_id: call.call_id,
        function_arguments_preview: call.arguments,
    }
}

fn build_function_output_snapshot(
    context: &SnapshotContext<'_>,
    call_id: Option<String>,
    output: Option<String>,
) -> SessionEntrySnapshot {
    SessionEntrySnapshot {
        timestamp: context.timestamp.clone(),
        entry_type: "function_call_output".to_owned(),
        role: None,
        text: output,
        function_name: None,
        function_call_id: call_id,
        function_arguments_preview: None,
    }
}
