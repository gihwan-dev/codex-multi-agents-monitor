export type ThreadStatus = "inflight" | "completed" | "failed";

export type MonitorThread = {
  thread_id: string;
  title: string;
  cwd: string;
  status: ThreadStatus;
  started_at: string | null;
  updated_at: string | null;
  latest_activity_summary: string | null;
};

export type AgentSession = {
  session_id: string;
  thread_id: string;
  agent_role: string;
  agent_nickname: string | null;
  depth: number;
  started_at: string | null;
  updated_at: string | null;
};

export type TimelineEvent = {
  event_id: string;
  thread_id: string;
  agent_session_id: string | null;
  kind: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
};

export type WaitSpan = {
  thread_id: string;
  parent_session_id: string;
  child_session_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

export type ToolSpan = {
  thread_id: string;
  agent_session_id: string | null;
  tool_name: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

export type BottleneckSnapshot = {
  generated_at: string;
  slow_threads: MonitorThread[];
  longest_wait_ms: number | null;
};

export type HistorySummary = {
  from_date: string;
  to_date: string;
  average_duration_ms: number | null;
  timeout_count: number;
  spawn_count: number;
};

export type HistorySummaryPayload = {
  history: HistorySummary;
  bottleneck: BottleneckSnapshot;
};

export type ThreadDetail = {
  thread: MonitorThread;
  agents: AgentSession[];
  timeline_events: TimelineEvent[];
  wait_spans: WaitSpan[];
  tool_spans: ToolSpan[];
};
