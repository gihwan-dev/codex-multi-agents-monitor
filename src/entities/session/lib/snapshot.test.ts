import { describe, expect, it } from "vitest";

import type {
  LiveSessionUpdate,
  SessionSummary,
  WorkspaceSessionsSnapshot,
} from "@/shared/queries";

import {
  mergeBootstrapSnapshot,
  sortSnapshot,
  upsertSessionSummary,
} from "./snapshot";

function createSummary(
  overrides: Partial<SessionSummary> & Pick<SessionSummary, "session_id">,
): SessionSummary {
  return {
    ended_at: null,
    event_count: 1,
    is_archived: false,
    last_event_at: "2026-03-12T06:00:00.000Z",
    source_kind: "session_log",
    started_at: "2026-03-12T05:00:00.000Z",
    status: "live",
    title: null,
    workspace_path: "/workspace/a",
    ...overrides,
  };
}

function createSnapshot(
  summaries: SessionSummary[],
  refreshedAt = "2026-03-12T06:00:00.000Z",
): WorkspaceSessionsSnapshot {
  return sortSnapshot({
    refreshed_at: refreshedAt,
    workspaces: [
      {
        sessions: summaries,
        workspace_path: "/workspace/a",
      },
    ],
  });
}

describe("snapshot helpers", () => {
  it("replaces duplicate session summaries and keeps ordering", () => {
    const initial = createSnapshot([
      createSummary({
        session_id: "session-1",
        last_event_at: "2026-03-12T05:00:00.000Z",
      }),
      createSummary({
        session_id: "session-2",
        last_event_at: "2026-03-12T04:00:00.000Z",
      }),
    ]);

    const next = upsertSessionSummary(
      initial,
      createSummary({
        session_id: "session-2",
        last_event_at: "2026-03-12T07:00:00.000Z",
      }),
      "2026-03-12T07:00:00.000Z",
    );

    expect(next.workspaces[0]?.sessions.map((session) => session.session_id)).toEqual([
      "session-2",
      "session-1",
    ]);
    expect(next.workspaces[0]?.sessions[0]?.last_event_at).toBe(
      "2026-03-12T07:00:00.000Z",
    );
  });

  it("merges live summaries into bootstrap snapshots", () => {
    const bootstrap = createSnapshot([createSummary({ session_id: "session-1" })]);
    const liveUpdate: LiveSessionUpdate = {
      refreshed_at: "2026-03-12T07:30:00.000Z",
      summary: createSummary({
        session_id: "session-live",
        last_event_at: "2026-03-12T07:30:00.000Z",
      }),
    };

    const merged = mergeBootstrapSnapshot(
      bootstrap,
      upsertSessionSummary(null, liveUpdate.summary, liveUpdate.refreshed_at),
    );

    expect(merged.workspaces[0]?.sessions.map((session) => session.session_id)).toEqual([
      "session-live",
      "session-1",
    ]);
  });
});
