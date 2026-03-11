use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThreadStatus {
    Inflight,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorThread {
    pub thread_id: String,
    pub title: String,
    pub cwd: String,
    pub archived: bool,
    pub status: ThreadStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub latest_activity_summary: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LiveOverviewThread {
    pub thread_id: String,
    pub title: String,
    pub cwd: String,
    pub status: ThreadStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub latest_activity_summary: Option<String>,
    pub agent_roles: Vec<String>,
    pub bottleneck_level: BottleneckLevel,
    pub longest_wait_ms: Option<u64>,
    pub active_tool_name: Option<String>,
    pub active_tool_ms: Option<u64>,
    pub mini_timeline_window_started_at: DateTime<Utc>,
    pub mini_timeline_window_ended_at: DateTime<Utc>,
    pub mini_timeline: Vec<MiniTimelineItem>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub event_id: String,
    pub thread_id: String,
    pub agent_session_id: Option<String>,
    pub kind: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaitSpan {
    pub call_id: String,
    pub thread_id: String,
    pub parent_session_id: String,
    pub child_session_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSpan {
    pub call_id: String,
    pub thread_id: String,
    pub agent_session_id: Option<String>,
    pub tool_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadDrilldown {
    pub lane_id: String,
    pub latest_commentary_summary: Option<String>,
    pub latest_commentary_at: Option<DateTime<Utc>>,
    pub recent_tool_spans: Vec<ToolSpan>,
    pub related_wait_spans: Vec<WaitSpan>,
    pub raw_snippet: Option<RawJsonlSnippet>,
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
    pub lane_id: String,
    pub column: SessionFlowColumn,
    pub label: String,
    pub agent_session_id: Option<String>,
    pub depth: u8,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFlowItem {
    pub item_id: String,
    pub lane_id: String,
    pub kind: SessionFlowItemKind,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub summary: Option<String>,
    pub agent_session_id: Option<String>,
    pub target_lane_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFlowPayload {
    pub session: MonitorThread,
    pub lanes: Vec<SessionLane>,
    pub items: Vec<SessionFlowItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArchiveListFilters {
    pub workspace: Option<String>,
    pub query: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivedSessionSummary {
    pub thread_id: String,
    pub title: String,
    pub cwd: String,
    pub archived: bool,
    pub status: ThreadStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub latest_activity_summary: Option<String>,
    pub agent_roles: Vec<String>,
    pub rollout_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivedSessionListPayload {
    pub filters: ArchiveListFilters,
    pub workspaces: Vec<String>,
    pub sessions: Vec<ArchivedSessionSummary>,
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
    pub thread_id: String,
    pub title: String,
    pub cwd: String,
    pub status: ThreadStatus,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BottleneckSnapshot {
    pub generated_at: DateTime<Utc>,
    pub slow_threads: Vec<MonitorThread>,
    pub longest_wait_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistorySummary {
    pub from_date: String,
    pub to_date: String,
    pub thread_count: u32,
    pub average_duration_ms: Option<u64>,
    pub timeout_count: u32,
    pub spawn_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HistorySourceKey {
    LiveSessions,
    ArchivedSessions,
    StateDb,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryHealth {
    pub missing_sources: Vec<HistorySourceKey>,
    pub degraded_sources: Vec<HistorySourceKey>,
    pub degraded_rollout_threads: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryRoleSummary {
    pub agent_role: String,
    pub session_count: u32,
    pub average_duration_ms: Option<u64>,
    pub timeout_count: u32,
    pub spawn_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistorySlowThread {
    pub thread_id: String,
    pub title: String,
    pub cwd: String,
    pub updated_at: DateTime<Utc>,
    pub latest_activity_summary: Option<String>,
    pub duration_ms: Option<u64>,
    pub timeout_count: u32,
    pub spawn_count: u32,
    pub agent_roles: Vec<String>,
    pub rollout_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistorySummaryPayload {
    pub history: HistorySummary,
    pub health: HistoryHealth,
    pub roles: Vec<HistoryRoleSummary>,
    pub slow_threads: Vec<HistorySlowThread>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadDetail {
    pub thread: MonitorThread,
    pub agents: Vec<AgentSession>,
    pub timeline_events: Vec<TimelineEvent>,
    pub wait_spans: Vec<WaitSpan>,
    pub tool_spans: Vec<ToolSpan>,
}
