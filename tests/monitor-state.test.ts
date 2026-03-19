import { describe, expect, it } from "vitest";
import {
  createMonitorInitialState,
  monitorStateReducer,
} from "../src/app/useMonitorAppState.js";

function buildArchiveResult(sessionId: string) {
  return {
    items: [
      {
        sessionId,
        workspacePath: `/tmp/${sessionId}`,
        originPath: `/tmp/${sessionId}`,
        displayName: sessionId,
        startedAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        model: null,
        messageCount: 1,
        filePath: `/tmp/${sessionId}.json`,
        firstUserMessage: null,
      },
    ],
    total: 1,
    hasMore: false,
  };
}

describe("archive 요청 상태", () => {
  it("최신 검색 요청만 archive 결과를 반영한다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-request",
      requestId: 1,
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-request",
      requestId: 2,
    });

    const staleResolved = monitorStateReducer(latestRequest, {
      type: "resolve-archived-request",
      requestId: 1,
      result: buildArchiveResult("stale"),
      append: false,
    });
    const currentResolved = monitorStateReducer(latestRequest, {
      type: "resolve-archived-request",
      requestId: 2,
      result: buildArchiveResult("fresh"),
      append: false,
    });

    expect(staleResolved.archivedIndex).toEqual([]);
    expect(currentResolved.archivedIndex.map((item) => item.sessionId)).toEqual(["fresh"]);
  });

  it("오래된 요청 완료는 최신 loading 상태를 덮어쓰지 않는다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-request",
      requestId: 1,
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-request",
      requestId: 2,
    });

    const staleFinished = monitorStateReducer(latestRequest, {
      type: "finish-archived-request",
      requestId: 1,
    });
    const currentFinished = monitorStateReducer(latestRequest, {
      type: "finish-archived-request",
      requestId: 2,
    });

    expect(staleFinished.archivedLoading).toBe(true);
    expect(currentFinished.archivedLoading).toBe(false);
  });
});
