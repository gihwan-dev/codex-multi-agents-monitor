import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionFlowDiagram } from "@/features/session-flow/ui/session-flow-diagram";
import type { SessionFlowPayload } from "@/shared/types/contracts";

function buildFlow(): SessionFlowPayload {
  return {
    session: {
      session_id: "thread-1",
      title: "Session one",
      workspace: "/workspace/alpha",
      workspace_hint: null,
      archived: false,
      status: "completed",
      started_at: "2026-03-10T09:00:00Z",
      updated_at: "2026-03-10T09:10:00Z",
      latest_activity_summary: "final answer delivered",
      agent_roles: ["reviewer"],
      rollout_path: "/tmp/thread-1.jsonl",
    },
    lanes: [
      {
        lane_ref: { kind: "user" },
        column: "user",
        label: "User",
        depth: 0,
        started_at: "2026-03-10T09:00:00Z",
        updated_at: null,
      },
      {
        lane_ref: { kind: "main", session_id: "thread-1" },
        column: "main",
        label: "Main",
        depth: 0,
        started_at: "2026-03-10T09:00:00Z",
        updated_at: "2026-03-10T09:10:00Z",
      },
      {
        lane_ref: { kind: "subagent", agent_session_id: "session-child-1" },
        column: "subagent",
        label: "Reviewer",
        depth: 1,
        started_at: "2026-03-10T09:02:00Z",
        updated_at: "2026-03-10T09:06:00Z",
      },
    ],
    items: [
      {
        item_id: "item-user",
        lane: { kind: "user" },
        kind: "user_message",
        started_at: "2026-03-10T09:00:01Z",
        ended_at: null,
        summary: "summarize the rollout",
        target_lane: null,
      },
      {
        item_id: "item-spawn",
        lane: { kind: "main", session_id: "thread-1" },
        kind: "spawn",
        started_at: "2026-03-10T09:02:00Z",
        ended_at: null,
        summary: "spawn reviewer",
        target_lane: null,
      },
      {
        item_id: "item-wait",
        lane: { kind: "main", session_id: "thread-1" },
        kind: "wait",
        started_at: "2026-03-10T09:03:00Z",
        ended_at: "2026-03-10T09:04:00Z",
        summary: "session-child-1",
        target_lane: {
          kind: "subagent",
          agent_session_id: "session-child-1",
        },
      },
    ],
  };
}

describe("SessionFlowDiagram", () => {
  it("매크로 컬럼을 그리고 아이템 선택을 전달한다", async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();

    render(
      <SessionFlowDiagram
        flow={buildFlow()}
        selectedItemId={null}
        onSelectItem={onSelectItem}
      />,
    );

    expect(screen.getAllByText("User")).not.toHaveLength(0);
    expect(screen.getAllByText("Main")).not.toHaveLength(0);
    expect(screen.getByText("Subagents")).toBeInTheDocument();

    await user.click(screen.getByTestId("session-flow-item-item-wait"));
    expect(onSelectItem).toHaveBeenCalledWith("item-wait");
  });

  it("줌 변경 후 Reset으로 기본 viewBox를 복원한다", async () => {
    const user = userEvent.setup();

    render(
      <SessionFlowDiagram
        flow={buildFlow()}
        selectedItemId={null}
        onSelectItem={() => {}}
      />,
    );

    const svg = screen.getByLabelText("Session flow diagram");
    expect(svg).toHaveAttribute("viewBox", "0 0 980 420");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(svg.getAttribute("viewBox")).not.toBe("0 0 980 420");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(svg).toHaveAttribute("viewBox", "0 0 980 420");
  });
});
