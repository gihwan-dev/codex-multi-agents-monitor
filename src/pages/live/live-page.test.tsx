import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LivePage } from "@/pages/live/live-page";
import {
  getSessionFlow,
  getSessionLaneInspector,
  listSessions,
} from "@/shared/lib/tauri/commands";
import type {
  SessionFlowPayload,
  SessionLaneInspectorPayload,
  SessionListPayload,
} from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listSessions: vi.fn(),
  getSessionFlow: vi.fn(),
  getSessionLaneInspector: vi.fn(),
}));

function buildSessionListPayload(): SessionListPayload {
  return {
    scope: "live",
    filters: {
      workspace: "/workspace/alpha",
    },
    workspaces: ["/workspace/alpha", "/workspace/beta"],
    sessions: [
      {
        session_id: "thread-1",
        title: "Session alpha",
        workspace: "/workspace/alpha",
        workspace_hint: "/Users/example/.codex/worktrees/1234/alpha",
        archived: false,
        status: "inflight",
        started_at: "2026-03-10T09:30:00Z",
        updated_at: "2026-03-10T10:00:00Z",
        latest_activity_summary: "alpha commentary",
        agent_roles: ["implementer"],
        rollout_path: "/tmp/thread-1.jsonl",
        bottleneck_level: "warning",
        longest_wait_ms: 45_000,
        active_tool_name: null,
        active_tool_ms: null,
        mini_timeline_window_started_at: "2026-03-10T09:50:00Z",
        mini_timeline_window_ended_at: "2026-03-10T10:00:00Z",
        mini_timeline: [],
      },
    ],
  };
}

function buildFlow(): SessionFlowPayload {
  return {
    session: {
      session_id: "thread-1",
      title: "Session alpha",
      workspace: "/workspace/alpha",
      workspace_hint: "/Users/example/.codex/worktrees/1234/alpha",
      archived: false,
      status: "inflight",
      started_at: "2026-03-10T09:30:00Z",
      updated_at: "2026-03-10T10:00:00Z",
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
        started_at: "2026-03-10T09:30:00Z",
        updated_at: null,
      },
      {
        lane_ref: { kind: "main", session_id: "thread-1" },
        column: "main",
        label: "Main",
        depth: 0,
        started_at: "2026-03-10T09:30:00Z",
        updated_at: "2026-03-10T10:00:00Z",
      },
    ],
    items: [
      {
        item_id: "item-commentary",
        lane: { kind: "main", session_id: "thread-1" },
        kind: "commentary",
        started_at: "2026-03-10T09:45:00Z",
        ended_at: null,
        summary: "working through slice 8",
        target_lane: null,
      },
      {
        item_id: "item-final",
        lane: { kind: "main", session_id: "thread-1" },
        kind: "final_answer",
        started_at: "2026-03-10T09:59:00Z",
        ended_at: null,
        summary: "final answer delivered",
        target_lane: null,
      },
    ],
  };
}

function buildInspector(): SessionLaneInspectorPayload {
  return {
    lane: {
      lane_ref: { kind: "main", session_id: "thread-1" },
      column: "main",
      label: "Main",
      depth: 0,
      started_at: "2026-03-10T09:30:00Z",
      updated_at: "2026-03-10T10:00:00Z",
    },
    latest_commentary_summary: "main commentary",
    latest_commentary_at: "2026-03-10T09:59:00Z",
    recent_tool_calls: [],
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
    vi.mocked(listSessions).mockReset();
    vi.mocked(getSessionFlow).mockReset();
    vi.mocked(getSessionLaneInspector).mockReset();
  });

  it("workspace 필터와 session flow workspace를 함께 렌더한다", async () => {
    const user = userEvent.setup();

    vi.mocked(listSessions).mockResolvedValue(buildSessionListPayload());
    vi.mocked(getSessionFlow).mockResolvedValue(buildFlow());
    vi.mocked(getSessionLaneInspector).mockResolvedValue(buildInspector());

    renderLivePage();

    expect(await screen.findByText("실시간 챗 세션")).toBeInTheDocument();
    expect(await screen.findByText("alpha commentary")).toBeInTheDocument();

    await waitFor(() => {
      expect(listSessions).toHaveBeenCalledWith("live", {
        workspace: "/workspace/alpha",
      });
      expect(getSessionFlow).toHaveBeenCalledWith("thread-1");
      expect(getSessionLaneInspector).toHaveBeenCalledWith("thread-1", {
        kind: "main",
        session_id: "thread-1",
      });
    });

    expect(screen.getByText("Session workspace")).toBeInTheDocument();
    expect(screen.getByText("Latest lane commentary")).toBeInTheDocument();
    expect(screen.getByText("main commentary")).toBeInTheDocument();
    expect(
      screen.getAllByText("/Users/example/.codex/worktrees/1234/alpha").length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "원문 보기" }));
    expect(screen.getByTestId("session-flow-raw-snippet")).toHaveTextContent(
      "main raw line",
    );
  });
});
