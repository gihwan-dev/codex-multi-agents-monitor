import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThreadTimelineShell } from "@/features/thread-detail/ui/thread-timeline-shell";
import type { ThreadDetail } from "@/shared/types/contracts";

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

describe("ThreadTimelineShell 동작", () => {
  it("로딩 중에는 스켈레톤을 렌더링한다", () => {
    render(<ThreadTimelineShell threadId="thread-1" detail={null} isLoading />);

    expect(screen.getByText("Thread Detail")).toBeInTheDocument();
  });

  it("상세 데이터가 없으면 빈 상태를 렌더링한다", () => {
    render(
      <ThreadTimelineShell
        threadId="thread-1"
        detail={null}
        isLoading={false}
      />,
    );

    expect(
      screen.getByText((_, node) => {
        return (
          node?.textContent === "thread_id=thread-1 데이터가 아직 없습니다."
        );
      }),
    ).toBeInTheDocument();
  });

  it("상세 데이터가 있으면 메인/서브 lane과 wait connector를 렌더링한다", () => {
    render(
      <ThreadTimelineShell
        threadId="thread-1"
        detail={buildDetail()}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Detail thread")).toBeInTheDocument();
    expect(screen.getByText("inflight")).toBeInTheDocument();
    expect(screen.getByTestId("lane-thread-1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-session-child")).toBeInTheDocument();
    expect(screen.getByTestId("connector-0")).toBeInTheDocument();
    expect(screen.getByTestId("marker-summary-panel")).toHaveTextContent(
      "final answer",
    );
  });

  it("hover preview와 click 고정으로 marker summary panel을 전환한다", async () => {
    const user = userEvent.setup();

    render(
      <ThreadTimelineShell
        threadId="thread-1"
        detail={buildDetail()}
        isLoading={false}
      />,
    );

    const spawnMarker = screen.getByRole("button", { name: /spawn marker ada/i });
    const commentaryMarker = screen.getByRole("button", {
      name: /commentary marker recent commentary/i,
    });

    await user.click(spawnMarker);
    expect(screen.getByTestId("marker-summary-panel")).toHaveTextContent("Ada");

    await user.hover(commentaryMarker);
    expect(screen.getByTestId("marker-summary-panel")).toHaveTextContent(
      "recent commentary",
    );

    await user.unhover(commentaryMarker);
    expect(screen.getByTestId("marker-summary-panel")).toHaveTextContent("Ada");
  });
});
