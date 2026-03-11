import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchivePage } from "@/pages/archive/archive-page";
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

function buildArchivePayload(): SessionListPayload {
  return {
    scope: "archive",
    filters: {
      workspace: "/workspace/archive-alpha",
    },
    workspaces: ["/workspace/archive-alpha", "/workspace/archive-beta"],
    sessions: [
      {
        session_id: "archived-1",
        title: "Archived alpha",
        workspace: "/workspace/archive-alpha",
        archived: true,
        status: "completed",
        started_at: "2026-03-09T09:00:00Z",
        updated_at: "2026-03-09T10:00:00Z",
        latest_activity_summary: "archive final answer",
        agent_roles: ["reviewer"],
        rollout_path: "/tmp/archived-1.jsonl",
        bottleneck_level: null,
        longest_wait_ms: null,
        active_tool_name: null,
        active_tool_ms: null,
        mini_timeline_window_started_at: null,
        mini_timeline_window_ended_at: null,
        mini_timeline: [],
      },
    ],
  };
}

function buildFlow(): SessionFlowPayload {
  return {
    session: {
      session_id: "archived-1",
      title: "Archived alpha",
      workspace: "/workspace/archive-alpha",
      archived: true,
      status: "completed",
      started_at: "2026-03-09T09:00:00Z",
      updated_at: "2026-03-09T10:00:00Z",
      latest_activity_summary: "archive final answer",
      agent_roles: ["reviewer"],
      rollout_path: "/tmp/archived-1.jsonl",
    },
    lanes: [
      {
        lane_ref: { kind: "user" },
        column: "user",
        label: "User",
        depth: 0,
        started_at: "2026-03-09T09:00:00Z",
        updated_at: null,
      },
      {
        lane_ref: { kind: "main", session_id: "archived-1" },
        column: "main",
        label: "Main",
        depth: 0,
        started_at: "2026-03-09T09:00:00Z",
        updated_at: "2026-03-09T10:00:00Z",
      },
    ],
    items: [
      {
        item_id: "item-final",
        lane: { kind: "main", session_id: "archived-1" },
        kind: "final_answer",
        started_at: "2026-03-09T09:59:00Z",
        ended_at: null,
        summary: "archive final answer",
        target_lane: null,
      },
    ],
  };
}

function buildInspector(): SessionLaneInspectorPayload {
  return {
    lane: {
      lane_ref: { kind: "main", session_id: "archived-1" },
      column: "main",
      label: "Main",
      depth: 0,
      started_at: "2026-03-09T09:00:00Z",
      updated_at: "2026-03-09T10:00:00Z",
    },
    latest_commentary_summary: "archived lane commentary",
    latest_commentary_at: "2026-03-09T09:59:00Z",
    recent_tool_calls: [],
    related_waits: [],
    raw_snippet: {
      source_label: "archived-1.jsonl",
      truncated: false,
      lines: [
        {
          line_number: 20,
          content: "archived raw line",
        },
      ],
    },
    degraded_reason: null,
  };
}

function renderArchivePage(
  initialEntry = "/archive/archived-1?workspace=%2Fworkspace%2Farchive-alpha",
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
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/archive/:sessionId" element={<ArchivePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ArchivePage", () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockReset();
    vi.mocked(getSessionFlow).mockReset();
    vi.mocked(getSessionLaneInspector).mockReset();
  });

  it("archive scope에서도 동일한 flow workspace를 재사용한다", async () => {
    const user = userEvent.setup();

    vi.mocked(listSessions).mockResolvedValue(buildArchivePayload());
    vi.mocked(getSessionFlow).mockResolvedValue(buildFlow());
    vi.mocked(getSessionLaneInspector).mockResolvedValue(buildInspector());

    renderArchivePage();

    expect(await screen.findByText("아카이브 챗 세션")).toBeInTheDocument();
    expect(await screen.findByText("archive final answer")).toBeInTheDocument();

    await waitFor(() => {
      expect(listSessions).toHaveBeenCalledWith("archive", {
        workspace: "/workspace/archive-alpha",
      });
      expect(getSessionFlow).toHaveBeenCalledWith("archived-1");
      expect(getSessionLaneInspector).toHaveBeenCalledWith("archived-1", {
        kind: "main",
        session_id: "archived-1",
      });
    });

    expect(screen.getByText("Session workspace")).toBeInTheDocument();
    expect(screen.getByText("archived lane commentary")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "원문 보기" }));
    expect(screen.getByTestId("session-flow-raw-snippet")).toHaveTextContent(
      "archived raw line",
    );
  });
});
