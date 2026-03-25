use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionEntrySnapshot {
    pub(crate) timestamp: String,
    pub(crate) entry_type: String,
    pub(crate) role: Option<String>,
    pub(crate) text: Option<String>,
    pub(crate) function_name: Option<String>,
    pub(crate) function_call_id: Option<String>,
    pub(crate) function_arguments_preview: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SubagentSnapshot {
    pub(crate) session_id: String,
    pub(crate) parent_thread_id: String,
    pub(crate) depth: u32,
    pub(crate) agent_nickname: String,
    pub(crate) agent_role: String,
    pub(crate) model: Option<String>,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) entries: Vec<SessionEntrySnapshot>,
    pub(crate) error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionLogSnapshot {
    pub(crate) session_id: String,
    pub(crate) forked_from_id: Option<String>,
    pub(crate) workspace_path: String,
    pub(crate) origin_path: String,
    pub(crate) display_name: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) entries: Vec<SessionEntrySnapshot>,
    pub(crate) subagents: Vec<SubagentSnapshot>,
    pub(crate) is_archived: bool,
    pub(crate) prompt_assembly: Vec<PromptAssemblyLayer>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PromptAssemblyLayer {
    pub(crate) layer_type: String,
    pub(crate) label: String,
    pub(crate) content_length: usize,
    pub(crate) preview: String,
    pub(crate) raw_content: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentSessionIndexItem {
    pub(crate) session_id: String,
    pub(crate) workspace_path: String,
    pub(crate) origin_path: String,
    pub(crate) display_name: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) file_path: String,
    pub(crate) first_user_message: Option<String>,
    pub(crate) title: String,
    pub(crate) status: String,
    pub(crate) last_event_summary: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ArchivedSessionIndex {
    pub(crate) session_id: String,
    pub(crate) workspace_path: String,
    pub(crate) origin_path: String,
    pub(crate) display_name: String,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) model: Option<String>,
    pub(crate) message_count: u32,
    pub(crate) file_path: String,
    pub(crate) first_user_message: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ArchivedSessionIndexResult {
    pub(crate) items: Vec<ArchivedSessionIndex>,
    pub(crate) total: usize,
    pub(crate) has_more: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillInvocationRecord {
    pub(crate) skill_name: String,
    pub(crate) session_id: String,
    pub(crate) timestamp: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillActivityScanResult {
    pub(crate) invocations: Vec<SkillInvocationRecord>,
}
