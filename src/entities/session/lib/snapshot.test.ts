import { describe, expect, it } from "vitest";

import type {
  LiveSessionUpdate,
  SessionSummary,
  WorkspaceSessionsSnapshot,
} from "@/shared/queries";

import {
  compareRefreshMarkers,
  mergeBootstrapSnapshot,
  pruneLiveSnapshot,
  selectLiveWorkspaceSnapshot,
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
    parent_session_id: null,
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

  it("keeps every visible root session per workspace for live mode", () => {
    const snapshot = sortSnapshot({
      refreshed_at: "2026-03-12T07:00:00.000Z",
      workspaces: [
        {
          workspace_path: "/workspace/a",
          sessions: [
            createSummary({
              session_id: "root-latest",
              last_event_at: "2026-03-12T07:10:00.000Z",
            }),
            createSummary({
              session_id: "root-earlier",
              last_event_at: "2026-03-12T07:05:00.000Z",
            }),
            createSummary({
              session_id: "child-session",
              last_event_at: "2026-03-12T07:20:00.000Z",
              parent_session_id: "root-latest",
            }),
            createSummary({
              session_id: "archived-root",
              is_archived: true,
              status: "archived",
              source_kind: "archive_log",
            }),
          ],
        },
        {
          workspace_path: "/workspace/b",
          sessions: [
            createSummary({
              session_id: "older-root",
              workspace_path: "/workspace/b",
              last_event_at: "2026-03-12T06:00:00.000Z",
            }),
          ],
        },
      ],
    });

    expect(
      selectLiveWorkspaceSnapshot(snapshot)?.workspaces.map((workspace) => ({
        sessionIds: workspace.sessions.map((session) => session.session_id),
        workspacePath: workspace.workspace_path,
      })),
    ).toEqual([
      {
        sessionIds: ["root-latest", "root-earlier"],
        workspacePath: "/workspace/a",
      },
      {
        sessionIds: ["older-root"],
        workspacePath: "/workspace/b",
      },
    ]);
  });

  it("prunes live overlay sessions that are at or before the authoritative refresh", () => {
    const pruned = pruneLiveSnapshot(
      createSnapshot([
        createSummary({
          session_id: "stale-session",
          last_event_at: "2026-03-12T06:30:00.000Z",
        }),
        createSummary({
          session_id: "fresh-session",
          last_event_at: "2026-03-12T07:30:00.000Z",
        }),
      ], "2026-03-12T06:30:00.000Z#00000000000000000002"),
      "2026-03-12T07:00:00.000Z#00000000000000000003",
    );

    expect(pruned).toBeNull();
  });

  it("prefers revision markers over wall-clock timestamps when comparing snapshots", () => {
    expect(
      compareRefreshMarkers(
        "2026-03-12T07:00:00.000Z#00000000000000000005",
        "2026-03-12T08:00:00.000Z#00000000000000000004",
      ),
    ).toBeGreaterThan(0);
  });
});
