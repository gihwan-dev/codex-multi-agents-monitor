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
