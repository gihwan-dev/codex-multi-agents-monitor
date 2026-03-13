import { describe, expect, it } from "vitest";

import { resolveMonitorUiQaState } from "./ui-qa-fixtures";

describe("resolveMonitorUiQaState", () => {
  it("returns null when ui-qa mode is not requested", () => {
    expect(resolveMonitorUiQaState("?tab=live")).toBeNull();
  });

  it("parses tab, sidebar, and session params for deterministic captures", () => {
    const state = resolveMonitorUiQaState(
      "?demo=ui-qa&tab=archive&sidebar=collapsed&session=sess-archive-flow",
    );

    expect(state).not.toBeNull();
    expect(state?.activeTab).toBe("archive");
    expect(state?.sidebarOpen).toBe(false);
    expect(state?.selectedSessionId).toBe("sess-archive-flow");
    expect(state?.detailBySessionId["sess-archive-flow"]?.event_count).toBe(18);
    expect(state?.detailBySessionId["sess-archive-flow"]?.bundle.events).toHaveLength(4);
  });

  it("falls back to the first fixture session for unknown session ids", () => {
    const state = resolveMonitorUiQaState(
      "?demo=ui-qa&tab=metrics&session=missing-session",
    );

    expect(state?.activeTab).toBe("metrics");
    expect(state?.selectedSessionId).toBe("sess-ui-shell");
  });

  it("provides detail fixtures for every snapshot session", () => {
    const state = resolveMonitorUiQaState("?demo=ui-qa");

    const sessionIds =
      state?.snapshot.workspaces.flatMap((workspace) =>
        workspace.sessions.map((session) => session.session_id),
      ) ?? [];

    expect(sessionIds).not.toHaveLength(0);
    expect(
      sessionIds.every((sessionId) => state?.detailBySessionId[sessionId] != null),
    ).toBe(true);
  });

  it("exposes richer live fixtures for vertical timeline captures", () => {
    const state = resolveMonitorUiQaState("?demo=ui-qa&tab=live&session=sess-ui-shell");
    const liveEvents = state?.detailBySessionId["sess-ui-shell"]?.bundle.events ?? [];

    expect(liveEvents.filter((event) => event.kind === "user_message")).toHaveLength(2);
    expect(liveEvents.some((event) => event.lane_id === "agent:worker")).toBe(true);
    expect(liveEvents.some((event) => event.kind === "agent_complete")).toBe(true);
    expect(liveEvents.some((event) => event.kind === "token_delta")).toBe(true);
  });

});
