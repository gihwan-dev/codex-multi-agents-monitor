import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LiveSessionUpdate } from "@/shared/queries";
import { createTestQueryClient, createQueryClientWrapper } from "@/test/query-client";
import { monitorQueryKeys } from "@/shared/query";

import { useLiveSessionBridge } from "./use-live-session-bridge";

const {
  isTauriRuntimeAvailable,
  listenToLiveSessionUpdates,
  startLiveBridge,
} = vi.hoisted(() => ({
  isTauriRuntimeAvailable: vi.fn(),
  listenToLiveSessionUpdates: vi.fn(),
  startLiveBridge: vi.fn(),
}));

vi.mock("@/shared/api/tauri-monitor", () => ({
  isTauriRuntimeAvailable,
  listenToLiveSessionUpdates,
  startLiveBridge,
}));

describe("useLiveSessionBridge", () => {
  afterEach(() => {
    isTauriRuntimeAvailable.mockReset();
    listenToLiveSessionUpdates.mockReset();
    startLiveBridge.mockReset();
  });

  it("is a no-op when runtime is unavailable", () => {
    isTauriRuntimeAvailable.mockReturnValue(false);

    const { result } = renderHook(() => useLiveSessionBridge(), {
      wrapper: createQueryClientWrapper(),
    });

    expect(listenToLiveSessionUpdates).not.toHaveBeenCalled();
    expect(startLiveBridge).not.toHaveBeenCalled();
    expect(result.current.degradedMessage).toBeNull();
  });

  it("updates the workspace sessions cache when a live event arrives", async () => {
    const queryClient = createTestQueryClient();
    isTauriRuntimeAvailable.mockReturnValue(true);
    let onUpdate: ((update: LiveSessionUpdate) => void) | null = null;
    listenToLiveSessionUpdates.mockImplementation(async (listener) => {
      onUpdate = listener;
      return vi.fn();
    });
    startLiveBridge.mockResolvedValue(undefined);

    renderHook(() => useLiveSessionBridge(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(onUpdate).not.toBeNull());

    if (!onUpdate) {
      throw new Error("Expected listener registration");
    }

    const emitUpdate = onUpdate as (update: LiveSessionUpdate) => void;

    emitUpdate({
      refreshed_at: "2026-03-12T07:00:00.000Z",
      summary: {
        ended_at: null,
        event_count: 1,
        is_archived: false,
        last_event_at: "2026-03-12T07:00:00.000Z",
        session_id: "session-1",
        source_kind: "session_log",
        started_at: "2026-03-12T06:50:00.000Z",
        status: "live",
        title: null,
        workspace_path: "/workspace/a",
      },
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData(monitorQueryKeys.workspaceSessions()),
      ).not.toBeUndefined(),
    );
  });

  it("reports degraded state when the bridge start fails", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    listenToLiveSessionUpdates.mockResolvedValue(vi.fn());
    startLiveBridge.mockRejectedValue(new Error("bridge failed"));

    const { result } = renderHook(() => useLiveSessionBridge(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() =>
      expect(result.current.degradedMessage).toContain("Live bridge unavailable"),
    );
  });

  it("reports degraded state when listener registration fails", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    listenToLiveSessionUpdates.mockRejectedValue(new Error("listen failed"));
    startLiveBridge.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLiveSessionBridge(), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() =>
      expect(result.current.degradedMessage).toContain(
        "Live update subscription unavailable",
      ),
    );
  });

  it("calls unlisten when the listener resolves after unmount", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    const unlisten = vi.fn();
    let resolveListener: ((value: typeof unlisten) => void) | null = null;
    listenToLiveSessionUpdates.mockReturnValue(
      new Promise((resolve) => {
        resolveListener = resolve;
      }),
    );
    startLiveBridge.mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useLiveSessionBridge(), {
      wrapper: createQueryClientWrapper(),
    });

    unmount();
    if (!resolveListener) {
      throw new Error("Expected pending listener promise");
    }
    const completeListener = resolveListener as (value: typeof unlisten) => void;

    completeListener(unlisten);
    await waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
  });
});
