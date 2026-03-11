import { invoke } from "@tauri-apps/api/core";

import type {
  BottleneckLevel,
  MiniTimelineItemKind,
  RawJsonlSnippet,
  SessionFlowColumn,
  SessionFlowItemKind,
  SessionFlowPayload,
  SessionLane,
  SessionLaneInspectorDegradedReason,
  SessionLaneInspectorPayload,
  SessionLaneRef,
  SessionListFilters,
  SessionListItem,
  SessionListPayload,
  SessionScope,
  SessionStatus,
  SummaryDashboardFilters,
  SummaryDashboardPayload,
} from "@/shared/types/contracts";

export type TauriCommandErrorCode =
  | "path_not_found"
  | "not_directory"
  | "not_file"
  | "open_failed"
  | "internal";

export type TauriCommandError = {
  code: TauriCommandErrorCode;
  message: string;
  path?: string;
};

export async function listSessions(
  scope: SessionScope,
  filters: SessionListFilters = {},
) {
  const payload = await invoke<unknown>("list_sessions", { scope, filters });
  return decodeSessionListPayload(payload);
}

export async function getSessionFlow(sessionId: string) {
  const payload = await invoke<unknown>("get_session_flow", { sessionId });
  return payload === null ? null : decodeSessionFlowPayload(payload);
}

export async function getSessionLaneInspector(
  sessionId: string,
  laneRef: SessionLaneRef,
) {
  const payload = await invoke<unknown>("get_session_lane_inspector", {
    sessionId,
    laneRef,
  });
  return payload === null ? null : decodeSessionLaneInspectorPayload(payload);
}

export async function getSummaryDashboard(
  filters: SummaryDashboardFilters = {},
) {
  const payload = await invoke<unknown>("get_summary_dashboard", { filters });
  return decodeSummaryDashboardPayload(payload);
}

export async function openWorkspace(path: string) {
  return invoke<void>("open_workspace", { path });
}

export async function openLogFile(path: string) {
  return invoke<void>("open_log_file", { path });
}

function decodeSessionListPayload(value: unknown): SessionListPayload {
  const record = expectRecord(value, "SessionListPayload");
  return {
    scope: expectScope(record.scope),
    filters: decodeSessionListFilters(record.filters),
    workspaces: expectStringArray(
      record.workspaces,
      "SessionListPayload.workspaces",
    ),
    sessions: expectArray(record.sessions, "SessionListPayload.sessions").map(
      (item, index) =>
        decodeSessionListItem(item, `SessionListPayload.sessions[${index}]`),
    ),
  };
}

function decodeSessionListFilters(value: unknown): SessionListFilters {
  const record = expectRecord(value, "SessionListFilters");
  return {
    workspace: expectNullableString(record.workspace),
    query: expectNullableString(record.query),
    from_date: expectNullableString(record.from_date),
    to_date: expectNullableString(record.to_date),
  };
}

function decodeSessionListItem(value: unknown, label: string): SessionListItem {
  const record = expectRecord(value, label);
  return {
    session_id: expectString(record.session_id, `${label}.session_id`),
    title: expectString(record.title, `${label}.title`),
    workspace: expectString(record.workspace, `${label}.workspace`),
    archived: expectBoolean(record.archived, `${label}.archived`),
    status: expectStatus(record.status),
    started_at: expectNullableString(record.started_at),
    updated_at: expectNullableString(record.updated_at),
    latest_activity_summary: expectNullableString(
      record.latest_activity_summary,
    ),
    agent_roles: expectStringArray(record.agent_roles, `${label}.agent_roles`),
    rollout_path: expectNullableString(record.rollout_path),
    bottleneck_level: expectNullableBottleneck(record.bottleneck_level),
    longest_wait_ms: expectNullableNumber(record.longest_wait_ms),
    active_tool_name: expectNullableString(record.active_tool_name),
    active_tool_ms: expectNullableNumber(record.active_tool_ms),
    mini_timeline_window_started_at: expectNullableString(
      record.mini_timeline_window_started_at,
    ),
    mini_timeline_window_ended_at: expectNullableString(
      record.mini_timeline_window_ended_at,
    ),
    mini_timeline: expectArray(
      record.mini_timeline,
      `${label}.mini_timeline`,
    ).map((item, index) =>
      decodeMiniTimelineItem(item, `${label}.mini_timeline[${index}]`),
    ),
  };
}

function decodeMiniTimelineItem(
  value: unknown,
  label: string,
): SessionListItem["mini_timeline"][number] {
  const record = expectRecord(value, label);
  return {
    kind: expectTimelineKind(record.kind),
    started_at: expectString(record.started_at, `${label}.started_at`),
    ended_at: expectNullableString(record.ended_at),
  };
}

function decodeSessionFlowPayload(value: unknown): SessionFlowPayload {
  const record = expectRecord(value, "SessionFlowPayload");
  return {
    session: decodeSessionListItem(
      record.session,
      "SessionFlowPayload.session",
    ),
    lanes: expectArray(record.lanes, "SessionFlowPayload.lanes").map(
      (lane, index) =>
        decodeSessionLane(lane, `SessionFlowPayload.lanes[${index}]`),
    ),
    items: expectArray(record.items, "SessionFlowPayload.items").map(
      (item, index) =>
        decodeSessionFlowItem(item, `SessionFlowPayload.items[${index}]`),
    ),
  };
}

function decodeSessionLane(value: unknown, label: string): SessionLane {
  const record = expectRecord(value, label);
  return {
    lane_ref: decodeSessionLaneRef(record.lane_ref, `${label}.lane_ref`),
    column: expectFlowColumn(record.column),
    label: expectString(record.label, `${label}.label`),
    depth: expectNumber(record.depth, `${label}.depth`),
    started_at: expectNullableString(record.started_at),
    updated_at: expectNullableString(record.updated_at),
  };
}

function decodeSessionFlowItem(
  value: unknown,
  label: string,
): SessionFlowPayload["items"][number] {
  const record = expectRecord(value, label);
  return {
    item_id: expectString(record.item_id, `${label}.item_id`),
    lane: decodeSessionLaneRef(record.lane, `${label}.lane`),
    kind: expectFlowItemKind(record.kind),
    started_at: expectString(record.started_at, `${label}.started_at`),
    ended_at: expectNullableString(record.ended_at),
    summary: expectNullableString(record.summary),
    target_lane:
      record.target_lane === null || record.target_lane === undefined
        ? null
        : decodeSessionLaneRef(record.target_lane, `${label}.target_lane`),
  };
}

function decodeSessionLaneInspectorPayload(
  value: unknown,
): SessionLaneInspectorPayload {
  const record = expectRecord(value, "SessionLaneInspectorPayload");
  return {
    lane: decodeSessionLane(record.lane, "SessionLaneInspectorPayload.lane"),
    latest_commentary_summary: expectNullableString(
      record.latest_commentary_summary,
    ),
    latest_commentary_at: expectNullableString(record.latest_commentary_at),
    recent_tool_calls: expectArray(
      record.recent_tool_calls,
      "SessionLaneInspectorPayload.recent_tool_calls",
    ).map((item, index) =>
      decodeToolCall(
        item,
        `SessionLaneInspectorPayload.recent_tool_calls[${index}]`,
      ),
    ),
    related_waits: expectArray(
      record.related_waits,
      "SessionLaneInspectorPayload.related_waits",
    ).map((item, index) =>
      decodeWaitSpan(
        item,
        `SessionLaneInspectorPayload.related_waits[${index}]`,
      ),
    ),
    raw_snippet:
      record.raw_snippet === null || record.raw_snippet === undefined
        ? null
        : decodeRawSnippet(record.raw_snippet),
    degraded_reason: expectNullableDegradedReason(record.degraded_reason),
  };
}

function decodeToolCall(
  value: unknown,
  label: string,
): SessionLaneInspectorPayload["recent_tool_calls"][number] {
  const record = expectRecord(value, label);
  return {
    call_id: expectString(record.call_id, `${label}.call_id`),
    tool_name: expectString(record.tool_name, `${label}.tool_name`),
    started_at: expectString(record.started_at, `${label}.started_at`),
    ended_at: expectNullableString(record.ended_at),
    duration_ms: expectNullableNumber(record.duration_ms),
  };
}

function decodeWaitSpan(
  value: unknown,
  label: string,
): SessionLaneInspectorPayload["related_waits"][number] {
  const record = expectRecord(value, label);
  return {
    call_id: expectString(record.call_id, `${label}.call_id`),
    parent_session_id: expectString(
      record.parent_session_id,
      `${label}.parent_session_id`,
    ),
    child_session_id: expectNullableString(record.child_session_id),
    started_at: expectString(record.started_at, `${label}.started_at`),
    ended_at: expectNullableString(record.ended_at),
    duration_ms: expectNullableNumber(record.duration_ms),
  };
}

function decodeRawSnippet(value: unknown): RawJsonlSnippet {
  const record = expectRecord(value, "RawJsonlSnippet");
  return {
    source_label: expectString(
      record.source_label,
      "RawJsonlSnippet.source_label",
    ),
    lines: expectArray(record.lines, "RawJsonlSnippet.lines").map(
      (line, index) => {
        const lineRecord = expectRecord(
          line,
          `RawJsonlSnippet.lines[${index}]`,
        );
        return {
          line_number: expectNumber(
            lineRecord.line_number,
            `RawJsonlSnippet.lines[${index}].line_number`,
          ),
          content: expectString(
            lineRecord.content,
            `RawJsonlSnippet.lines[${index}].content`,
          ),
        };
      },
    ),
    truncated: expectBoolean(record.truncated, "RawJsonlSnippet.truncated"),
  };
}

function decodeSummaryDashboardPayload(
  value: unknown,
): SummaryDashboardPayload {
  const record = expectRecord(value, "SummaryDashboardPayload");
  return {
    filters: {
      workspace: expectNullableString(
        expectRecord(record.filters, "SummaryDashboardPayload.filters")
          .workspace,
      ),
      session_id: expectNullableString(
        expectRecord(record.filters, "SummaryDashboardPayload.filters")
          .session_id,
      ),
      from_date: expectNullableString(
        expectRecord(record.filters, "SummaryDashboardPayload.filters")
          .from_date,
      ),
      to_date: expectNullableString(
        expectRecord(record.filters, "SummaryDashboardPayload.filters").to_date,
      ),
    },
    kpis: decodeKpis(record.kpis),
    workspace_distribution: expectArray(
      record.workspace_distribution,
      "SummaryDashboardPayload.workspace_distribution",
    ).map((item, index) => decodeWorkspaceMetric(item, index)),
    role_mix: expectArray(
      record.role_mix,
      "SummaryDashboardPayload.role_mix",
    ).map((item, index) => decodeRoleMetric(item, index)),
    session_compare: expectArray(
      record.session_compare,
      "SummaryDashboardPayload.session_compare",
    ).map((item, index) => decodeSessionCompareRow(item, index)),
  };
}

function decodeKpis(value: unknown): SummaryDashboardPayload["kpis"] {
  const record = expectRecord(value, "SummaryDashboardKpis");
  return {
    session_count: expectNumber(
      record.session_count,
      "SummaryDashboardKpis.session_count",
    ),
    active_session_count: expectNumber(
      record.active_session_count,
      "SummaryDashboardKpis.active_session_count",
    ),
    completed_session_count: expectNumber(
      record.completed_session_count,
      "SummaryDashboardKpis.completed_session_count",
    ),
    average_duration_ms: expectNullableNumber(record.average_duration_ms),
    workspace_count: expectNumber(
      record.workspace_count,
      "SummaryDashboardKpis.workspace_count",
    ),
  };
}

function decodeWorkspaceMetric(
  value: unknown,
  index: number,
): SummaryDashboardPayload["workspace_distribution"][number] {
  const label = `SummaryDashboardPayload.workspace_distribution[${index}]`;
  const record = expectRecord(value, label);
  return {
    workspace: expectString(record.workspace, `${label}.workspace`),
    session_count: expectNumber(record.session_count, `${label}.session_count`),
    average_duration_ms: expectNullableNumber(record.average_duration_ms),
    latest_updated_at: expectNullableString(record.latest_updated_at),
  };
}

function decodeRoleMetric(
  value: unknown,
  index: number,
): SummaryDashboardPayload["role_mix"][number] {
  const label = `SummaryDashboardPayload.role_mix[${index}]`;
  const record = expectRecord(value, label);
  return {
    agent_role: expectString(record.agent_role, `${label}.agent_role`),
    session_count: expectNumber(record.session_count, `${label}.session_count`),
    average_duration_ms: expectNullableNumber(record.average_duration_ms),
  };
}

function decodeSessionCompareRow(
  value: unknown,
  index: number,
): SummaryDashboardPayload["session_compare"][number] {
  const label = `SummaryDashboardPayload.session_compare[${index}]`;
  const record = expectRecord(value, label);
  return {
    session_id: expectString(record.session_id, `${label}.session_id`),
    title: expectString(record.title, `${label}.title`),
    workspace: expectString(record.workspace, `${label}.workspace`),
    status: expectStatus(record.status),
    updated_at: expectNullableString(record.updated_at),
    latest_activity_summary: expectNullableString(
      record.latest_activity_summary,
    ),
    duration_ms: expectNullableNumber(record.duration_ms),
    agent_roles: expectStringArray(record.agent_roles, `${label}.agent_roles`),
  };
}

function decodeSessionLaneRef(value: unknown, label: string): SessionLaneRef {
  const record = expectRecord(value, label);
  const kind = expectString(record.kind, `${label}.kind`);
  switch (kind) {
    case "user":
      return { kind: "user" };
    case "main":
      return {
        kind: "main",
        session_id: expectString(record.session_id, `${label}.session_id`),
      };
    case "subagent":
      return {
        kind: "subagent",
        agent_session_id: expectString(
          record.agent_session_id,
          `${label}.agent_session_id`,
        ),
      };
    default:
      throw new Error(`Unexpected lane ref kind: ${kind}`);
  }
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function expectNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Expected nullable string");
  }
  return value;
}

function expectStringArray(value: unknown, label: string): string[] {
  return expectArray(value, label).map((item, index) =>
    expectString(item, `${label}[${index}]`),
  );
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new Error(`${label} must be a number`);
  }
  return value;
}

function expectNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number") {
    throw new Error("Expected nullable number");
  }
  return value;
}

function expectScope(value: unknown): SessionScope {
  if (value === "live" || value === "archive") {
    return value;
  }
  throw new Error(`Unexpected session scope: ${String(value)}`);
}

function expectStatus(value: unknown): SessionStatus {
  if (value === "inflight" || value === "completed" || value === "failed") {
    return value;
  }
  throw new Error(`Unexpected session status: ${String(value)}`);
}

function expectNullableBottleneck(value: unknown): BottleneckLevel | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value === "normal" || value === "warning" || value === "critical") {
    return value;
  }
  throw new Error(`Unexpected bottleneck level: ${String(value)}`);
}

function expectTimelineKind(value: unknown): MiniTimelineItemKind {
  if (
    value === "wait" ||
    value === "tool" ||
    value === "message" ||
    value === "spawn" ||
    value === "complete"
  ) {
    return value;
  }
  throw new Error(`Unexpected mini timeline item kind: ${String(value)}`);
}

function expectFlowColumn(value: unknown): SessionFlowColumn {
  if (value === "user" || value === "main" || value === "subagent") {
    return value;
  }
  throw new Error(`Unexpected session flow column: ${String(value)}`);
}

function expectFlowItemKind(value: unknown): SessionFlowItemKind {
  if (
    value === "user_message" ||
    value === "commentary" ||
    value === "tool_call" ||
    value === "wait" ||
    value === "spawn" ||
    value === "final_answer"
  ) {
    return value;
  }
  throw new Error(`Unexpected session flow item kind: ${String(value)}`);
}

function expectNullableDegradedReason(
  value: unknown,
): SessionLaneInspectorDegradedReason | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    value === "missing_rollout" ||
    value === "unreadable_rollout" ||
    value === "invalid_rollout"
  ) {
    return value;
  }
  throw new Error(`Unexpected degraded reason: ${String(value)}`);
}
