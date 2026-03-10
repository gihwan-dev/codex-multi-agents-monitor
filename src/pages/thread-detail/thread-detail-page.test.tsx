import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { ThreadDetailPage } from "@/pages/thread-detail/thread-detail-page";
import { getThreadDetail } from "@/shared/lib/tauri/commands";
import type { ThreadDetail } from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  getThreadDetail: vi.fn(),
}));

function buildDetail(status: ThreadDetail["thread"]["status"]): ThreadDetail {
  return {
    thread: {
      thread_id: "thread-1",
      title: "Detail thread",
      cwd: "/workspace/detail",
      status,
      started_at: "2026-03-10T09:30:00Z",
      updated_at: "2026-03-10T10:00:00Z",
      latest_activity_summary: "recent commentary",
    },
    agents: [],
    timeline_events: [],
    wait_spans: [],
    tool_spans: [],
  };
}

function renderThreadDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/threads/thread-1"]}>
        <Routes>
          <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ThreadDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    vi.mocked(getThreadDetail).mockReset();
    useThreadUiStore.setState({ selectedThreadId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refetches inflight detail every 2000ms and syncs selectedThreadId", async () => {
    vi.mocked(getThreadDetail).mockResolvedValue(buildDetail("inflight"));

    const rendered = renderThreadDetailPage();

    await act(async () => {
      await Promise.resolve();
    });

    expect(getThreadDetail).toHaveBeenCalledTimes(1);
    expect(useThreadUiStore.getState().selectedThreadId).toBe("thread-1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await Promise.resolve();
    });

    expect(getThreadDetail).toHaveBeenCalledTimes(2);

    rendered.unmount();
    expect(useThreadUiStore.getState().selectedThreadId).toBeNull();
  });

  it("does not poll completed detail after the first fetch", async () => {
    vi.mocked(getThreadDetail).mockResolvedValue(buildDetail("completed"));

    renderThreadDetailPage();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
      await Promise.resolve();
    });

    expect(getThreadDetail).toHaveBeenCalledTimes(1);
  });
});
