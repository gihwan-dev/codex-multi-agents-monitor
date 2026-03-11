import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LivePage } from "@/pages/live/live-page";
import {
  getSessionFlow,
  getThreadDrilldown,
  listLiveThreads,
} from "@/shared/lib/tauri/commands";
import type {
  LiveOverviewThread,
  SessionFlowPayload,
  ThreadDrilldown,
} from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listLiveThreads: vi.fn(),
  getSessionFlow: vi.fn(),
  getThreadDrilldown: vi.fn(),
}));

function buildThread(overrides?: Partial<LiveOverviewThread>): LiveOverviewThread {
  return {
    thread_id: "thread-1",
    title: "Session alpha",
    cwd: "/workspace/alpha",
    status: "inflight",
    started_at: "2026-03-10T09:30:00Z",
    updated_at: "2026-03-10T10:00:00Z",
    latest_activity_summary: "alpha commentary",
    agent_roles: ["implementer"],
    bottleneck_level: "warning",
    longest_wait_ms: 45_000,
    active_tool_name: null,
    active_tool_ms: null,
    mini_timeline_window_started_at: "2026-03-10T09:50:00Z",
    mini_timeline_window_ended_at: "2026-03-10T10:00:00Z",
    mini_timeline: [],
    ...overrides,
  };
}

function buildFlow(): SessionFlowPayload {
  return {
    session: {
      thread_id: "thread-1",
      title: "Session alpha",
      cwd: "/workspace/alpha",
      archived: false,
      status: "inflight",
      started_at: "2026-03-10T09:30:00Z",
      updated_at: "2026-03-10T10:00:00Z",
      latest_activity_summary: "final answer delivered",
    },
    lanes: [
      {
        lane_id: "user",
        column: "user",
        label: "User",
        agent_session_id: null,
        depth: 0,
        started_at: "2026-03-10T09:30:00Z",
        updated_at: null,
      },
      {
        lane_id: "thread-1",
        column: "main",
        label: "Main",
        agent_session_id: null,
        depth: 0,
        started_at: "2026-03-10T09:30:00Z",
        updated_at: "2026-03-10T10:00:00Z",
      },
    ],
    items: [
      {
        item_id: "item-commentary",
        lane_id: "thread-1",
        kind: "commentary",
        started_at: "2026-03-10T09:45:00Z",
        ended_at: null,
        summary: "working through slice 8",
        agent_session_id: null,
        target_lane_id: null,
      },
      {
        item_id: "item-final",
        lane_id: "thread-1",
        kind: "final_answer",
        started_at: "2026-03-10T09:59:00Z",
        ended_at: null,
        summary: "final answer delivered",
        agent_session_id: null,
        target_lane_id: null,
      },
    ],
  };
}

function buildDrilldown(): ThreadDrilldown {
  return {
    lane_id: "thread-1",
    latest_commentary_summary: "main commentary",
    latest_commentary_at: "2026-03-10T09:59:00Z",
    recent_tool_spans: [],
    related_wait_spans: [],
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
  };
}

function renderLivePage(
  initialEntry = "/live/thread-1?workspace=%2Fworkspace%2Falpha",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/live" element={<LivePage />} />
          <Route path="/live/:sessionId" element={<LivePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LivePage", () => {
  beforeEach(() => {
    vi.mocked(listLiveThreads).mockReset();
    vi.mocked(getSessionFlow).mockReset();
    vi.mocked(getThreadDrilldown).mockReset();
  });

  it("renders workspace-filtered sessions and embeds the flow workspace", async () => {
    const user = userEvent.setup();

    vi.mocked(listLiveThreads).mockResolvedValue([
      buildThread(),
      buildThread({
        thread_id: "thread-2",
        title: "Session beta",
        cwd: "/workspace/beta",
      }),
    ]);
    vi.mocked(getSessionFlow).mockResolvedValue(buildFlow());
    vi.mocked(getThreadDrilldown).mockResolvedValue(buildDrilldown());

    renderLivePage();

    expect(await screen.findByText("실시간 챗 세션")).toBeInTheDocument();
    expect(await screen.findByText("alpha commentary")).toBeInTheDocument();
    expect(screen.queryByText("Session beta")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getSessionFlow).toHaveBeenCalledWith("thread-1");
      expect(getThreadDrilldown).toHaveBeenCalledWith("thread-1", "thread-1");
    });

    expect(screen.getByText("Session workspace")).toBeInTheDocument();
    expect(screen.getByText("Latest lane commentary")).toBeInTheDocument();
    expect(screen.getByText("main commentary")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "원문 보기" }));
    expect(screen.getByTestId("session-flow-raw-snippet")).toHaveTextContent(
      "main raw line",
    );
  });
});
