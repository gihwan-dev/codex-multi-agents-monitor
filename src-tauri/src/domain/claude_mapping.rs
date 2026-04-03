pub(crate) fn map_claude_block_entry_type(block_type: &str) -> Option<&'static str> {
    match block_type {
        "thinking" => Some("reasoning"),
        "text" => Some("message"),
        "tool_use" => Some("function_call"),
        "tool_result" => Some("function_call_output"),
        _ => None,
    }
}

pub(crate) fn map_claude_record_entry_type(record_type: &str) -> Option<&'static str> {
    match record_type {
        "progress" | "system" => Some("agent_message"),
        _ => None,
    }
}
