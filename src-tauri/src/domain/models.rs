use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub thread_id: String,
    pub parent_session_id: String,
    pub child_session_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSpan {
    pub thread_id: String,
    pub agent_session_id: Option<String>,
    pub tool_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
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
    pub average_duration_ms: Option<u64>,
    pub timeout_count: u32,
    pub spawn_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistorySummaryPayload {
    pub history: HistorySummary,
    pub bottleneck: BottleneckSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadDetail {
    pub thread: MonitorThread,
    pub agents: Vec<AgentSession>,
    pub timeline_events: Vec<TimelineEvent>,
    pub wait_spans: Vec<WaitSpan>,
    pub tool_spans: Vec<ToolSpan>,
}
