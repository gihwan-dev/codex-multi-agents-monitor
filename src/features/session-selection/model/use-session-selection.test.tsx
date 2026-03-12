import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkspaceSessionsSnapshot } from "@/shared/queries";

import { useSessionSelection } from "./use-session-selection";

function createSnapshot(sessionIds: string[]): WorkspaceSessionsSnapshot {
  return {
    refreshed_at: "2026-03-12T06:00:00.000Z",
    workspaces: [
      {
        sessions: sessionIds.map((sessionId, index) => ({
          ended_at: null,
          event_count: index + 1,
          is_archived: false,
          last_event_at: `2026-03-12T06:0${index}:00.000Z`,
          session_id: sessionId,
          source_kind: "session_log",
          started_at: `2026-03-12T05:0${index}:00.000Z`,
          status: "live",
          title: null,
          workspace_path: "/workspace/a",
        })),
        workspace_path: "/workspace/a",
      },
    ],
  };
}

describe("useSessionSelection", () => {
  it("auto-selects the first session on first snapshot", () => {
    const { result } = renderHook(() =>
      useSessionSelection(createSnapshot(["session-1", "session-2"])),
    );

    expect(result.current.selectedSessionId).toBe("session-1");
  });

  it("keeps current selection when the session still exists", () => {
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: WorkspaceSessionsSnapshot | null }) =>
        useSessionSelection(snapshot),
      {
        initialProps: {
          snapshot: createSnapshot(["session-1", "session-2"]),
        },
      },
    );

    result.current.selectSession("session-2");
    rerender({
      snapshot: createSnapshot(["session-1", "session-2"]),
    });

    expect(result.current.selectedSessionId).toBe("session-2");
  });

  it("falls back to the first session when current selection disappears", () => {
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: WorkspaceSessionsSnapshot | null }) =>
        useSessionSelection(snapshot),
      {
        initialProps: {
          snapshot: createSnapshot(["session-1", "session-2"]),
        },
      },
    );

    result.current.selectSession("session-2");
    rerender({
      snapshot: createSnapshot(["session-1"]),
    });

    expect(result.current.selectedSessionId).toBe("session-1");
  });
});
