export type ThreadStatus = "inflight" | "completed" | "failed";

export type BottleneckLevel = "normal" | "warning" | "critical";

export type MiniTimelineItemKind =
  | "wait"
  | "tool"
  | "message"
  | "spawn"
  | "complete";

export type MiniTimelineItem = {
  kind: MiniTimelineItemKind;
  started_at: string;
  ended_at: string | null;
};

export type LiveOverviewThread = {
  thread_id: string;
  title: string;
  cwd: string;
  status: ThreadStatus;
  started_at: string | null;
  updated_at: string | null;
  latest_activity_summary: string | null;
  agent_roles: string[];
  bottleneck_level: BottleneckLevel;
  longest_wait_ms: number | null;
  active_tool_name: string | null;
  active_tool_ms: number | null;
  mini_timeline_window_started_at: string;
  mini_timeline_window_ended_at: string;
  mini_timeline: MiniTimelineItem[];
};

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

export type RawJsonlSnippetLine = {
  line_number: number;
  content: string;
};

export type RawJsonlSnippet = {
  source_label: string;
  lines: RawJsonlSnippetLine[];
  truncated: boolean;
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

export type ThreadDrilldown = {
  lane_id: string;
  latest_commentary_summary: string | null;
  latest_commentary_at: string | null;
  recent_tool_spans: ToolSpan[];
  related_wait_spans: WaitSpan[];
  raw_snippet: RawJsonlSnippet | null;
};
