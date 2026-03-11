import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionFlowDiagram } from "@/features/session-flow/ui/session-flow-diagram";
import type { SessionFlowPayload } from "@/shared/types/contracts";

function buildFlow(): SessionFlowPayload {
  return {
    session: {
      thread_id: "thread-1",
      title: "Session one",
      cwd: "/workspace/alpha",
      archived: false,
      status: "completed",
      started_at: "2026-03-10T09:00:00Z",
      updated_at: "2026-03-10T09:10:00Z",
      latest_activity_summary: "final answer delivered",
    },
    lanes: [
      {
        lane_id: "user",
        column: "user",
        label: "User",
        agent_session_id: null,
        depth: 0,
        started_at: "2026-03-10T09:00:00Z",
        updated_at: null,
      },
      {
        lane_id: "thread-1",
        column: "main",
        label: "Main",
        agent_session_id: null,
        depth: 0,
        started_at: "2026-03-10T09:00:00Z",
        updated_at: "2026-03-10T09:10:00Z",
      },
      {
        lane_id: "session-child-1",
        column: "subagent",
        label: "Reviewer",
        agent_session_id: "session-child-1",
        depth: 1,
        started_at: "2026-03-10T09:02:00Z",
        updated_at: "2026-03-10T09:06:00Z",
      },
    ],
    items: [
      {
        item_id: "item-user",
        lane_id: "user",
        kind: "user_message",
        started_at: "2026-03-10T09:00:01Z",
        ended_at: null,
        summary: "summarize the rollout",
        agent_session_id: null,
        target_lane_id: null,
      },
      {
        item_id: "item-spawn",
        lane_id: "thread-1",
        kind: "spawn",
        started_at: "2026-03-10T09:02:00Z",
        ended_at: null,
        summary: "spawn reviewer",
        agent_session_id: null,
        target_lane_id: null,
      },
      {
        item_id: "item-wait",
        lane_id: "thread-1",
        kind: "wait",
        started_at: "2026-03-10T09:03:00Z",
        ended_at: "2026-03-10T09:04:00Z",
        summary: "session-child-1",
        agent_session_id: null,
        target_lane_id: "session-child-1",
      },
    ],
  };
}

describe("SessionFlowDiagram", () => {
  it("renders macro columns and emits selection", async () => {
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
});
