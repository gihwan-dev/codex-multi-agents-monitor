// User-facing hierarchy:
// Workspace > Chat(Session) > Agent Session > Item(Event)
// `thread` and `thread_id` remain internal/storage compatibility names.

export type WorkspaceKey = string;
export type SessionId = string;
export type AgentSessionId = string;

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
  // Legacy storage identifier for the root chat(session).
  thread_id: SessionId;
  title: string;
  // MVP workspace key. A dedicated workspace entity is introduced later.
  cwd: WorkspaceKey;
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
  // Legacy storage identifier for the root chat(session).
  thread_id: SessionId;
  title: string;
  cwd: WorkspaceKey;
  archived: boolean;
  status: ThreadStatus;
  started_at: string | null;
  updated_at: string | null;
  latest_activity_summary: string | null;
};

export type AgentSession = {
  session_id: AgentSessionId;
  thread_id: SessionId;
  agent_role: string;
  agent_nickname: string | null;
  depth: number;
  started_at: string | null;
  updated_at: string | null;
};

export type TimelineEvent = {
  event_id: string;
  thread_id: SessionId;
  agent_session_id: AgentSessionId | null;
  kind: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
};

export type WaitSpan = {
  call_id: string;
  thread_id: SessionId;
  parent_session_id: AgentSessionId;
  child_session_id: AgentSessionId | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

export type ToolSpan = {
  call_id: string;
  thread_id: SessionId;
  agent_session_id: AgentSessionId | null;
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
  thread_count: number;
  average_duration_ms: number | null;
  timeout_count: number;
  spawn_count: number;
};

export type HistorySourceKey =
  | "live_sessions"
  | "archived_sessions"
  | "state_db";

export type HistoryHealth = {
  missing_sources: HistorySourceKey[];
  degraded_sources: HistorySourceKey[];
  degraded_rollout_threads: number;
};

export type HistoryRoleSummary = {
  agent_role: string;
  session_count: number;
  average_duration_ms: number | null;
  timeout_count: number;
  spawn_count: number;
};

export type HistorySlowThread = {
  thread_id: SessionId;
  title: string;
  cwd: WorkspaceKey;
  updated_at: string;
  latest_activity_summary: string | null;
  duration_ms: number | null;
  timeout_count: number;
  spawn_count: number;
  agent_roles: string[];
  rollout_path: string | null;
};

export type HistorySummaryPayload = {
  history: HistorySummary;
  health: HistoryHealth;
  roles: HistoryRoleSummary[];
  slow_threads: HistorySlowThread[];
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

export type SessionFlowColumn = "user" | "main" | "subagent";

export type SessionFlowItemKind =
  | "user_message"
  | "commentary"
  | "tool_call"
  | "wait"
  | "spawn"
  | "final_answer";

export type SessionLane = {
  lane_id: string;
  column: SessionFlowColumn;
  label: string;
  agent_session_id: AgentSessionId | null;
  depth: number;
  started_at: string | null;
  updated_at: string | null;
};

export type SessionFlowItem = {
  item_id: string;
  lane_id: string;
  kind: SessionFlowItemKind;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  agent_session_id: AgentSessionId | null;
  target_lane_id: string | null;
};

export type SessionFlowPayload = {
  session: MonitorThread;
  lanes: SessionLane[];
  items: SessionFlowItem[];
};

export type ArchiveListFilters = {
  workspace?: WorkspaceKey | null;
  query?: string | null;
  from_date?: string | null;
  to_date?: string | null;
};

export type ArchivedSessionSummary = {
  thread_id: SessionId;
  title: string;
  cwd: WorkspaceKey;
  archived: boolean;
  status: ThreadStatus;
  started_at: string | null;
  updated_at: string | null;
  latest_activity_summary: string | null;
  agent_roles: string[];
  rollout_path: string | null;
};

export type ArchivedSessionListPayload = {
  filters: ArchiveListFilters;
  workspaces: WorkspaceKey[];
  sessions: ArchivedSessionSummary[];
};
