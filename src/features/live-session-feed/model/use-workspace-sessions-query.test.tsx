import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSessionsSnapshot } from "@/shared/queries";
import { createTestQueryClient, createQueryClientWrapper } from "@/test/query-client";
import { monitorQueryKeys, workspaceSessionsQueryOptions } from "@/shared/query";

import { useWorkspaceSessionsQuery } from "./use-workspace-sessions-query";

const { isTauriRuntimeAvailable, queryWorkspaceSessions } = vi.hoisted(() => ({
  isTauriRuntimeAvailable: vi.fn(),
  queryWorkspaceSessions: vi.fn(),
}));

vi.mock("@/shared/api/tauri-monitor", () => ({
  isTauriRuntimeAvailable,
  queryWorkspaceSessions,
}));

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

describe("useWorkspaceSessionsQuery", () => {
  afterEach(() => {
    queryWorkspaceSessions.mockReset();
    isTauriRuntimeAvailable.mockReset();
  });

  it("loads workspace sessions successfully", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessions.mockResolvedValue(createSnapshot(["session-1"]));

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.snapshot?.workspaces[0]?.sessions[0]?.session_id).toBe(
      "session-1",
    );
  });

  it("preserves live summaries that arrive before bootstrap completes", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    const queryClient = createTestQueryClient();
    let resolveBootstrap:
      | ((value: WorkspaceSessionsSnapshot) => void)
      | null = null;

    queryWorkspaceSessions.mockReturnValue(
      new Promise<WorkspaceSessionsSnapshot>((resolve) => {
        resolveBootstrap = resolve;
      }),
    );

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(queryWorkspaceSessions).toHaveBeenCalledTimes(1));

    queryClient.setQueryData(
      monitorQueryKeys.workspaceSessions(),
      createSnapshot(["live-session"]),
    );

    if (!resolveBootstrap) {
      throw new Error("Expected pending bootstrap query");
    }

    const completeBootstrap =
      resolveBootstrap as (value: WorkspaceSessionsSnapshot) => void;

    completeBootstrap(createSnapshot(["bootstrap-session"]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(
      result.current.snapshot?.workspaces[0]?.sessions.map(
        (session) => session.session_id,
      ),
    ).toEqual(["bootstrap-session", "live-session"]);
  });

  it("replaces stale cached sessions on a later refetch", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(
      monitorQueryKeys.workspaceSessions(),
      createSnapshot(["stale-session"]),
    );
    queryWorkspaceSessions.mockResolvedValue(createSnapshot(["bootstrap-session"]));

    const snapshot = await queryClient.fetchQuery({
      ...workspaceSessionsQueryOptions(queryClient),
      staleTime: 0,
    });

    expect(snapshot.workspaces[0]?.sessions.map((session) => session.session_id)).toEqual([
      "bootstrap-session",
    ]);
  });

  it("surfaces bootstrap query failures as error messages", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    queryWorkspaceSessions.mockRejectedValue(new Error("query failed"));

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.snapshot).toBeNull();
    expect(result.current.errorMessage).toBe("query failed");
  });

  it("surfaces runtime unavailable without calling the transport", async () => {
    isTauriRuntimeAvailable.mockReturnValue(false);

    const { result } = renderHook(() => useWorkspaceSessionsQuery(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(queryWorkspaceSessions).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toContain("Tauri runtime unavailable");
  });
});
