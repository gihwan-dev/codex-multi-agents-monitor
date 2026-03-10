import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listLiveThreads: vi.fn(async () => []),
  getThreadDetail: vi.fn(async () => null),
  getHistorySummary: vi.fn(async () => ({
    history: {
      from_date: "2026-03-10",
      to_date: "2026-03-10",
      average_duration_ms: null,
      timeout_count: 0,
      spawn_count: 0,
    },
    bottleneck: {
      generated_at: "2026-03-10T00:00:00Z",
      slow_threads: [],
      longest_wait_ms: null,
    },
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
    expect(await screen.findByText("Live Overview")).toBeInTheDocument();
  });
});
