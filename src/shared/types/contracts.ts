// User-facing hierarchy:
// Workspace > Chat(Session) > Agent Session > Item(Event)
// Internal/storage compatibility keeps thread_id and threads table in Rust only.

export type WorkspaceKey = string;
export type SessionId = string;
export type AgentSessionId = string;

export type SessionScope = "live" | "archive";
export type SessionStatus = "inflight" | "completed" | "failed";
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

export type SessionSummary = {
  session_id: SessionId;
  title: string;
  workspace: WorkspaceKey;
  archived: boolean;
  status: SessionStatus;
  started_at: string | null;
  updated_at: string | null;
  latest_activity_summary: string | null;
  agent_roles: string[];
  rollout_path: string | null;
};

export type SessionListFilters = {
  workspace?: WorkspaceKey | null;
  query?: string | null;
  from_date?: string | null;
  to_date?: string | null;
};

export type SessionListItem = SessionSummary & {
  bottleneck_level: BottleneckLevel | null;
  longest_wait_ms: number | null;
  active_tool_name: string | null;
  active_tool_ms: number | null;
  mini_timeline_window_started_at: string | null;
  mini_timeline_window_ended_at: string | null;
  mini_timeline: MiniTimelineItem[];
};

export type SessionListPayload = {
  scope: SessionScope;
  filters: SessionListFilters;
  workspaces: WorkspaceKey[];
  sessions: SessionListItem[];
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

export type SessionLaneRef =
  | { kind: "user" }
  | { kind: "main"; session_id: SessionId }
  | { kind: "subagent"; agent_session_id: AgentSessionId };

export type SessionFlowColumn = "user" | "main" | "subagent";

export type SessionFlowItemKind =
  | "user_message"
  | "commentary"
  | "tool_call"
  | "wait"
  | "spawn"
  | "final_answer";

export type SessionLane = {
  lane_ref: SessionLaneRef;
  column: SessionFlowColumn;
  label: string;
  depth: number;
  started_at: string | null;
  updated_at: string | null;
};

export type SessionFlowItem = {
  item_id: string;
  lane: SessionLaneRef;
  kind: SessionFlowItemKind;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  target_lane: SessionLaneRef | null;
};

export type SessionFlowPayload = {
  session: SessionSummary;
  lanes: SessionLane[];
  items: SessionFlowItem[];
};

export type SessionToolCall = {
  call_id: string;
  tool_name: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

export type SessionWaitSpan = {
  call_id: string;
  parent_session_id: string;
  child_session_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

export type SessionLaneInspectorDegradedReason =
  | "missing_rollout"
  | "unreadable_rollout"
  | "invalid_rollout";

export type SessionLaneInspectorPayload = {
  lane: SessionLane;
  latest_commentary_summary: string | null;
  latest_commentary_at: string | null;
  recent_tool_calls: SessionToolCall[];
  related_waits: SessionWaitSpan[];
  raw_snippet: RawJsonlSnippet | null;
  degraded_reason: SessionLaneInspectorDegradedReason | null;
};

export type SummaryDashboardFilters = {
  workspace?: WorkspaceKey | null;
  session_id?: SessionId | null;
  from_date?: string | null;
  to_date?: string | null;
};

export type SummaryDashboardKpis = {
  session_count: number;
  active_session_count: number;
  completed_session_count: number;
  average_duration_ms: number | null;
  workspace_count: number;
};

export type SummaryWorkspaceMetric = {
  workspace: WorkspaceKey;
  session_count: number;
  average_duration_ms: number | null;
  latest_updated_at: string | null;
};

export type SummaryRoleMetric = {
  agent_role: string;
  session_count: number;
  average_duration_ms: number | null;
};

export type SummarySessionCompareRow = {
  session_id: SessionId;
  title: string;
  workspace: WorkspaceKey;
  status: SessionStatus;
  updated_at: string | null;
  latest_activity_summary: string | null;
  duration_ms: number | null;
  agent_roles: string[];
};

export type SummaryDashboardPayload = {
  filters: SummaryDashboardFilters;
  kpis: SummaryDashboardKpis;
  workspace_distribution: SummaryWorkspaceMetric[];
  role_mix: SummaryRoleMetric[];
  session_compare: SummarySessionCompareRow[];
};
