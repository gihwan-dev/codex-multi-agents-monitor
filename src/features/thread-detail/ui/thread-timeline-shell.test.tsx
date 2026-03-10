import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThreadTimelineShell } from "@/features/thread-detail/ui/thread-timeline-shell";
import { getThreadDrilldown } from "@/shared/lib/tauri/commands";
import type { ThreadDetail, ThreadDrilldown } from "@/shared/types/contracts";

vi.mock("@/shared/lib/tauri/commands", () => ({
  getThreadDrilldown: vi.fn(),
}));

function buildDetail(): ThreadDetail {
  return {
    thread: {
      thread_id: "thread-1",
      title: "Detail thread",
      cwd: "/workspace/detail",
      status: "inflight",
      started_at: "2026-03-10T09:30:00Z",
      updated_at: "2026-03-10T10:00:00Z",
      latest_activity_summary: "recent commentary",
    },
    agents: [
      {
        session_id: "session-child",
        thread_id: "thread-1",
        agent_role: "implementer",
        agent_nickname: "Ada",
        depth: 1,
        started_at: "2026-03-10T09:36:00Z",
        updated_at: "2026-03-10T09:58:00Z",
      },
    ],
    timeline_events: [
      {
        event_id: "event-commentary",
        thread_id: "thread-1",
        agent_session_id: null,
        kind: "commentary",
        started_at: "2026-03-10T09:35:00Z",
        ended_at: null,
        summary: "recent commentary",
      },
      {
        event_id: "event-spawn",
        thread_id: "thread-1",
        agent_session_id: null,
        kind: "spawn",
        started_at: "2026-03-10T09:36:00Z",
        ended_at: null,
        summary: "Ada",
      },
      {
        event_id: "event-final",
        thread_id: "thread-1",
        agent_session_id: null,
        kind: "final",
        started_at: "2026-03-10T09:59:00Z",
        ended_at: null,
        summary: "final answer",
      },
    ],
    wait_spans: [
      {
        call_id: "wait-main-child",
        thread_id: "thread-1",
        parent_session_id: "thread-1",
        child_session_id: "session-child",
        started_at: "2026-03-10T09:40:00Z",
        ended_at: "2026-03-10T09:47:00Z",
        duration_ms: 420_000,
      },
    ],
    tool_spans: [
      {
        call_id: "tool-main-exec",
        thread_id: "thread-1",
        agent_session_id: null,
        tool_name: "exec_command",
        started_at: "2026-03-10T09:38:00Z",
        ended_at: "2026-03-10T09:39:00Z",
        duration_ms: 60_000,
      },
    ],
  };
}

function buildDrilldown(laneId: string): ThreadDrilldown {
  const commentary =
    laneId === "thread-1" ? "main commentary" : "child commentary";
  const rawLine = laneId === "thread-1" ? "main raw line" : "child raw line";

  return {
    lane_id: laneId,
    latest_commentary_summary: commentary,
    latest_commentary_at: "2026-03-10T09:59:00Z",
    recent_tool_spans: [
      {
        call_id: laneId === "thread-1" ? "tool-main-drilldown" : "tool-child-drilldown",
        thread_id: "thread-1",
        agent_session_id: laneId === "thread-1" ? null : laneId,
        tool_name: "exec_command",
        started_at: "2026-03-10T09:58:00Z",
        ended_at: "2026-03-10T09:59:00Z",
        duration_ms: 60_000,
      },
    ],
    related_wait_spans: [
      {
        call_id: laneId === "thread-1" ? "wait-main-drilldown" : "wait-child-drilldown",
        thread_id: "thread-1",
        parent_session_id: "thread-1",
        child_session_id: laneId === "thread-1" ? "session-child" : laneId,
        started_at: "2026-03-10T09:40:00Z",
        ended_at: "2026-03-10T09:47:00Z",
        duration_ms: 420_000,
      },
    ],
    raw_snippet: {
      source_label: `${laneId}.jsonl`,
      truncated: false,
      lines: [
        {
          line_number: 7,
          content: rawLine,
        },
      ],
    },
  };
}

function renderShell(detail: ThreadDetail | null, isLoading = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThreadTimelineShell
        threadId="thread-1"
        detail={detail}
        isLoading={isLoading}
      />
    </QueryClientProvider>,
  );
}

describe("ThreadTimelineShell 동작", () => {
  beforeEach(() => {
    vi.mocked(getThreadDrilldown).mockReset();
    vi.mocked(getThreadDrilldown).mockImplementation(
      async (_threadId, laneId) => buildDrilldown(laneId),
    );
  });

  it("로딩 중에는 스켈레톤을 렌더링한다", () => {
    renderShell(null, true);

    expect(screen.getByText("Thread Detail")).toBeInTheDocument();
  });

  it("상세 데이터가 없으면 빈 상태를 렌더링한다", () => {
    renderShell(null);

    expect(
      screen.getByText((_, node) => {
        return (
          node?.textContent === "thread_id=thread-1 데이터가 아직 없습니다."
        );
      }),
    ).toBeInTheDocument();
  });

  it("상세 데이터가 있으면 메인/서브 lane과 wait connector를 렌더링한다", async () => {
    renderShell(buildDetail());

    await waitFor(() => {
      expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
        "main commentary",
      );
    });

    expect(screen.getByText("Detail thread")).toBeInTheDocument();
    expect(screen.getByText("inflight")).toBeInTheDocument();
    expect(screen.getByTestId("lane-thread-1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-session-child")).toBeInTheDocument();
    expect(screen.getByTestId("connector-0")).toBeInTheDocument();
    expect(screen.getByTestId("marker-summary-panel")).toHaveTextContent(
      "final answer",
    );
    expect(getThreadDrilldown).toHaveBeenCalledWith("thread-1", "thread-1");
  });

  it("lane click으로 drilldown이 바뀌고 raw snippet은 기본 접힘 후 lane 변경 시 리셋된다", async () => {
    const user = userEvent.setup();
    renderShell(buildDetail());

    await waitFor(() => {
      expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
        "main commentary",
      );
    });

    await user.click(screen.getByTestId("lane-session-child"));
    await waitFor(() => {
      expect(getThreadDrilldown).toHaveBeenCalledWith(
        "thread-1",
        "session-child",
      );
      expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
        "child commentary",
      );
    });
    expect(screen.queryByText("child raw line")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "원문 보기" }));
    expect(screen.getByTestId("raw-snippet-content")).toHaveTextContent(
      "child raw line",
    );

    await user.click(screen.getByTestId("lane-thread-1"));
    await waitFor(() => {
      expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
        "main commentary",
      );
    });
    expect(screen.queryByTestId("raw-snippet-content")).not.toBeInTheDocument();
  });

  it("hover preview는 marker summary만 바꾸고 drilldown lane 선택은 유지한다", async () => {
    const user = userEvent.setup();
    renderShell(buildDetail());

    await waitFor(() => {
      expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
        "main commentary",
      );
    });

    await user.click(screen.getByTestId("lane-session-child"));
    await waitFor(() => {
      expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
        "child commentary",
      );
    });

    const commentaryMarker = screen.getByRole("button", {
      name: /commentary marker recent commentary/i,
    });
    await user.hover(commentaryMarker);

    expect(screen.getByTestId("marker-summary-panel")).toHaveTextContent(
      "recent commentary",
    );
    expect(screen.getByTestId("thread-drilldown-panel")).toHaveTextContent(
      "child commentary",
    );
  });
});
