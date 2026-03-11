import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { ThreadDetailPage } from "@/pages/thread-detail/thread-detail-page";
import {
  getThreadDetail,
  getThreadDrilldown,
} from "@/shared/lib/tauri/commands";
import type { ThreadDetail } from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  getThreadDetail: vi.fn(),
  getThreadDrilldown: vi.fn(),
}));

function buildDetail(
  status: ThreadDetail["thread"]["status"],
  archived = false,
): ThreadDetail {
  return {
    thread: {
      thread_id: "thread-1",
      title: "Detail thread",
      cwd: "/workspace/detail",
      archived,
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

async function flushPageQueries() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("ThreadDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    vi.mocked(getThreadDetail).mockReset();
    vi.mocked(getThreadDrilldown).mockReset();
    vi.mocked(getThreadDrilldown).mockResolvedValue({
      lane_id: "thread-1",
      latest_commentary_summary: "recent commentary",
      latest_commentary_at: "2026-03-10T10:00:00Z",
      recent_tool_spans: [],
      related_wait_spans: [],
      raw_snippet: null,
    });
    useThreadUiStore.setState({ selectedThreadId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refetches inflight detail every 2000ms and syncs selectedThreadId", async () => {
    vi.mocked(getThreadDetail).mockResolvedValue(buildDetail("inflight"));

    const rendered = renderThreadDetailPage();

    await flushPageQueries();

    expect(getThreadDetail).toHaveBeenCalledTimes(1);
    expect(getThreadDrilldown).toHaveBeenCalledWith("thread-1", "thread-1");
    expect(useThreadUiStore.getState().selectedThreadId).toBe("thread-1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await flushPageQueries();

    expect(getThreadDetail).toHaveBeenCalledTimes(2);
    expect(getThreadDrilldown).toHaveBeenCalledTimes(2);

    rendered.unmount();
    expect(useThreadUiStore.getState().selectedThreadId).toBeNull();
  });

  it("completed-but-unarchived detail은 2000ms마다 계속 polling한다", async () => {
    vi.mocked(getThreadDetail).mockResolvedValue(buildDetail("completed", false));

    renderThreadDetailPage();

    await flushPageQueries();

    expect(getThreadDetail).toHaveBeenCalledTimes(1);
    expect(getThreadDrilldown).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await flushPageQueries();

    expect(getThreadDetail).toHaveBeenCalledTimes(2);
    expect(getThreadDrilldown).toHaveBeenCalledTimes(2);
  });

  it("archived detail은 첫 fetch 이후 polling하지 않는다", async () => {
    vi.mocked(getThreadDetail).mockResolvedValue(buildDetail("completed", true));

    renderThreadDetailPage();

    await flushPageQueries();

    expect(getThreadDetail).toHaveBeenCalledTimes(1);
    expect(getThreadDrilldown).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    await flushPageQueries();

    expect(getThreadDetail).toHaveBeenCalledTimes(1);
    expect(getThreadDrilldown).toHaveBeenCalledTimes(1);
  });
});
