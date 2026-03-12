import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createQueryClientWrapper } from "@/test/query-client";
import { monitorQueryKeys } from "@/shared/query";

import { useSessionDetailQuery } from "./use-session-detail-query";

const { isTauriRuntimeAvailable, querySessionDetail } = vi.hoisted(() => ({
  isTauriRuntimeAvailable: vi.fn(),
  querySessionDetail: vi.fn(),
}));

vi.mock("@/shared/api/tauri-monitor", () => ({
  isTauriRuntimeAvailable,
  querySessionDetail,
}));

describe("useSessionDetailQuery", () => {
  afterEach(() => {
    querySessionDetail.mockReset();
    isTauriRuntimeAvailable.mockReset();
  });

  it("stays disabled when session id is null", () => {
    isTauriRuntimeAvailable.mockReturnValue(true);

    const { result } = renderHook(() => useSessionDetailQuery(null), {
      wrapper: createQueryClientWrapper(),
    });

    expect(querySessionDetail).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("uses separate keys so old detail data does not bleed across ids", async () => {
    isTauriRuntimeAvailable.mockReturnValue(true);
    querySessionDetail.mockImplementation(({ session_id }) =>
      Promise.resolve({
        bundle: {
          events: [],
          metrics: [],
          session: {
            ended_at: null,
            is_archived: false,
            parent_session_id: null,
            session_id,
            source_kind: "session_log",
            started_at: "2026-03-12T05:00:00.000Z",
            status: "live",
            title: session_id,
            workspace_path: "/workspace/a",
          },
        },
        event_count: 0,
        last_event_at: null,
      }),
    );

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) => useSessionDetailQuery(sessionId),
      {
        initialProps: { sessionId: "session-1" },
        wrapper: createQueryClientWrapper(),
      },
    );

    await waitFor(() =>
      expect(result.current.detail?.bundle.session.session_id).toBe("session-1"),
    );

    rerender({ sessionId: "session-2" });

    expect(result.current.detail).toBeNull();

    await waitFor(() =>
      expect(result.current.detail?.bundle.session.session_id).toBe("session-2"),
    );
  });

  it("refetches on remount after the detail query was invalidated", async () => {
    const queryClient = createTestQueryClient();

    isTauriRuntimeAvailable.mockReturnValue(true);
    querySessionDetail
      .mockResolvedValueOnce({
        bundle: {
          events: [],
          metrics: [],
          session: {
            ended_at: null,
            is_archived: false,
            parent_session_id: null,
            session_id: "session-1",
            source_kind: "session_log",
            started_at: "2026-03-12T05:00:00.000Z",
            status: "live",
            title: "session-1",
            workspace_path: "/workspace/a",
          },
        },
        event_count: 0,
        last_event_at: null,
      })
      .mockResolvedValueOnce({
        bundle: {
          events: [],
          metrics: [],
          session: {
            ended_at: null,
            is_archived: false,
            parent_session_id: null,
            session_id: "session-1",
            source_kind: "session_log",
            started_at: "2026-03-12T05:00:00.000Z",
            status: "live",
            title: "session-1 refreshed",
            workspace_path: "/workspace/a",
          },
        },
        event_count: 1,
        last_event_at: "2026-03-12T05:30:00.000Z",
      });

    const hook = renderHook(() => useSessionDetailQuery("session-1"), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() =>
      expect(hook.result.current.detail?.bundle.session.title).toBe("session-1"),
    );

    hook.unmount();
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: monitorQueryKeys.sessionDetail("session-1"),
    });

    const remounted = renderHook(() => useSessionDetailQuery("session-1"), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() =>
      expect(remounted.result.current.detail?.bundle.session.title).toBe(
        "session-1 refreshed",
      ),
    );
    expect(querySessionDetail).toHaveBeenCalledTimes(2);
  });
});
