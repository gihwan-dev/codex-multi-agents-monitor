import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { OverviewPage } from "@/pages/overview/overview-page";
import { listLiveThreads } from "@/shared/lib/tauri/commands";
import type { LiveOverviewThread } from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listLiveThreads: vi.fn(),
}));

function buildThread(): LiveOverviewThread {
  return {
    thread_id: "thread-overview",
    title: "Overview thread",
    cwd: "/workspace/overview",
    status: "inflight",
    started_at: "2026-03-10T09:30:00Z",
    updated_at: "2026-03-10T10:00:00Z",
    latest_activity_summary: "recent commentary",
    agent_roles: ["implementer"],
    bottleneck_level: "warning",
    longest_wait_ms: 45_000,
    active_tool_name: "exec_command",
    active_tool_ms: 12_000,
    mini_timeline_window_started_at: "2026-03-10T09:50:00Z",
    mini_timeline_window_ended_at: "2026-03-10T10:00:00Z",
    mini_timeline: [],
  };
}

function renderOverviewPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    useThreadUiStore.setState({ selectedThreadId: "stale" });
    vi.mocked(listLiveThreads).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refetches live threads every 2000ms", async () => {
    vi.mocked(listLiveThreads).mockResolvedValue([buildThread()]);

    renderOverviewPage();

    await act(async () => {
      await Promise.resolve();
    });
    expect(listLiveThreads).toHaveBeenCalledTimes(1);
    expect(useThreadUiStore.getState().selectedThreadId).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await Promise.resolve();
    });

    expect(listLiveThreads).toHaveBeenCalledTimes(2);
  });
});
