import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listSessions: vi.fn(async () => ({
    scope: "live",
    filters: {},
    workspaces: [],
    sessions: [],
  })),
  getSessionFlow: vi.fn(async () => null),
  getSessionLaneInspector: vi.fn(async () => null),
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
  openWorkspace: vi.fn(async () => undefined),
  openLogFile: vi.fn(async () => undefined),
}));

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("모니터 기본 셸을 렌더한다", async () => {
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
