import { describe, expect, it } from "vitest";

import {
  compareBottleneckThreads,
  filterLiveOverviewThreads,
  getRoleOptions,
  getTopBottleneckThreads,
  getWorkspaceOptions,
} from "@/features/overview/lib/live-overview-selectors";
import type { LiveOverviewThread } from "@/shared/types/contracts";

const NOW_ISO = "2026-03-10T11:00:00Z";
const WINDOW_STARTED_AT = "2026-03-10T09:50:00Z";
const WINDOW_ENDED_AT = "2026-03-10T10:00:00Z";

function buildThread(
  overrides: Partial<LiveOverviewThread> & {
    thread_id: string;
    title: string;
  },
): LiveOverviewThread {
  const { thread_id, title, ...rest } = overrides;

  return {
    thread_id,
    title,
    cwd: "/workspace/default",
    status: "inflight",
    started_at: "2026-03-10T09:30:00Z",
    updated_at: NOW_ISO,
    latest_activity_summary: "recent commentary",
    agent_roles: [],
    bottleneck_level: "normal",
    longest_wait_ms: null,
    active_tool_name: null,
    active_tool_ms: null,
    mini_timeline_window_started_at: WINDOW_STARTED_AT,
    mini_timeline_window_ended_at: WINDOW_ENDED_AT,
    mini_timeline: [],
    ...rest,
  };
}

describe("live overview selectors", () => {
  it("derives sorted workspace and role options", () => {
    const threads = [
      buildThread({
        thread_id: "thread-beta",
        title: "Beta",
        cwd: "/workspace/beta",
        agent_roles: ["reviewer", "implementer"],
      }),
      buildThread({
        thread_id: "thread-alpha",
        title: "Alpha",
        cwd: "/workspace/alpha",
        agent_roles: ["reviewer"],
      }),
    ];

    expect(getWorkspaceOptions(threads)).toEqual([
      "/workspace/alpha",
      "/workspace/beta",
    ]);
    expect(getRoleOptions(threads)).toEqual(["implementer", "reviewer"]);
  });

  it("filters threads by workspace, role, and severity", () => {
    const threads = [
      buildThread({
        thread_id: "thread-alpha",
        title: "Alpha",
        cwd: "/workspace/alpha",
      }),
      buildThread({
        thread_id: "thread-beta",
        title: "Beta",
        cwd: "/workspace/beta",
        bottleneck_level: "warning",
      }),
      buildThread({
        thread_id: "thread-gamma",
        title: "Gamma",
        cwd: "/workspace/beta",
        agent_roles: ["implementer"],
        bottleneck_level: "critical",
      }),
    ];

    expect(
      filterLiveOverviewThreads(threads, {
        workspace: "/workspace/beta",
        role: "all",
        severity: "all",
      }).map((thread) => thread.thread_id),
    ).toEqual(["thread-beta", "thread-gamma"]);

    expect(
      filterLiveOverviewThreads(threads, {
        workspace: "all",
        role: "implementer",
        severity: "all",
      }).map((thread) => thread.thread_id),
    ).toEqual(["thread-gamma"]);

    expect(
      filterLiveOverviewThreads(threads, {
        workspace: "all",
        role: "all",
        severity: "warning",
      }).map((thread) => thread.thread_id),
    ).toEqual(["thread-beta"]);
  });

  it("sorts bottlenecks by severity, wait, tool, and freshness", () => {
    const normalNewest = buildThread({
      thread_id: "thread-normal",
      title: "Normal newest",
      updated_at: "2026-03-10T10:00:00Z",
    });
    const warningTool = buildThread({
      thread_id: "thread-warning-tool",
      title: "Warning tool",
      updated_at: "2026-03-10T09:59:00Z",
      bottleneck_level: "warning",
      active_tool_name: "exec_command",
      active_tool_ms: 50_000,
    });
    const criticalHigher = buildThread({
      thread_id: "thread-critical-high",
      title: "Critical high",
      updated_at: "2026-03-10T09:58:00Z",
      bottleneck_level: "critical",
      longest_wait_ms: 300_000,
    });
    const criticalLower = buildThread({
      thread_id: "thread-critical-low",
      title: "Critical low",
      updated_at: "2026-03-10T09:57:00Z",
      bottleneck_level: "critical",
      longest_wait_ms: 150_000,
    });

    expect(
      compareBottleneckThreads(criticalHigher, criticalLower),
    ).toBeLessThan(0);
    expect(
      getTopBottleneckThreads([
        normalNewest,
        warningTool,
        criticalHigher,
        criticalLower,
      ]).map((thread) => thread.thread_id),
    ).toEqual([
      "thread-critical-high",
      "thread-critical-low",
      "thread-warning-tool",
      "thread-normal",
    ]);
  });
});
