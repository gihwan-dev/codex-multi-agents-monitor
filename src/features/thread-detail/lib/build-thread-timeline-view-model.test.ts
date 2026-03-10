import { describe, expect, it } from "vitest";

import { buildThreadTimelineViewModel } from "@/features/thread-detail/lib/build-thread-timeline-view-model";
import type { ThreadDetail } from "@/shared/types/contracts";

function buildDetail(): ThreadDetail {
  return {
    thread: {
      thread_id: "thread-main",
      title: "Detail thread",
      cwd: "/workspace/detail",
      status: "inflight",
      started_at: "2026-03-10T10:00:00Z",
      updated_at: "2026-03-10T10:10:00Z",
      latest_activity_summary: "working on slice 4",
    },
    agents: [
      {
        session_id: "session-b",
        thread_id: "thread-main",
        agent_role: "reviewer",
        agent_nickname: "Babbage",
        depth: 2,
        started_at: "2026-03-10T10:03:00Z",
        updated_at: "2026-03-10T10:09:00Z",
      },
      {
        session_id: "session-a",
        thread_id: "thread-main",
        agent_role: "implementer",
        agent_nickname: "Ada",
        depth: 1,
        started_at: "2026-03-10T10:02:00Z",
        updated_at: null,
      },
    ],
    timeline_events: [
      {
        event_id: "event-commentary",
        thread_id: "thread-main",
        agent_session_id: null,
        kind: "commentary",
        started_at: "2026-03-10T10:01:00Z",
        ended_at: null,
        summary: "investigating",
      },
      {
        event_id: "event-final",
        thread_id: "thread-main",
        agent_session_id: null,
        kind: "final",
        started_at: "2026-03-10T10:10:00Z",
        ended_at: null,
        summary: "done",
      },
    ],
    wait_spans: [
      {
        call_id: "wait-session-a",
        thread_id: "thread-main",
        parent_session_id: "thread-main",
        child_session_id: "session-a",
        started_at: "2026-03-10T10:04:00Z",
        ended_at: "2026-03-10T10:06:00Z",
        duration_ms: 120_000,
      },
      {
        call_id: "wait-missing-session",
        thread_id: "thread-main",
        parent_session_id: "thread-main",
        child_session_id: "missing-session",
        started_at: "2026-03-10T10:07:00Z",
        ended_at: "2026-03-10T10:08:00Z",
        duration_ms: 60_000,
      },
    ],
    tool_spans: [
      {
        call_id: "tool-session-a",
        thread_id: "thread-main",
        agent_session_id: "session-a",
        tool_name: "exec_command",
        started_at: "2026-03-10T10:08:00Z",
        ended_at: null,
        duration_ms: null,
      },
    ],
  };
}

describe("buildThreadTimelineViewModel", () => {
  it("orders main lane first and child lanes by depth then started_at", () => {
    const viewModel = buildThreadTimelineViewModel(buildDetail());

    expect(viewModel.lanes.map((lane) => lane.id)).toEqual([
      "thread-main",
      "session-a",
      "session-b",
    ]);
  });

  it("builds a global window from earliest start to latest known update", () => {
    const viewModel = buildThreadTimelineViewModel(buildDetail());

    expect(viewModel.window.started_at).toBe("2026-03-10T10:00:00.000Z");
    expect(viewModel.window.ended_at).toBe("2026-03-10T10:10:00.000Z");
    expect(viewModel.window.duration_ms).toBe(600_000);
  });

  it("clips open-ended spans to the global window end", () => {
    const viewModel = buildThreadTimelineViewModel(buildDetail());
    const agentLane = viewModel.lanes.find((lane) => lane.id === "session-a");
    const toolBlock = agentLane?.blocks.find((block) => block.kind === "tool");

    expect(toolBlock?.open).toBe(true);
    expect(toolBlock?.geometry.left_pct).toBeCloseTo(80);
    expect(toolBlock?.geometry.width_pct).toBeCloseTo(20);
  });

  it("omits wait connectors when child_session_id does not match a lane", () => {
    const viewModel = buildThreadTimelineViewModel(buildDetail());

    expect(viewModel.connectors).toEqual([
      expect.objectContaining({
        parent_lane_id: "thread-main",
        child_lane_id: "session-a",
      }),
    ]);
  });

  it("falls back to a minimum window when every timestamp is identical", () => {
    const detail = buildDetail();
    detail.thread.started_at = "2026-03-10T10:00:00Z";
    detail.thread.updated_at = "2026-03-10T10:00:00Z";
    detail.agents = [];
    detail.timeline_events = [];
    detail.wait_spans = [];
    detail.tool_spans = [];

    const viewModel = buildThreadTimelineViewModel(detail);

    expect(viewModel.window.duration_ms).toBe(1_000);
  });
});
