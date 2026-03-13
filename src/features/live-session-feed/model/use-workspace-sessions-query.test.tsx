import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSessionsSnapshot } from "@/shared/queries";
import { createTestQueryClient, createQueryClientWrapper } from "@/test/query-client";
import { monitorQueryKeys, workspaceSessionsQueryOptions } from "@/shared/query";

import { useWorkspaceSessionsQuery } from "./use-workspace-sessions-query";

const {
  isTauriRuntimeAvailable,
  queryWorkspaceSessions,
  queryWorkspaceSessionsCached,
} = vi.hoisted(() => ({
  isTauriRuntimeAvailable: vi.fn(),
  queryWorkspaceSessions: vi.fn(),
  queryWorkspaceSessionsCached: vi.fn(),
}));

vi.mock("@/shared/api/tauri-monitor", () => ({
  isTauriRuntimeAvailable,
  queryWorkspaceSessions,
  queryWorkspaceSessionsCached,
}));

function createSnapshot(
  sessionIds: string[],
  refreshedAt = "2026-03-12T06:00:00.000Z#00000000000000000001",
): WorkspaceSessionsSnapshot {
  return {
    refreshed_at: refreshedAt,
    workspaces: [
      {
        sessions: sessionIds.map((sessionId, index) => ({
          ended_at: null,
          event_count: index + 1,
          is_archived: false,
          last_event_at: `2026-03-12T06:0${index}:00.000Z`,
          parent_session_id: null,
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

function createSingleSessionSnapshot(
  sessionId: string,
  lastEventAt: string,
): WorkspaceSessionsSnapshot {
  return {
    refreshed_at: `${lastEventAt}#00000000000000000002`,
    workspaces: [
      {
        workspace_path: "/workspace/a",
        sessions: [
          {
            ended_at: null,
            event_count: 1,
            is_archived: false,
            last_event_at: lastEventAt,
            parent_session_id: null,
            session_id: sessionId,
            source_kind: "session_log",
            started_at: "2026-03-12T05:00:00.000Z",
            status: "live",
            title: null,
            workspace_path: "/workspace/a",
          },
        ],
      },
    ],
  };
}

describe("useWorkspaceSessionsQuery", () => {
  afterEach(() => {
    queryWorkspaceSessions.mockReset();
    queryWorkspaceSessionsCached.mockReset();
    isTauriRuntimeAvailable.mockReset();
  });

  it("seeds cached sessions immediately and replaces them after refresh succeeds", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessionsCached.mockResolvedValue(createSnapshot(["cached-session"]));
    let resolveRefresh:
      | ((value: WorkspaceSessionsSnapshot) => void)
      | null = null;

    queryWorkspaceSessions.mockReturnValue(
      new Promise<WorkspaceSessionsSnapshot>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() =>
      expect(result.current.snapshot?.workspaces[0]?.sessions[0]?.session_id).toBe(
        "cached-session",
      ),
    );

    if (!resolveRefresh) {
      throw new Error("Expected pending refresh query");
    }

    const completeRefresh =
      resolveRefresh as (value: WorkspaceSessionsSnapshot) => void;
    completeRefresh(createSnapshot(["refresh-session"]));

    await waitFor(() =>
      expect(result.current.snapshot?.workspaces[0]?.sessions[0]?.session_id).toBe(
        "refresh-session",
      ),
    );
  });

  it("prunes stale live summaries once the authoritative refresh catches up", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessionsCached.mockResolvedValue(createSnapshot(["cached-session"]));
    const queryClient = createTestQueryClient();
    let resolveRefresh:
      | ((value: WorkspaceSessionsSnapshot) => void)
      | null = null;

    queryWorkspaceSessions.mockReturnValue(
      new Promise<WorkspaceSessionsSnapshot>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() =>
      expect(result.current.snapshot?.workspaces[0]?.sessions[0]?.session_id).toBe(
        "cached-session",
      ),
    );

    queryClient.setQueryData(
      monitorQueryKeys.workspaceSessionsLive(),
      createSingleSessionSnapshot("live-session", "2026-03-12T06:30:00.000Z"),
    );

    await waitFor(() =>
      expect(
        result.current.snapshot?.workspaces[0]?.sessions.map(
          (session) => session.session_id,
        ),
      ).toEqual(["live-session", "cached-session"]),
    );

    if (!resolveRefresh) {
      throw new Error("Expected pending refresh query");
    }

    const completeRefresh =
      resolveRefresh as (value: WorkspaceSessionsSnapshot) => void;
    completeRefresh(
      createSnapshot(["refresh-session"], "2026-03-12T07:00:00.000Z#00000000000000000003"),
    );

    await waitFor(() =>
      expect(
        result.current.snapshot?.workspaces[0]?.sessions.map(
          (session) => session.session_id,
        ),
      ).toEqual(["refresh-session"]),
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryData(monitorQueryKeys.workspaceSessionsLive()),
      ).toBeNull(),
    );
  });

  it("prefers the newer cached snapshot over an older full refresh snapshot", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessionsCached.mockResolvedValue(
      createSnapshot(["cached-session"], "2026-03-12T07:00:00.000Z#00000000000000000003"),
    );
    queryWorkspaceSessions.mockResolvedValue(
      createSnapshot(["refresh-session"], "2026-03-12T08:00:00.000Z#00000000000000000002"),
    );

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() =>
      expect(result.current.snapshot?.workspaces[0]?.sessions[0]?.session_id).toBe(
        "cached-session",
      ),
    );
  });

  it("keeps cached sessions visible when the refresh fails", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessionsCached.mockResolvedValue(createSnapshot(["cached-session"]));
    queryWorkspaceSessions.mockRejectedValue(new Error("query failed"));

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => expect(result.current.errorMessage).toBe("query failed"));

    expect(result.current.snapshot?.workspaces[0]?.sessions[0]?.session_id).toBe(
      "cached-session",
    );
  });

  it("surfaces runtime unavailable without calling the transport", async () => {
    isTauriRuntimeAvailable.mockReturnValue(false);

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(queryWorkspaceSessionsCached).not.toHaveBeenCalled();
    expect(queryWorkspaceSessions).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toContain("Tauri runtime unavailable");
  });

  it("stays idle when explicitly disabled for ui-qa mode", async () => {
    isTauriRuntimeAvailable.mockReturnValue(false);

    const { result } = renderHook(() => useWorkspaceSessionsQuery(false), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(queryWorkspaceSessionsCached).not.toHaveBeenCalled();
    expect(queryWorkspaceSessions).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.snapshot).toBeNull();
  });

  it("returns refreshed data through the shared query options", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessions.mockResolvedValue(createSnapshot(["refresh-session"]));

    const queryClient = createTestQueryClient();
    const snapshot = await queryClient.fetchQuery({
      ...workspaceSessionsQueryOptions(),
      staleTime: 0,
    });

    expect(snapshot.workspaces[0]?.sessions[0]?.session_id).toBe("refresh-session");
  });

  it("does not prune live overlay when a later wall-clock snapshot has an older revision", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessionsCached.mockResolvedValue(
      createSnapshot(["cached-session"], "2026-03-12T08:00:00.000Z#00000000000000000001"),
    );
    queryWorkspaceSessions.mockResolvedValue(
      createSnapshot(["refresh-session"], "2026-03-12T09:00:00.000Z#00000000000000000001"),
    );
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(
      monitorQueryKeys.workspaceSessionsLive(),
      createSingleSessionSnapshot("live-session", "2026-03-12T06:30:00.000Z"),
    );
    queryClient.setQueryData(monitorQueryKeys.workspaceSessionsLive(), (current) =>
      current
        ? {
            ...current,
            refreshed_at: "2026-03-12T07:00:00.000Z#00000000000000000002",
          }
        : current,
    );

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() =>
      expect(
        result.current.snapshot?.workspaces[0]?.sessions.map((session) => session.session_id),
      ).toEqual(["live-session", "refresh-session"]),
    );
  });
});
