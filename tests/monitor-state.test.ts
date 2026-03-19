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

function buildArchivedDataset(traceId: string) {
  const template = createMonitorInitialState().datasets[0];
  if (!template) {
    throw new Error("fixture dataset missing");
  }

  return {
    ...template,
    session: {
      ...template.session,
      sessionId: traceId,
      title: `archived-${traceId}`,
    },
    run: {
      ...template.run,
      traceId,
      title: `archived-${traceId}`,
    },
  };
}

describe("archive 요청 상태", () => {
  it("최신 검색 요청만 archive 결과를 반영한다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-index-request",
      requestId: 1,
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-index-request",
      requestId: 2,
    });

    const staleResolved = monitorStateReducer(latestRequest, {
      type: "resolve-archived-index-request",
      requestId: 1,
      result: buildArchiveResult("stale"),
      append: false,
    });
    const currentResolved = monitorStateReducer(latestRequest, {
      type: "resolve-archived-index-request",
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
      type: "begin-archived-index-request",
      requestId: 1,
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-index-request",
      requestId: 2,
    });

    const staleFinished = monitorStateReducer(latestRequest, {
      type: "finish-archived-index-request",
      requestId: 1,
    });
    const currentFinished = monitorStateReducer(latestRequest, {
      type: "finish-archived-index-request",
      requestId: 2,
    });

    expect(staleFinished.archivedIndexLoading).toBe(true);
    expect(currentFinished.archivedIndexLoading).toBe(false);
  });

  it("최신 archive snapshot 요청만 선택 결과를 반영한다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-snapshot-request",
      requestId: 1,
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-snapshot-request",
      requestId: 2,
    });

    const staleResolved = monitorStateReducer(latestRequest, {
      type: "resolve-archived-snapshot-request",
      requestId: 1,
      dataset: buildArchivedDataset("stale-archive"),
    });
    const currentResolved = monitorStateReducer(latestRequest, {
      type: "resolve-archived-snapshot-request",
      requestId: 2,
      dataset: buildArchivedDataset("fresh-archive"),
    });

    expect(staleResolved.activeRunId).toBe(latestRequest.activeRunId);
    expect(currentResolved.activeRunId).toBe("fresh-archive");
    expect(currentResolved.datasets[0]?.run.traceId).toBe("fresh-archive");
  });

  it("오래된 snapshot 완료는 최신 snapshot loading 상태를 덮어쓰지 않는다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-snapshot-request",
      requestId: 1,
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-snapshot-request",
      requestId: 2,
    });

    const staleFinished = monitorStateReducer(latestRequest, {
      type: "finish-archived-snapshot-request",
      requestId: 1,
    });
    const currentFinished = monitorStateReducer(latestRequest, {
      type: "finish-archived-snapshot-request",
      requestId: 2,
    });

    expect(staleFinished.archivedSnapshotLoading).toBe(true);
    expect(currentFinished.archivedSnapshotLoading).toBe(false);
  });
});
