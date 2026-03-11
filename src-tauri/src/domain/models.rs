use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionScope {
    Live,
    Archive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Inflight,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BottleneckLevel {
    Normal,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MiniTimelineItemKind {
    Wait,
    Tool,
    Message,
    Spawn,
    Complete,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MiniTimelineItem {
    pub kind: MiniTimelineItemKind,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub session_id: String,
    pub title: String,
    pub workspace: String,
    pub workspace_hint: Option<String>,
    pub archived: bool,
    pub status: SessionStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub latest_activity_summary: Option<String>,
    pub agent_roles: Vec<String>,
    pub rollout_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionListFilters {
    pub workspace: Option<String>,
    pub query: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListItem {
    pub session_id: String,
    pub title: String,
    pub workspace: String,
    pub workspace_hint: Option<String>,
    pub archived: bool,
    pub status: SessionStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub latest_activity_summary: Option<String>,
    pub agent_roles: Vec<String>,
    pub bottleneck_level: Option<BottleneckLevel>,
    pub longest_wait_ms: Option<u64>,
    pub active_tool_name: Option<String>,
    pub active_tool_ms: Option<u64>,
    pub mini_timeline_window_started_at: Option<DateTime<Utc>>,
    pub mini_timeline_window_ended_at: Option<DateTime<Utc>>,
    pub mini_timeline: Vec<MiniTimelineItem>,
    pub rollout_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListPayload {
    pub scope: SessionScope,
    pub filters: SessionListFilters,
    pub workspaces: Vec<String>,
    pub sessions: Vec<SessionListItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSession {
    pub session_id: String,
    pub thread_id: String,
    pub agent_role: String,
    pub agent_nickname: Option<String>,
    pub depth: u8,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub rollout_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StoredEventKind {
    UserMessage,
    Commentary,
    ToolCall,
    Wait,
    Spawn,
    FinalAnswer,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct SessionEventRecord {
    pub event_id: String,
    pub agent_session_id: Option<String>,
    pub kind: StoredEventKind,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SessionWaitRecord {
    pub call_id: String,
    pub parent_session_id: String,
    pub child_session_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct SessionToolRecord {
    pub call_id: String,
    pub agent_session_id: Option<String>,
    pub tool_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawJsonlSnippetLine {
    pub line_number: u32,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawJsonlSnippet {
    pub source_label: String,
    pub lines: Vec<RawJsonlSnippetLine>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SessionLaneRef {
    User,
    Main { session_id: String },
    Subagent { agent_session_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionFlowColumn {
    User,
    Main,
    Subagent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionFlowItemKind {
    UserMessage,
    Commentary,
    ToolCall,
    Wait,
    Spawn,
    FinalAnswer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLane {
    pub lane_ref: SessionLaneRef,
    pub column: SessionFlowColumn,
    pub label: String,
    pub depth: u8,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFlowItem {
    pub item_id: String,
    pub lane: SessionLaneRef,
    pub kind: SessionFlowItemKind,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub summary: Option<String>,
    pub target_lane: Option<SessionLaneRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFlowPayload {
    pub session: SessionSummary,
    pub lanes: Vec<SessionLane>,
    pub items: Vec<SessionFlowItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionToolCall {
    pub call_id: String,
    pub tool_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWaitSpan {
    pub call_id: String,
    pub parent_session_id: String,
    pub child_session_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionLaneInspectorDegradedReason {
    MissingRollout,
    UnreadableRollout,
    InvalidRollout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLaneInspectorPayload {
    pub lane: SessionLane,
    pub latest_commentary_summary: Option<String>,
    pub latest_commentary_at: Option<DateTime<Utc>>,
    pub recent_tool_calls: Vec<SessionToolCall>,
    pub related_waits: Vec<SessionWaitSpan>,
    pub raw_snippet: Option<RawJsonlSnippet>,
    pub degraded_reason: Option<SessionLaneInspectorDegradedReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SummaryDashboardFilters {
    pub workspace: Option<String>,
    pub session_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryDashboardKpis {
    pub session_count: u32,
    pub active_session_count: u32,
    pub completed_session_count: u32,
    pub average_duration_ms: Option<u64>,
    pub workspace_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryWorkspaceMetric {
    pub workspace: String,
    pub session_count: u32,
    pub average_duration_ms: Option<u64>,
    pub latest_updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryRoleMetric {
    pub agent_role: String,
    pub session_count: u32,
    pub average_duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarySessionCompareRow {
    pub session_id: String,
    pub title: String,
    pub workspace: String,
    pub workspace_hint: Option<String>,
    pub status: SessionStatus,
    pub updated_at: Option<DateTime<Utc>>,
    pub latest_activity_summary: Option<String>,
    pub duration_ms: Option<u64>,
    pub agent_roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryDashboardPayload {
    pub filters: SummaryDashboardFilters,
    pub kpis: SummaryDashboardKpis,
    pub workspace_distribution: Vec<SummaryWorkspaceMetric>,
    pub role_mix: Vec<SummaryRoleMetric>,
    pub session_compare: Vec<SummarySessionCompareRow>,
}
