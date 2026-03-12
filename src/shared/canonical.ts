export const SESSION_STATUS = [
  "live",
  "archived",
  "stalled",
  "aborted",
  "completed",
] as const;

export type SessionStatus = (typeof SESSION_STATUS)[number];

export const SOURCE_KIND = ["session_log", "archive_log"] as const;

export type SourceKind = (typeof SOURCE_KIND)[number];

export const EVENT_KIND = [
  "session_start",
  "user_message",
  "agent_message",
  "reasoning",
  "tool_call",
  "tool_output",
  "tool_span",
  "spawn",
  "agent_complete",
  "token_delta",
  "error",
  "turn_aborted",
] as const;

export type EventKind = (typeof EVENT_KIND)[number];

export const DETAIL_LEVEL = ["operational", "diagnostic", "raw"] as const;

export type DetailLevel = (typeof DETAIL_LEVEL)[number];

export const METRIC_SCOPE = ["session", "workspace", "global"] as const;

export type MetricScope = (typeof METRIC_SCOPE)[number];

export type CanonicalScalar = number | string | boolean;

export interface CanonicalSession {
  session_id: string;
  parent_session_id: string | null;
  workspace_path: string;
  title: string | null;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  is_archived: boolean;
  source_kind: SourceKind;
}

export interface CanonicalEvent {
  event_id: string;
  session_id: string;
  parent_event_id: string | null;
  agent_instance_id: string | null;
  lane_id: string;
  kind: EventKind;
  detail_level: DetailLevel;
  occurred_at: string;
  duration_ms: number | null;
  summary: string | null;
  payload_preview: string | null;
  payload_ref: string | null;
  token_input: number | null;
  token_output: number | null;
  meta: Record<string, unknown>;
}

export interface CanonicalMetric {
  metric_id: string;
  scope: MetricScope;
  session_id: string | null;
  workspace_path: string | null;
  name: string;
  value: CanonicalScalar;
  unit: string | null;
  captured_at: string | null;
}

export interface CanonicalSessionBundle {
  session: CanonicalSession;
  events: CanonicalEvent[];
  metrics?: CanonicalMetric[];
}
