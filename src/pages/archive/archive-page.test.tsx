import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchivePage } from "@/pages/archive/archive-page";
import {
  getSessionFlow,
  getThreadDrilldown,
  listArchivedSessions,
} from "@/shared/lib/tauri/commands";
import type {
  ArchivedSessionListPayload,
  SessionFlowPayload,
  ThreadDrilldown,
} from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  listArchivedSessions: vi.fn(),
  getSessionFlow: vi.fn(),
  getThreadDrilldown: vi.fn(),
}));

function buildArchivePayload(): ArchivedSessionListPayload {
  return {
    filters: {
      workspace: "/workspace/archive-alpha",
    },
    workspaces: ["/workspace/archive-alpha", "/workspace/archive-beta"],
    sessions: [
      {
        thread_id: "archived-1",
        title: "Archived alpha",
        cwd: "/workspace/archive-alpha",
        archived: true,
        status: "completed",
        started_at: "2026-03-09T09:00:00Z",
        updated_at: "2026-03-09T10:00:00Z",
        latest_activity_summary: "archive final answer",
        agent_roles: ["reviewer"],
        rollout_path: "/tmp/archive-alpha.jsonl",
      },
    ],
  };
}

function buildFlow(): SessionFlowPayload {
  return {
    session: {
      thread_id: "archived-1",
      title: "Archived alpha",
      cwd: "/workspace/archive-alpha",
      archived: true,
      status: "completed",
      started_at: "2026-03-09T09:00:00Z",
      updated_at: "2026-03-09T10:00:00Z",
      latest_activity_summary: "archive final answer",
    },
    lanes: [
      {
        lane_id: "user",
        column: "user",
        label: "User",
        agent_session_id: null,
        depth: 0,
        started_at: "2026-03-09T09:00:00Z",
        updated_at: null,
      },
      {
        lane_id: "archived-1",
        column: "main",
        label: "Main",
        agent_session_id: null,
        depth: 0,
        started_at: "2026-03-09T09:00:00Z",
        updated_at: "2026-03-09T10:00:00Z",
      },
    ],
    items: [
      {
        item_id: "item-final",
        lane_id: "archived-1",
        kind: "final_answer",
        started_at: "2026-03-09T09:59:00Z",
        ended_at: null,
        summary: "archive final answer",
        agent_session_id: null,
        target_lane_id: null,
      },
    ],
  };
}

function buildDrilldown(): ThreadDrilldown {
  return {
    lane_id: "archived-1",
    latest_commentary_summary: "archived lane commentary",
    latest_commentary_at: "2026-03-09T09:59:00Z",
    recent_tool_spans: [],
    related_wait_spans: [],
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
    vi.mocked(listArchivedSessions).mockReset();
    vi.mocked(getSessionFlow).mockReset();
    vi.mocked(getThreadDrilldown).mockReset();
  });

  it("renders archived browser rows and reuses the embedded flow workspace", async () => {
    const user = userEvent.setup();

    vi.mocked(listArchivedSessions).mockResolvedValue(buildArchivePayload());
    vi.mocked(getSessionFlow).mockResolvedValue(buildFlow());
    vi.mocked(getThreadDrilldown).mockResolvedValue(buildDrilldown());

    renderArchivePage();

    expect(await screen.findByText("아카이브 챗 세션")).toBeInTheDocument();
    expect(await screen.findByText("archive final answer")).toBeInTheDocument();

    await waitFor(() => {
      expect(listArchivedSessions).toHaveBeenCalledWith({
        workspace: "/workspace/archive-alpha",
      });
      expect(getSessionFlow).toHaveBeenCalledWith("archived-1");
      expect(getThreadDrilldown).toHaveBeenCalledWith(
        "archived-1",
        "archived-1",
      );
    });

    expect(screen.getByText("Session workspace")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "원문 보기" }));
    expect(screen.getByTestId("session-flow-raw-snippet")).toHaveTextContent(
      "archived raw line",
    );
  });
});
