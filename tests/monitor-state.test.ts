import { describe, expect, it } from "vitest";
import {
  createMonitorInitialState,
  monitorStateReducer,
} from "../src/app/useMonitorAppState.js";

function requireDataset(traceId: string) {
  const dataset = createMonitorInitialState().datasets.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    throw new Error(`fixture dataset missing: ${traceId}`);
  }
  return dataset;
}

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

describe("live 상태 전이", () => {
  it("imported run에서는 follow-live 토글을 무시한다", () => {
    const importedRun = createMonitorInitialState().datasets.find(
      (item) => item.run.liveMode === "imported",
    );

    expect(importedRun).toBeDefined();
    if (!importedRun) {
      throw new Error("fixture imported run missing");
    }

    const initialState = createMonitorInitialState();
    const nextState = monitorStateReducer(initialState, {
      type: "toggle-follow-live",
      traceId: importedRun.run.traceId,
    });

    expect(nextState).toBe(initialState);
  });

  it("follow-live 중인 active live run은 새 frame 적용 시 최신 이벤트를 선택한다", () => {
    const liveRun = requireDataset("trace-fix-006");
    const liveSelectedState = monitorStateReducer(createMonitorInitialState(), {
      type: "set-active-run",
      traceId: liveRun.run.traceId,
    });

    const nextState = monitorStateReducer(liveSelectedState, {
      type: "apply-live-frame",
    });
    const updatedLiveRun = nextState.datasets.find((item) => item.run.traceId === liveRun.run.traceId);

    expect(updatedLiveRun).toBeDefined();
    expect(nextState.appliedLiveFrames).toBe(1);
    expect(updatedLiveRun?.events.length).toBeGreaterThan(liveRun.events.length);
    expect(nextState.selection).toEqual({
      kind: "event",
      id: updatedLiveRun?.events[updatedLiveRun.events.length - 1]?.eventId,
    });
  });

  it("follow-live가 꺼진 live run은 새 frame이 와도 현재 선택을 유지한다", () => {
    const liveRun = requireDataset("trace-fix-006");
    const initialState = createMonitorInitialState();
    const pausedSelection = {
      kind: "event" as const,
      id: liveRun.events[0]?.eventId ?? "",
    };
    const pausedState = {
      ...initialState,
      activeRunId: liveRun.run.traceId,
      selection: pausedSelection,
      followLiveByRunId: {
        ...initialState.followLiveByRunId,
        [liveRun.run.traceId]: false,
      },
    };

    const nextState = monitorStateReducer(pausedState, {
      type: "apply-live-frame",
    });

    expect(nextState.appliedLiveFrames).toBe(1);
    expect(nextState.selection).toEqual(pausedSelection);
    expect(nextState.liveConnectionByRunId[liveRun.run.traceId]).toBe("paused");
  });
});

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

  it("dataset 교체는 run별 UI 상태를 재초기화하고 raw 탭 fallback을 적용한다", () => {
    const replacementDataset = {
      ...requireDataset("trace-fix-005"),
      run: {
        ...requireDataset("trace-fix-005").run,
        rawIncluded: false,
      },
    };
    const stateWithRawTab = {
      ...createMonitorInitialState(),
      activeRunId: "trace-fix-999",
      inspectorTab: "raw" as const,
      drawerTab: "raw" as const,
      appliedLiveFrames: 3,
      filtersByRunId: {
        "trace-fix-999": {
          agentId: "agent-1",
          eventType: "error" as const,
          search: "handoff",
          errorOnly: true,
        },
      },
      collapsedGapIds: {
        "trace-fix-999": ["gap-1"],
      },
    };

    const nextState = monitorStateReducer(stateWithRawTab, {
      type: "replace-datasets",
      datasets: [replacementDataset],
    });

    expect(nextState.activeRunId).toBe(replacementDataset.run.traceId);
    expect(nextState.inspectorTab).toBe("summary");
    expect(nextState.drawerTab).toBe("artifacts");
    expect(nextState.appliedLiveFrames).toBe(0);
    expect(nextState.filtersByRunId).toEqual({
      [replacementDataset.run.traceId]: {
        agentId: null,
        eventType: "all",
        search: "",
        errorOnly: false,
      },
    });
    expect(nextState.collapsedGapIds).toEqual({
      [replacementDataset.run.traceId]: [],
    });
  });
});
