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

function sessionDetailPayload(options: {
  eventCount?: number;
  lastEventAt?: string | null;
  sessionId: string;
  title?: string;
}) {
  const { eventCount = 0, lastEventAt = null, sessionId, title = sessionId } = options;
  const session = {
    ended_at: null,
    is_archived: false,
    parent_session_id: null,
    session_id: sessionId,
    source_kind: "session_log" as const,
    started_at: "2026-03-12T05:00:00.000Z",
    status: "live" as const,
    title,
    workspace_path: "/workspace/a",
  };

  return {
    bundle: {
      events: [],
      metrics: [],
      session,
    },
    event_count: eventCount,
    last_event_at: lastEventAt,
    timeline: {
      root_session_id: sessionId,
      sessions: [session],
      events: [],
      lineage_relations: [],
    },
  };
}

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
      Promise.resolve(sessionDetailPayload({ sessionId: session_id })),
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
      .mockResolvedValueOnce(sessionDetailPayload({ sessionId: "session-1" }))
      .mockResolvedValueOnce(
        sessionDetailPayload({
          eventCount: 1,
          lastEventAt: "2026-03-12T05:30:00.000Z",
          sessionId: "session-1",
          title: "session-1 refreshed",
        }),
      );

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
