import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSessionFlow,
  getSessionLaneInspector,
  getSummaryDashboard,
  listSessions,
  openLogFile,
  openWorkspace,
} from "@/shared/lib/tauri/commands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("tauri bridge command contracts", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("list_sessions 호출과 payload decode를 함께 고정한다", async () => {
    invokeMock.mockResolvedValue({
      scope: "live",
      filters: { workspace: "/workspace/alpha" },
      workspaces: ["/workspace/alpha"],
      sessions: [
        {
          session_id: "thread-1",
          title: "Session alpha",
          workspace: "/workspace/alpha",
          workspace_hint: "/Users/example/.codex/worktrees/1234/alpha",
          archived: false,
          status: "inflight",
          started_at: "2026-03-10T09:00:00Z",
          updated_at: "2026-03-10T09:10:00Z",
          latest_activity_summary: "alpha commentary",
          agent_roles: ["implementer"],
          rollout_path: "/tmp/thread-1.jsonl",
          bottleneck_level: "warning",
          longest_wait_ms: 45_000,
          active_tool_name: null,
          active_tool_ms: null,
          mini_timeline_window_started_at: "2026-03-10T09:00:00Z",
          mini_timeline_window_ended_at: "2026-03-10T09:10:00Z",
          mini_timeline: [],
        },
      ],
    });

    const payload = await listSessions("live", {
      workspace: "/workspace/alpha",
    });

    expect(invokeMock).toHaveBeenCalledWith("list_sessions", {
      scope: "live",
      filters: { workspace: "/workspace/alpha" },
    });
    expect(payload.sessions[0].session_id).toBe("thread-1");
    expect(payload.sessions[0].workspace).toBe("/workspace/alpha");
    expect(payload.sessions[0].workspace_hint).toBe(
      "/Users/example/.codex/worktrees/1234/alpha",
    );
  });

  it("get_session_flow 호출과 payload decode를 함께 고정한다", async () => {
    invokeMock.mockResolvedValue({
      session: {
        session_id: "thread-1",
        title: "Session alpha",
        workspace: "/workspace/alpha",
        workspace_hint: "/Users/example/.codex/worktrees/1234/alpha",
        archived: false,
        status: "completed",
        started_at: "2026-03-10T09:00:00Z",
        updated_at: "2026-03-10T09:10:00Z",
        latest_activity_summary: "final answer delivered",
        agent_roles: ["implementer"],
        rollout_path: "/tmp/thread-1.jsonl",
      },
      lanes: [
        {
          lane_ref: { kind: "user" },
          column: "user",
          label: "User",
          depth: 0,
          started_at: "2026-03-10T09:00:00Z",
          updated_at: null,
        },
      ],
      items: [
        {
          item_id: "item-final",
          lane: { kind: "user" },
          kind: "final_answer",
          started_at: "2026-03-10T09:10:00Z",
          ended_at: null,
          summary: "done",
          target_lane: null,
        },
      ],
    });

    const payload = await getSessionFlow("session-1");

    expect(invokeMock).toHaveBeenCalledWith("get_session_flow", {
      sessionId: "session-1",
    });
    expect(payload?.session.session_id).toBe("thread-1");
    expect(payload?.session.workspace_hint).toBe(
      "/Users/example/.codex/worktrees/1234/alpha",
    );
    expect(payload?.items[0].kind).toBe("final_answer");
  });

  it("get_session_lane_inspector 호출과 payload decode를 함께 고정한다", async () => {
    invokeMock.mockResolvedValue({
      lane: {
        lane_ref: { kind: "main", session_id: "thread-1" },
        column: "main",
        label: "Main",
        depth: 0,
        started_at: "2026-03-10T09:00:00Z",
        updated_at: "2026-03-10T09:10:00Z",
      },
      latest_commentary_summary: "main commentary",
      latest_commentary_at: "2026-03-10T09:09:00Z",
      recent_tool_calls: [
        {
          call_id: "call-1",
          tool_name: "exec_command",
          started_at: "2026-03-10T09:05:00Z",
          ended_at: "2026-03-10T09:06:00Z",
          duration_ms: 60_000,
        },
      ],
      related_waits: [],
      raw_snippet: {
        source_label: "thread-1.jsonl",
        truncated: false,
        lines: [
          {
            line_number: 12,
            content: "main raw line",
          },
        ],
      },
      degraded_reason: null,
    });

    const payload = await getSessionLaneInspector("session-1", {
      kind: "user",
    });

    expect(invokeMock).toHaveBeenCalledWith("get_session_lane_inspector", {
      sessionId: "session-1",
      laneRef: { kind: "user" },
    });
    expect(payload?.lane.lane_ref).toEqual({
      kind: "main",
      session_id: "thread-1",
    });
    expect(payload?.recent_tool_calls[0].tool_name).toBe("exec_command");
  });

  it("get_summary_dashboard 호출과 payload decode를 함께 고정한다", async () => {
    invokeMock.mockResolvedValue({
      filters: { workspace: "/workspace/alpha", session_id: "thread-1" },
      kpis: {
        session_count: 1,
        active_session_count: 0,
        completed_session_count: 1,
        average_duration_ms: 180_000,
        workspace_count: 1,
      },
      workspace_distribution: [
        {
          workspace: "/workspace/alpha",
          session_count: 1,
          average_duration_ms: 180_000,
          latest_updated_at: "2026-03-10T09:10:00Z",
        },
      ],
      role_mix: [
        {
          agent_role: "implementer",
          session_count: 1,
          average_duration_ms: 180_000,
        },
      ],
      session_compare: [
        {
          session_id: "thread-1",
          title: "Session alpha",
          workspace: "/workspace/alpha",
          workspace_hint: "/Users/example/.codex/worktrees/1234/alpha",
          status: "completed",
          updated_at: "2026-03-10T09:10:00Z",
          latest_activity_summary: "done",
          duration_ms: 180_000,
          agent_roles: ["implementer"],
        },
      ],
    });

    const payload = await getSummaryDashboard({
      workspace: "/workspace/alpha",
      session_id: "thread-1",
    });

    expect(invokeMock).toHaveBeenCalledWith("get_summary_dashboard", {
      filters: {
        workspace: "/workspace/alpha",
        session_id: "thread-1",
      },
    });
    expect(payload.session_compare[0].session_id).toBe("thread-1");
    expect(payload.session_compare[0].workspace).toBe("/workspace/alpha");
    expect(payload.session_compare[0].workspace_hint).toBe(
      "/Users/example/.codex/worktrees/1234/alpha",
    );
  });

  it("open_workspace 인자 키를 고정한다", async () => {
    invokeMock.mockResolvedValue(undefined);

    await openWorkspace("/tmp/workspace");

    expect(invokeMock).toHaveBeenCalledWith("open_workspace", {
      path: "/tmp/workspace",
    });
  });

  it("open_log_file 인자 키를 고정한다", async () => {
    invokeMock.mockResolvedValue(undefined);

    await openLogFile("/tmp/rollout.jsonl");

    expect(invokeMock).toHaveBeenCalledWith("open_log_file", {
      path: "/tmp/rollout.jsonl",
    });
  });
});
