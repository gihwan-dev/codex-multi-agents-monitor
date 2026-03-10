import { render, screen } from "@testing-library/react";
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
    agents: [],
    timeline_events: [],
    wait_spans: [],
    tool_spans: [],
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

  it("상세 데이터가 있으면 헤더와 swimlane 패널을 렌더링한다", () => {
    render(
      <ThreadTimelineShell
        threadId="thread-1"
        detail={buildDetail()}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Detail thread")).toBeInTheDocument();
    expect(screen.getByText("inflight")).toBeInTheDocument();
    expect(screen.getByText("Swimlane skeleton")).toBeInTheDocument();
    expect(
      screen.getByText("wait-to-child 연결선은 후속 slice에서 구현"),
    ).toBeInTheDocument();
  });
});
