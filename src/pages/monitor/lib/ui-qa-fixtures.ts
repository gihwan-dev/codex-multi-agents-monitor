import {
  findSelectedSession,
  firstSessionId,
} from "@/entities/session";
import type { MonitorTab } from "@/shared/model";
import type {
  SessionDetailSnapshot,
  WorkspaceSessionsSnapshot,
} from "@/shared/queries";

const UI_QA_SNAPSHOT: WorkspaceSessionsSnapshot = {
  refreshed_at: "2026-03-12T12:31:00.000Z",
  workspaces: [
    {
      workspace_path: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
      sessions: [
        {
          session_id: "sess-ui-shell",
          workspace_path:
            "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
          title: "Liquid Glass shell redesign",
          status: "live",
          source_kind: "session_log",
          is_archived: false,
          started_at: "2026-03-12T11:24:00.000Z",
          ended_at: null,
          last_event_at: "2026-03-12T12:29:30.000Z",
          event_count: 42,
        },
        {
          session_id: "sess-archive-flow",
          workspace_path:
            "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
          title: "Archive filter pass",
          status: "completed",
          source_kind: "archive_log",
          is_archived: true,
          started_at: "2026-03-12T10:02:00.000Z",
          ended_at: "2026-03-12T10:27:00.000Z",
          last_event_at: "2026-03-12T10:27:00.000Z",
          event_count: 18,
        },
      ],
    },
    {
      workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
      sessions: [
        {
          session_id: "sess-metrics-audit",
          workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
          title: "Metrics density audit",
          status: "stalled",
          source_kind: "session_log",
          is_archived: false,
          started_at: "2026-03-12T09:15:00.000Z",
          ended_at: null,
          last_event_at: "2026-03-12T11:48:00.000Z",
          event_count: 27,
        },
        {
          session_id: "sess-replay",
          workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
          title: "Replay mode cleanup",
          status: "archived",
          source_kind: "archive_log",
          is_archived: true,
          started_at: "2026-03-11T19:10:00.000Z",
          ended_at: "2026-03-11T19:48:00.000Z",
          last_event_at: "2026-03-11T19:48:00.000Z",
          event_count: 12,
        },
      ],
    },
  ],
};

const UI_QA_DETAIL_BY_SESSION: Record<string, SessionDetailSnapshot> = {
  "sess-ui-shell": {
    last_event_at: "2026-03-12T12:29:30.000Z",
    event_count: 42,
    bundle: {
      session: {
        session_id: "sess-ui-shell",
        parent_session_id: null,
        workspace_path:
          "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
        title: "Liquid Glass shell redesign",
        status: "live",
        started_at: "2026-03-12T11:24:00.000Z",
        ended_at: null,
        is_archived: false,
        source_kind: "session_log",
      },
      events: [
        {
          event_id: "evt-user-1",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: null,
          lane_id: "user",
          kind: "user_message",
          detail_level: "operational",
          occurred_at: "2026-03-12T12:20:00.000Z",
          duration_ms: null,
          summary: "Convert the live monitor timeline to a vertical sequence view.",
          payload_preview:
            "Focus the latest sequence in live mode and fit the whole session in archive mode.",
          payload_ref: null,
          token_input: null,
          token_output: null,
          meta: {},
        },
        {
          event_id: "evt-plan",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "main-01",
          lane_id: "agent:main",
          kind: "reasoning",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:20:10.000Z",
          duration_ms: 2100,
          summary: "Shell hierarchy refined for unified glass depth.",
          payload_preview:
            "Removed panel separation and aligned control language across live, archive, and metrics.",
          payload_ref: null,
          token_input: 2408,
          token_output: 142,
          meta: {
            agent_role: "main",
            phase: "plan",
          },
        },
        {
          event_id: "evt-tool-call-main",
          session_id: "sess-ui-shell",
          parent_event_id: "evt-plan",
          agent_instance_id: "main-01",
          lane_id: "agent:main",
          kind: "tool_call",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:22:10.000Z",
          duration_ms: null,
          summary: "Inspect live monitor layout boundaries.",
          payload_preview:
            "rg -n \"TimelineCanvas|DetailDrawer|useSessionDetailQuery\" src",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_role: "main",
            call_id: "call-layout",
            tool: "rg",
          },
        },
        {
          event_id: "evt-tool-output-main",
          session_id: "sess-ui-shell",
          parent_event_id: "evt-tool-call-main",
          agent_instance_id: "main-01",
          lane_id: "agent:main",
          kind: "tool_output",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:22:13.000Z",
          duration_ms: null,
          summary: "Layout boundaries confirmed for page, timeline, and drawer.",
          payload_preview:
            "src/pages/monitor/ui/monitor-page.tsx, src/widgets/timeline/ui/timeline-canvas.tsx, src/widgets/detail-drawer/ui/detail-drawer.tsx",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_role: "main",
            call_id: "call-layout",
            tool: "rg",
          },
        },
        {
          event_id: "evt-spawn",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "main-01",
          lane_id: "agent:main",
          kind: "spawn",
          detail_level: "operational",
          occurred_at: "2026-03-12T12:23:00.000Z",
          duration_ms: null,
          summary: "Spawned a worker lane to wire the vertical timeline.",
          payload_preview: "worker lane enters with follow-latest and drawer sync scope.",
          payload_ref: null,
          token_input: null,
          token_output: null,
          meta: {
            agent_role: "main",
          },
        },
        {
          event_id: "evt-worker-msg",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "worker-02",
          lane_id: "agent:worker",
          kind: "agent_message",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:24:00.000Z",
          duration_ms: null,
          summary: "Worker aligned the timeline into a session-local vertical flow.",
          payload_preview:
            "Latest follow state, item selection, and drawer tabs are now unified.",
          payload_ref: null,
          token_input: null,
          token_output: null,
          meta: {
            agent_nickname: "Newton",
            agent_role: "worker",
          },
        },
        {
          event_id: "evt-worker-reasoning",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "worker-02",
          lane_id: "agent:worker",
          kind: "reasoning",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:25:30.000Z",
          duration_ms: 3200,
          summary: "Vertical sequence layout keeps the newest context at the bottom edge.",
          payload_preview:
            "Archive preset will fit the entire session while live remains zoomed on the recent sequence.",
          payload_ref: null,
          token_input: 430,
          token_output: 34,
          meta: {
            agent_nickname: "Newton",
            agent_role: "worker",
          },
        },
        {
          event_id: "evt-tool-call-worker",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "worker-02",
          lane_id: "agent:worker",
          kind: "tool_call",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:26:10.000Z",
          duration_ms: null,
          summary: "Apply the timeline and drawer wiring patch.",
          payload_preview: "update timeline selection source-of-truth in monitor page",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_nickname: "Newton",
            agent_role: "worker",
            call_id: "call-patch",
            tool: "apply_patch",
          },
        },
        {
          event_id: "evt-tool-output-worker",
          session_id: "sess-ui-shell",
          parent_event_id: "evt-tool-call-worker",
          agent_instance_id: "worker-02",
          lane_id: "agent:worker",
          kind: "tool_output",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:26:55.000Z",
          duration_ms: null,
          summary: "Vertical timeline wiring landed in page and feature modules.",
          payload_preview:
            "features/timeline/ui/* plus page wiring now control selection and latest follow.",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_nickname: "Newton",
            agent_role: "worker",
            call_id: "call-patch",
            tool: "apply_patch",
          },
        },
        {
          event_id: "evt-token-main",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "main-01",
          lane_id: "agent:main",
          kind: "token_delta",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T12:27:20.000Z",
          duration_ms: null,
          summary: "Token snapshot",
          payload_preview: null,
          payload_ref: null,
          token_input: 2408,
          token_output: 142,
          meta: {
            agent_role: "main",
          },
        },
        {
          event_id: "evt-complete",
          session_id: "sess-ui-shell",
          parent_event_id: null,
          agent_instance_id: "main-01",
          lane_id: "agent:main",
          kind: "agent_complete",
          detail_level: "operational",
          occurred_at: "2026-03-12T12:29:30.000Z",
          duration_ms: 1500,
          summary: "Vertical timeline MVP staged with latest-follow and eye recovery.",
          payload_preview:
            "Live now tracks the latest sequence by default; archive preset is fit-all and deferred to the archive slice.",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_role: "main",
          },
        },
      ],
      metrics: [
        {
          metric_id: "metric-latency",
          scope: "session",
          session_id: "sess-ui-shell",
          workspace_path:
            "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
          name: "tool_latency_ms_p95",
          value: 680,
          unit: "ms",
          captured_at: "2026-03-12T12:29:30.000Z",
        },
        {
          metric_id: "metric-depth",
          scope: "session",
          session_id: "sess-ui-shell",
          workspace_path:
            "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
          name: "spawn_depth",
          value: 2,
          unit: "levels",
          captured_at: "2026-03-12T12:29:30.000Z",
        },
      ],
    },
  },
  "sess-archive-flow": {
    last_event_at: "2026-03-12T10:27:00.000Z",
    event_count: 18,
    bundle: {
      session: {
        session_id: "sess-archive-flow",
        parent_session_id: null,
        workspace_path:
          "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
        title: "Archive filter pass",
        status: "completed",
        started_at: "2026-03-12T10:02:00.000Z",
        ended_at: "2026-03-12T10:27:00.000Z",
        is_archived: true,
        source_kind: "archive_log",
      },
      events: [
        {
          event_id: "evt-archive-user",
          session_id: "sess-archive-flow",
          parent_event_id: null,
          agent_instance_id: null,
          lane_id: "user",
          kind: "user_message",
          detail_level: "operational",
          occurred_at: "2026-03-12T10:02:00.000Z",
          duration_ms: null,
          summary: "Show the archive session in a fit-all preset.",
          payload_preview: "The full session should be visible with the latest item at the bottom.",
          payload_ref: null,
          token_input: null,
          token_output: null,
          meta: {},
        },
        {
          event_id: "evt-archive-tool-call",
          session_id: "sess-archive-flow",
          parent_event_id: null,
          agent_instance_id: "main-11",
          lane_id: "agent:main",
          kind: "tool_call",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T10:08:00.000Z",
          duration_ms: null,
          summary: "Measure archive viewport fit bounds.",
          payload_preview: "compute fit-all scale for full replay height",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_role: "main",
            call_id: "call-archive-fit",
            tool: "compute",
          },
        },
        {
          event_id: "evt-archive-tool-output",
          session_id: "sess-archive-flow",
          parent_event_id: "evt-archive-tool-call",
          agent_instance_id: "main-11",
          lane_id: "agent:main",
          kind: "tool_output",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T10:08:06.000Z",
          duration_ms: null,
          summary: "Archive fit-all bounds are stable.",
          payload_preview: "fit-all viewport keeps the full session visible without follow.",
          payload_ref: null,
          token_input: 0,
          token_output: 0,
          meta: {
            agent_role: "main",
            call_id: "call-archive-fit",
            tool: "compute",
          },
        },
        {
          event_id: "evt-archive",
          session_id: "sess-archive-flow",
          parent_event_id: null,
          agent_instance_id: "main-11",
          lane_id: "agent:main",
          kind: "agent_complete",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T10:27:00.000Z",
          duration_ms: 1500,
          summary: "Archive filtering visuals aligned with live shell.",
          payload_preview:
            "Dense list rows, badges, and filter pills were consolidated into the same surface system.",
          payload_ref: null,
          token_input: 980,
          token_output: 76,
          meta: {
            agent_role: "main",
            filters: 4,
          },
        },
      ],
      metrics: [
        {
          metric_id: "metric-archive",
          scope: "session",
          session_id: "sess-archive-flow",
          workspace_path:
            "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
          name: "filters_applied",
          value: 4,
          unit: "pills",
          captured_at: "2026-03-12T10:27:00.000Z",
        },
      ],
    },
  },
  "sess-metrics-audit": {
    last_event_at: "2026-03-12T11:48:00.000Z",
    event_count: 27,
    bundle: {
      session: {
        session_id: "sess-metrics-audit",
        parent_session_id: null,
        workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
        title: "Metrics density audit",
        status: "stalled",
        started_at: "2026-03-12T09:15:00.000Z",
        ended_at: null,
        is_archived: false,
        source_kind: "session_log",
      },
      events: [
        {
          event_id: "evt-metrics",
          session_id: "sess-metrics-audit",
          parent_event_id: null,
          agent_instance_id: "review-03",
          lane_id: "review",
          kind: "tool_output",
          detail_level: "diagnostic",
          occurred_at: "2026-03-12T11:48:00.000Z",
          duration_ms: 920,
          summary: "Metrics placeholders converted to dark glass semantics.",
          payload_preview:
            "Purple and muted-light placeholders were removed in favor of sky and amber accents.",
          payload_ref: null,
          token_input: 1230,
          token_output: 88,
          meta: {
            charts: 2,
          },
        },
      ],
      metrics: [
        {
          metric_id: "metric-agent-utilization",
          scope: "session",
          session_id: "sess-metrics-audit",
          workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
          name: "active_agents",
          value: 3,
          unit: "agents",
          captured_at: "2026-03-12T11:48:00.000Z",
        },
      ],
    },
  },
  "sess-replay": {
    last_event_at: "2026-03-11T19:48:00.000Z",
    event_count: 12,
    bundle: {
      session: {
        session_id: "sess-replay",
        parent_session_id: null,
        workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
        title: "Replay mode cleanup",
        status: "archived",
        started_at: "2026-03-11T19:10:00.000Z",
        ended_at: "2026-03-11T19:48:00.000Z",
        is_archived: true,
        source_kind: "archive_log",
      },
      events: [
        {
          event_id: "evt-replay",
          session_id: "sess-replay",
          parent_event_id: null,
          agent_instance_id: "archive-04",
          lane_id: "archive",
          kind: "agent_complete",
          detail_level: "diagnostic",
          occurred_at: "2026-03-11T19:48:00.000Z",
          duration_ms: 620,
          summary: "Replay shell cleanup finished with unified cold-tone chrome.",
          payload_preview:
            "Archive replay now matches live and metrics control sizing without reintroducing hard dividers.",
          payload_ref: null,
          token_input: 410,
          token_output: 38,
          meta: {
            replay: true,
          },
        },
      ],
      metrics: [
        {
          metric_id: "metric-replay-density",
          scope: "session",
          session_id: "sess-replay",
          workspace_path: "/Users/choegihwan/Documents/Projects/agent-lab",
          name: "rows_visible",
          value: 12,
          unit: "rows",
          captured_at: "2026-03-11T19:48:00.000Z",
        },
      ],
    },
  },
};

export interface MonitorUiQaState {
  activeTab: MonitorTab;
  detailBySessionId: Record<string, SessionDetailSnapshot>;
  selectedSessionId: string;
  sidebarOpen: boolean;
  snapshot: WorkspaceSessionsSnapshot;
}

function isMonitorTab(value: string | null): value is MonitorTab {
  return value === "live" || value === "archive" || value === "metrics";
}

export function resolveMonitorUiQaState(
  search: string,
): MonitorUiQaState | null {
  const params = new URLSearchParams(search);

  if (params.get("demo") !== "ui-qa") {
    return null;
  }

  const requestedSessionId = params.get("session");
  const selectedSessionId =
    requestedSessionId &&
    findSelectedSession(UI_QA_SNAPSHOT, requestedSessionId)
      ? requestedSessionId
      : firstSessionId(UI_QA_SNAPSHOT) ?? "sess-ui-shell";
  const tabParam = params.get("tab");
  const sidebarParam = params.get("sidebar");

  return {
    activeTab: isMonitorTab(tabParam) ? tabParam : "live",
    detailBySessionId: UI_QA_DETAIL_BY_SESSION,
    selectedSessionId,
    sidebarOpen: sidebarParam !== "collapsed",
    snapshot: UI_QA_SNAPSHOT,
  };
}
