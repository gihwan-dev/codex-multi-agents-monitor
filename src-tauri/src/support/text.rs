use crate::domain::{
    ingest_policy::DEFAULT_THREAD_TITLE,
    session::{PromptAssemblyLayer, SessionEntrySnapshot},
};
use serde_json::Value;

fn classify_developer_content(text: &str) -> (String, String) {
    if text.starts_with("<permissions") {
        ("permissions".into(), "Permissions & Sandbox".into())
    } else if text.starts_with("<app-context>") {
        ("app-context".into(), "App Context".into())
    } else if text.starts_with("<collaboration_mode>") {
        ("collaboration-mode".into(), "Collaboration Mode".into())
    } else if text.starts_with("<apps_instructions>") {
        ("apps".into(), "Apps / Connectors".into())
    } else if text.starts_with("<skills_instructions>") {
        ("skills-catalog".into(), "Skills Catalog".into())
    } else {
        ("system".into(), "Developer Instructions".into())
    }
}

fn classify_user_context(text: &str) -> (String, String) {
    let trimmed = text.trim();
    if trimmed.starts_with("# AGENTS.md instructions") {
        ("agents".into(), "AGENTS.md".into())
    } else if trimmed.starts_with("<environment_context>") {
        ("environment".into(), "Environment Context".into())
    } else if trimmed.starts_with("Automation:") {
        ("automation".into(), "Automation Envelope".into())
    } else if trimmed
        .get(..26)
        .map(|prefix| prefix.eq_ignore_ascii_case("PLEASE IMPLEMENT THIS PLAN"))
        .unwrap_or(false)
    {
        ("delegated".into(), "Delegated Plan".into())
    } else if trimmed.starts_with("<skill>") {
        let name = extract_skill_name(trimmed);
        ("skill".into(), format!("Skill: {name}"))
    } else if trimmed.starts_with("<subagent_notification>") {
        (
            "subagent-notification".into(),
            "Subagent Notification".into(),
        )
    } else if trimmed.starts_with("<turn_aborted>") {
        ("system".into(), "Turn Aborted".into())
    } else {
        ("user".into(), "User Prompt".into())
    }
}

fn extract_skill_name(text: &str) -> String {
    if let Some(start) = text.find("<name>") {
        let after = &text[start + 6..];
        if let Some(end) = after.find("</name>") {
            return after[..end].to_owned();
        }
    }
    "unknown".to_owned()
}

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
            "user" | "skill" | "subagent-notification"
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

pub(crate) fn is_system_boilerplate_text(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed.starts_with("# AGENTS.md instructions")
        || trimmed.starts_with("Automation:")
        || trimmed.starts_with("<environment_context>")
        || trimmed.starts_with("<permissions")
        || trimmed.starts_with("<skill>")
        || trimmed.starts_with("<subagent_notification>")
        || trimmed.starts_with("<turn_aborted>")
        || trimmed
            .get(..26)
            .map(|prefix| prefix.eq_ignore_ascii_case("PLEASE IMPLEMENT THIS PLAN"))
            .unwrap_or(false)
}

pub(crate) fn truncate_utf8_safe(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_owned();
    }
    trimmed.chars().take(max_chars).collect()
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

fn extract_message_text(content: &Value) -> Option<String> {
    let items = content.as_array()?;
    let mut parts = Vec::new();

    for item in items {
        match item {
            Value::String(value) if !value.trim().is_empty() => parts.push(value.trim().to_owned()),
            Value::Object(value) => {
                let content_type = value
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                if content_type == "input_image" {
                    parts.push("[Image]".to_owned());
                    continue;
                }

                if !matches!(content_type, "input_text" | "output_text" | "text") {
                    continue;
                }

                let Some(text) = value.get("text").and_then(Value::as_str) else {
                    continue;
                };
                if !text.trim().is_empty() {
                    parts.push(text.trim().to_owned());
                }
            }
            _ => {}
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

pub(crate) fn extract_entry_snapshot(entry: &Value) -> Option<SessionEntrySnapshot> {
    let timestamp = entry.get("timestamp")?.as_str()?.to_owned();

    if entry.get("type").and_then(Value::as_str) == Some("compacted") {
        return Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "context_compacted".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        });
    }

    let payload = entry.get("payload")?.as_object()?;
    let payload_type = payload.get("type").and_then(Value::as_str)?;

    match payload_type {
        "message" => {
            let role = payload.get("role")?.as_str()?;
            if role != "user" && role != "assistant" {
                return None;
            }
            let text = extract_message_text(payload.get("content")?);
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "message".to_owned(),
                role: Some(role.to_owned()),
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "function_call" => {
            let name = payload
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_owned();
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let arguments = match name.as_str() {
                "exec_command" => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .and_then(|arguments| {
                        serde_json::from_str::<Value>(arguments)
                            .ok()
                            .and_then(|value| {
                                value
                                    .get("cmd")
                                    .and_then(Value::as_str)
                                    .map(|command| truncate_utf8_safe(command, 500))
                            })
                    })
                    .or_else(|| {
                        payload
                            .get("arguments")
                            .and_then(Value::as_str)
                            .map(|arguments| truncate_utf8_safe(arguments, 500))
                    }),
                "spawn_agent" | "close_agent" | "wait" | "wait_agent" | "resume_agent"
                | "send_input" => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .map(|arguments| truncate_utf8_safe(arguments, 2000)),
                _ => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .map(|arguments| truncate_utf8_safe(arguments, 200)),
            };
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call".to_owned(),
                role: None,
                text: None,
                function_name: Some(name),
                function_call_id: call_id,
                function_arguments_preview: arguments,
            })
        }
        "function_call_output" => {
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let output = payload
                .get("output")
                .and_then(Value::as_str)
                .map(|output| truncate_utf8_safe(output, 2000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call_output".to_owned(),
                role: None,
                text: output,
                function_name: None,
                function_call_id: call_id,
                function_arguments_preview: None,
            })
        }
        "custom_tool_call" => {
            let name = payload
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("custom_tool")
                .to_owned();
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let arguments = match name.as_str() {
                "apply_patch" => {
                    let raw = payload
                        .get("arguments")
                        .and_then(Value::as_str)
                        .or_else(|| payload.get("input").and_then(Value::as_str));
                    raw.map(|arguments| {
                        let file_paths: Vec<&str> = arguments
                            .lines()
                            .filter_map(|line| {
                                line.strip_prefix("*** Add File: ")
                                    .or_else(|| line.strip_prefix("*** Update File: "))
                                    .or_else(|| line.strip_prefix("*** Delete File: "))
                            })
                            .collect();
                        if file_paths.len() > 1 {
                            let first = file_paths[0].trim();
                            format!(
                                "{} (+{} more)",
                                truncate_utf8_safe(first, 200),
                                file_paths.len() - 1
                            )
                        } else if file_paths.len() == 1 {
                            truncate_utf8_safe(file_paths[0].trim(), 200)
                        } else {
                            truncate_utf8_safe(arguments, 200)
                        }
                    })
                }
                "spawn_agent" | "close_agent" | "wait" | "wait_agent" | "resume_agent"
                | "send_input" => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .or_else(|| payload.get("input").and_then(Value::as_str))
                    .map(|arguments| truncate_utf8_safe(arguments, 2000)),
                _ => payload
                    .get("arguments")
                    .and_then(Value::as_str)
                    .or_else(|| payload.get("input").and_then(Value::as_str))
                    .map(|arguments| truncate_utf8_safe(arguments, 200)),
            };
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call".to_owned(),
                role: None,
                text: None,
                function_name: Some(name),
                function_call_id: call_id,
                function_arguments_preview: arguments,
            })
        }
        "custom_tool_call_output" => {
            let call_id = payload
                .get("call_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let output = payload
                .get("output")
                .and_then(Value::as_str)
                .map(|output| truncate_utf8_safe(output, 2000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call_output".to_owned(),
                role: None,
                text: output,
                function_name: None,
                function_call_id: call_id,
                function_arguments_preview: None,
            })
        }
        "reasoning" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "reasoning".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
        "task_started" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "task_started".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
        "task_complete" => {
            let text = payload
                .get("last_agent_message")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .map(|text| truncate_utf8_safe(text, 500));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "task_complete".to_owned(),
                role: None,
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "agent_message" => {
            let text = payload
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| payload.get("text").and_then(Value::as_str))
                .map(|text| truncate_utf8_safe(text, 1000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "agent_message".to_owned(),
                role: None,
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "context_compacted" => Some(SessionEntrySnapshot {
            timestamp,
            entry_type: "context_compacted".to_owned(),
            role: None,
            text: None,
            function_name: None,
            function_call_id: None,
            function_arguments_preview: None,
        }),
        "turn_aborted" => {
            let reason = payload
                .get("reason")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "turn_aborted".to_owned(),
                role: None,
                text: reason,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "thread_rolled_back" => {
            let reason = payload
                .get("reason")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "thread_rolled_back".to_owned(),
                role: None,
                text: reason,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "agent_reasoning" => {
            let text = payload
                .get("text")
                .and_then(Value::as_str)
                .map(|text| truncate_utf8_safe(text, 1000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "agent_reasoning".to_owned(),
                role: None,
                text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "item_completed" => {
            let item_text = payload
                .get("item")
                .and_then(|item| item.get("text"))
                .and_then(Value::as_str)
                .map(|text| truncate_utf8_safe(text, 1000));
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "item_completed".to_owned(),
                role: None,
                text: item_text,
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        "web_search_call" => {
            let action = payload.get("action");
            let preview = action
                .and_then(|action| action.get("queries"))
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
                        .and_then(|action| action.get("query"))
                        .and_then(Value::as_str)
                        .map(|query| truncate_utf8_safe(query, 200))
                });
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "function_call".to_owned(),
                role: None,
                text: None,
                function_name: Some("web_search".to_owned()),
                function_call_id: None,
                function_arguments_preview: preview,
            })
        }
        "token_count" => {
            let info = payload.get("info").and_then(Value::as_object)?;
            let last_usage = info.get("last_token_usage").and_then(Value::as_object)?;
            let input = last_usage
                .get("input_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let cached = last_usage
                .get("cached_input_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let output = last_usage
                .get("output_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let reasoning = last_usage
                .get("reasoning_output_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let text = format!(
                r#"{{"in":{input},"cached":{cached},"out":{output},"reasoning":{reasoning}}}"#
            );
            Some(SessionEntrySnapshot {
                timestamp,
                entry_type: "token_count".to_owned(),
                role: None,
                text: Some(text),
                function_name: None,
                function_call_id: None,
                function_arguments_preview: None,
            })
        }
        _ => None,
    }
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

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn sanitize_summary_text(text: &str) -> String {
    collapse_whitespace(text)
        .trim()
        .trim_start_matches('$')
        .to_owned()
}

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
    let has_abort = entries.iter().any(|entry| {
        matches!(
            entry.entry_type.as_str(),
            "turn_aborted" | "thread_rolled_back"
        )
    });

    let latest_message = entries.iter().rev().find(|entry| {
        entry.entry_type == "message"
            && entry
                .text
                .as_deref()
                .map(|text| {
                    let trimmed = text.trim();
                    trimmed.starts_with("<turn_aborted>") || !is_system_boilerplate_text(trimmed)
                })
                .unwrap_or(false)
    });

    let Some(latest_message) = latest_message else {
        return if has_abort {
            "interrupted".to_owned()
        } else {
            "done".to_owned()
        };
    };

    if latest_message
        .text
        .as_deref()
        .is_some_and(|text| text.contains("<turn_aborted>"))
    {
        return "interrupted".to_owned();
    }

    if has_abort {
        let last_abort = entries.iter().rev().find(|entry| {
            matches!(
                entry.entry_type.as_str(),
                "turn_aborted" | "thread_rolled_back"
            )
        });
        if let Some(last_abort) = last_abort {
            if last_abort.timestamp >= latest_message.timestamp {
                return "interrupted".to_owned();
            }
        }
    }

    if latest_message.role.as_deref() == Some("user") {
        let has_completion_after = entries.iter().any(|entry| {
            entry.entry_type == "task_complete" && entry.timestamp >= latest_message.timestamp
        });

        return if has_completion_after {
            "done".to_owned()
        } else {
            "running".to_owned()
        };
    }

    "done".to_owned()
}

pub(crate) fn derive_recent_index_last_summary(entries: &[SessionEntrySnapshot]) -> String {
    for entry in entries.iter().rev() {
        match entry.entry_type.as_str() {
            "message" => {
                if let Some(text) = entry.text.as_deref() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() && !is_system_boilerplate_text(trimmed) {
                        return truncate_utf8_safe(&sanitize_summary_text(trimmed), 160);
                    }
                }
            }
            "function_call_output"
            | "task_complete"
            | "agent_message"
            | "agent_reasoning"
            | "item_completed"
            | "turn_aborted"
            | "thread_rolled_back" => {
                if let Some(text) = entry.text.as_deref() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        return truncate_utf8_safe(&sanitize_summary_text(trimmed), 160);
                    }
                }
            }
            "function_call" => {
                if let Some(arguments) = entry.function_arguments_preview.as_deref() {
                    let trimmed = arguments.trim();
                    if !trimmed.is_empty() {
                        return truncate_utf8_safe(
                            &format!(
                                "{}: {}",
                                entry.function_name.as_deref().unwrap_or("tool"),
                                sanitize_summary_text(trimmed)
                            ),
                            160,
                        );
                    }
                }
                if let Some(name) = entry.function_name.as_deref() {
                    return truncate_utf8_safe(name, 160);
                }
            }
            _ => {}
        }
    }

    "No event summary yet.".to_owned()
}
