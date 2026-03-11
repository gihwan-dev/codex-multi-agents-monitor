import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listLiveThreads: vi.fn(async () => []),
  listArchivedSessions: vi.fn(async () => ({
    filters: {},
    workspaces: [],
    sessions: [],
  })),
  getSessionFlow: vi.fn(async () => null),
  getThreadDrilldown: vi.fn(async () => null),
  getSummaryDashboard: vi.fn(async () => ({
    filters: {},
    kpis: {
      session_count: 0,
      active_session_count: 0,
      completed_session_count: 0,
      average_duration_ms: null,
      workspace_count: 0,
    },
    workspace_distribution: [],
    role_mix: [],
    session_compare: [],
  })),
  getThreadDetail: vi.fn(async () => null),
  getHistorySummary: vi.fn(async () => ({
    history: {
      from_date: "2026-03-04",
      to_date: "2026-03-10",
      thread_count: 0,
      average_duration_ms: null,
      timeout_count: 0,
      spawn_count: 0,
    },
    health: {
      missing_sources: [],
      degraded_sources: [],
      degraded_rollout_threads: 0,
    },
    roles: [],
    slow_threads: [],
  })),
  openWorkspace: vi.fn(async () => undefined),
  openLogFile: vi.fn(async () => undefined),
}));

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("renders monitor shell", async () => {
    render(<App />);
    expect(await screen.findByText("Multi-Agent Monitor")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Live",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("실시간 챗 세션")).toBeInTheDocument();
  });
});
