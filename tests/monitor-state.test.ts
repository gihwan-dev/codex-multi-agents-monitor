import { describe, expect, it } from "vitest";
import {
  createMonitorInitialState,
  monitorStateReducer,
} from "../src/pages/monitor/model/state/index.js";

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

  it("follow-live가 꺼져 있어도 stale/disconnected/reconnected 전환은 badge에 반영한다", () => {
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

    const afterLiveFrame = monitorStateReducer(pausedState, {
      type: "apply-live-frame",
    });
    const afterStaleFrame = monitorStateReducer(afterLiveFrame, {
      type: "apply-live-frame",
    });
    const afterDisconnectedFrame = monitorStateReducer(afterStaleFrame, {
      type: "apply-live-frame",
    });
    const afterReconnectedFrame = monitorStateReducer(afterDisconnectedFrame, {
      type: "apply-live-frame",
    });

    expect(afterLiveFrame.liveConnectionByRunId[liveRun.run.traceId]).toBe("paused");
    expect(afterStaleFrame.liveConnectionByRunId[liveRun.run.traceId]).toBe("stale");
    expect(afterDisconnectedFrame.liveConnectionByRunId[liveRun.run.traceId]).toBe(
      "disconnected",
    );
    expect(afterDisconnectedFrame.selection).toEqual(pausedSelection);
    expect(afterReconnectedFrame.liveConnectionByRunId[liveRun.run.traceId]).toBe(
      "reconnected",
    );
    expect(afterReconnectedFrame.selection).toEqual(pausedSelection);
  });

  it("stale live run에서 follow-live를 다시 켜도 stale badge를 유지한다", () => {
    const liveRun = requireDataset("trace-fix-006");
    const initialState = createMonitorInitialState();
    const pausedState = {
      ...initialState,
      followLiveByRunId: {
        ...initialState.followLiveByRunId,
        [liveRun.run.traceId]: false,
      },
    };

    const staleState = monitorStateReducer(
      monitorStateReducer(pausedState, { type: "apply-live-frame" }),
      { type: "apply-live-frame" },
    );
    const resumedState = monitorStateReducer(staleState, {
      type: "toggle-follow-live",
      traceId: liveRun.run.traceId,
    });

    expect(staleState.liveConnectionByRunId[liveRun.run.traceId]).toBe("stale");
    expect(resumedState.followLiveByRunId[liveRun.run.traceId]).toBe(true);
    expect(resumedState.liveConnectionByRunId[liveRun.run.traceId]).toBe("stale");
  });

  it("stale 연결에서 set-follow-live로 멈춰도 stale badge를 유지한다", () => {
    const liveRun = requireDataset("trace-fix-006");
    const staleState = monitorStateReducer(
      monitorStateReducer(createMonitorInitialState(), {
        type: "apply-live-frame",
      }),
      { type: "apply-live-frame" },
    );
    const pausedFromStaleState = monitorStateReducer(staleState, {
      type: "set-follow-live",
      traceId: liveRun.run.traceId,
      value: false,
    });

    expect(staleState.liveConnectionByRunId[liveRun.run.traceId]).toBe("stale");
    expect(pausedFromStaleState.followLiveByRunId[liveRun.run.traceId]).toBe(false);
    expect(pausedFromStaleState.liveConnectionByRunId[liveRun.run.traceId]).toBe("stale");
  });
});

describe("archive 요청 상태", () => {
  it("drawer 닫기 액션은 이미 닫힌 상태에서도 다시 열지 않는다", () => {
    const closedState = createMonitorInitialState();
    const reopenedState = monitorStateReducer(closedState, {
      type: "set-drawer-open",
      open: false,
    });
    const openedState = monitorStateReducer(closedState, {
      type: "set-drawer-open",
      open: true,
    });
    const closedAgainState = monitorStateReducer(openedState, {
      type: "set-drawer-open",
      open: false,
    });

    expect(reopenedState.drawerOpen).toBe(false);
    expect(openedState.drawerOpen).toBe(true);
    expect(closedAgainState.drawerOpen).toBe(false);
  });

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

  it("dataset 교체는 run별 UI 상태를 재초기화하고 raw drawer fallback을 적용한다", () => {
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
