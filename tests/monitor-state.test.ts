import { describe, expect, it } from "vitest";
import {
  createMonitorInitialState,
  monitorStateReducer,
} from "./helpers/monitorTestApi.js";

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

function buildRecentIndexItem(sessionId: string) {
  return {
    sessionId,
    workspacePath: `/tmp/${sessionId}`,
    originPath: `/tmp/${sessionId}`,
    displayName: sessionId,
    startedAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:01:00.000Z",
    model: "gpt-5",
    filePath: `/tmp/${sessionId}.jsonl`,
    firstUserMessage: `first ${sessionId}`,
    title: sessionId,
    status: "done" as const,
    lastEventSummary: `last ${sessionId}`,
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

function buildLiveRecentDataset(traceId: string) {
  const template = requireDataset("trace-fix-006");

  return {
    ...template,
    session: {
      ...template.session,
      sessionId: traceId,
      title: `live-${traceId}`,
    },
    run: {
      ...template.run,
      traceId,
      title: `live-${traceId}`,
      liveMode: "live" as const,
      isArchived: false,
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

  it("알 수 없는 run에도 set-follow-live는 연결 상태를 즉시 기록한다", () => {
    const nextState = monitorStateReducer(createMonitorInitialState(), {
      type: "set-follow-live",
      traceId: "missing-trace",
      value: true,
    });

    expect(nextState.followLiveByRunId["missing-trace"]).toBe(true);
    expect(nextState.liveConnectionByRunId["missing-trace"]).toBe("live");
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

  it("archive 요청 실패는 stale 결과를 지우고 에러를 기록한다", () => {
    const initialState = {
      ...createMonitorInitialState(),
      archivedIndex: buildArchiveResult("stale").items,
      archivedTotal: 1,
      archivedHasMore: true,
    };
    const requestState = monitorStateReducer(initialState, {
      type: "begin-archived-index-request",
      requestId: 1,
    });

    const nextState = monitorStateReducer(requestState, {
      type: "finish-archived-index-request",
      requestId: 1,
      error: "Archive sessions are unavailable right now.",
    });

    expect(nextState.archivedIndex).toEqual([]);
    expect(nextState.archivedTotal).toBe(0);
    expect(nextState.archivedHasMore).toBe(false);
    expect(nextState.archivedIndexLoading).toBe(false);
    expect(nextState.archivedIndexError).toBe("Archive sessions are unavailable right now.");
  });

  it("최신 archive snapshot 요청만 선택 결과를 반영한다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-snapshot-request",
      requestId: 1,
      filePath: "/tmp/stale-archive.json",
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-snapshot-request",
      requestId: 2,
      filePath: "/tmp/fresh-archive.json",
    });
    const buildState = monitorStateReducer(latestRequest, {
      type: "begin-archived-snapshot-build",
      requestId: 2,
      filePath: "/tmp/fresh-archive.json",
    });

    const staleResolved = monitorStateReducer(buildState, {
      type: "resolve-archived-snapshot-request",
      requestId: 1,
      filePath: "/tmp/stale-archive.json",
      dataset: buildArchivedDataset("stale-archive"),
    });
    const currentResolved = monitorStateReducer(buildState, {
      type: "resolve-archived-snapshot-request",
      requestId: 2,
      filePath: "/tmp/fresh-archive.json",
      dataset: buildArchivedDataset("fresh-archive"),
    });

    expect(buildState.selectionLoadState).toMatchObject({
      source: "archived",
      filePath: "/tmp/fresh-archive.json",
      phase: "building_graph",
    });
    expect(staleResolved.activeRunId).toBe(buildState.activeRunId);
    expect(currentResolved.activeRunId).toBe("fresh-archive");
    expect(currentResolved.datasets[0]?.run.traceId).toBe("fresh-archive");
    expect(currentResolved.selectionLoadState).toBeNull();
  });

  it("오래된 snapshot 완료는 최신 snapshot loading 상태를 덮어쓰지 않는다", () => {
    const initialState = createMonitorInitialState();
    const firstRequest = monitorStateReducer(initialState, {
      type: "begin-archived-snapshot-request",
      requestId: 1,
      filePath: "/tmp/stale-archive.json",
    });
    const latestRequest = monitorStateReducer(firstRequest, {
      type: "begin-archived-snapshot-request",
      requestId: 2,
      filePath: "/tmp/fresh-archive.json",
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

  it("archive snapshot 취소는 loading 상태를 비우고 이전 resolve를 무효화한다", () => {
    const pendingState = monitorStateReducer(createMonitorInitialState(), {
      type: "begin-archived-snapshot-request",
      requestId: 3,
      filePath: "/tmp/archive-cancel.json",
    });
    const cancelledState = monitorStateReducer(pendingState, {
      type: "cancel-archived-snapshot-request",
      requestId: 4,
    });
    const staleResolved = monitorStateReducer(cancelledState, {
      type: "resolve-archived-snapshot-request",
      requestId: 3,
      filePath: "/tmp/archive-cancel.json",
      dataset: buildArchivedDataset("archive-cancelled"),
    });

    expect(cancelledState.archivedSnapshotLoading).toBe(false);
    expect(cancelledState.selectionLoadState).toBeNull();
    expect(staleResolved.datasets).toEqual(cancelledState.datasets);
  });

  it("recent index 로드 시작은 fixture 목록을 내리고 준비 상태를 표시한다", () => {
    const initialState = createMonitorInitialState();

    const nextState = monitorStateReducer(initialState, {
      type: "begin-recent-index-request",
    });

    expect(nextState.recentIndexLoading).toBe(true);
    expect(nextState.datasets).toEqual([]);
    expect(nextState.activeRunId).toBe("");
    expect(nextState.selection).toBeNull();
    expect(nextState.selectionLoadState).toMatchObject({
      source: "recent",
      filePath: null,
      phase: "indexing_recent",
      announcement: "Preparing recent sessions",
    });
  });

  it("recent index resolve는 recent 목록을 채우고 snapshot hydrate 전까지 empty 상태를 유지한다", () => {
    const initialState = monitorStateReducer(createMonitorInitialState(), {
      type: "begin-recent-index-request",
    });

    const nextState = monitorStateReducer(initialState, {
      type: "resolve-recent-index-request",
      items: [buildRecentIndexItem("recent-001")],
    });

    expect(nextState.recentIndexReady).toBe(true);
    expect(nextState.recentIndex).toHaveLength(1);
    expect(nextState.activeRunId).toBe("");
    expect(nextState.datasets).toEqual([]);
    expect(nextState.selection).toBeNull();
    expect(nextState.selectionLoadState).toBeNull();
  });

  it("recent snapshot resolve는 cache를 채우고 최신 요청만 반영한다", () => {
    const initialState = monitorStateReducer(
      monitorStateReducer(createMonitorInitialState(), {
        type: "begin-recent-index-request",
      }),
      {
      type: "resolve-recent-index-request",
      items: [buildRecentIndexItem("recent-001")],
      },
    );
    const pendingState = monitorStateReducer(initialState, {
      type: "begin-recent-snapshot-request",
      requestId: 1,
      filePath: "/tmp/recent-001.jsonl",
    });
    const latestState = monitorStateReducer(pendingState, {
      type: "begin-recent-snapshot-request",
      requestId: 2,
      filePath: "/tmp/recent-002.jsonl",
    });
    const buildState = monitorStateReducer(latestState, {
      type: "begin-recent-snapshot-build",
      requestId: 2,
      filePath: "/tmp/recent-002.jsonl",
    });

    const staleResolved = monitorStateReducer(buildState, {
      type: "resolve-recent-snapshot-request",
      requestId: 1,
      filePath: "/tmp/recent-001.jsonl",
      dataset: buildArchivedDataset("recent-001"),
    });
    const currentResolved = monitorStateReducer(buildState, {
      type: "resolve-recent-snapshot-request",
      requestId: 2,
      filePath: "/tmp/recent-002.jsonl",
      dataset: buildArchivedDataset("recent-002"),
    });

    expect(buildState.selectionLoadState).toMatchObject({
      source: "recent",
      filePath: "/tmp/recent-002.jsonl",
      phase: "building_graph",
    });
    expect(staleResolved.datasets).toEqual(buildState.datasets);
    expect(currentResolved.activeRunId).toBe("recent-002");
    expect(currentResolved.hydratedDatasetsByFilePath["/tmp/recent-002.jsonl"]?.run.traceId).toBe(
      "recent-002",
    );
    expect(currentResolved.selectionLoadState).toBeNull();
  });

  it("recent live snapshot resolve는 follow-live를 기본 on으로 활성화한다", () => {
    const initialState = monitorStateReducer(
      monitorStateReducer(createMonitorInitialState(), {
        type: "begin-recent-index-request",
      }),
      {
        type: "resolve-recent-index-request",
        items: [buildRecentIndexItem("recent-live-001")],
      },
    );
    const pendingState = monitorStateReducer(initialState, {
      type: "begin-recent-snapshot-request",
      requestId: 1,
      filePath: "/tmp/recent-live-001.jsonl",
    });

    const resolvedState = monitorStateReducer(pendingState, {
      type: "resolve-recent-snapshot-request",
      requestId: 1,
      filePath: "/tmp/recent-live-001.jsonl",
      dataset: buildLiveRecentDataset("recent-live-001"),
    });

    expect(resolvedState.followLiveByRunId["recent-live-001"]).toBe(true);
    expect(resolvedState.liveConnectionByRunId["recent-live-001"]).toBe("live");
  });

  it("silent recent live refresh는 follow-live 중 최신 이벤트 selection을 유지한다", () => {
    const dataset = buildLiveRecentDataset("recent-live-refresh");
    const latestEvent = dataset.events[dataset.events.length - 1];
    if (!latestEvent) {
      throw new Error("latest event missing");
    }

    const initialState = {
      ...createMonitorInitialState(),
      datasets: [dataset],
      hydratedDatasetsByFilePath: {
        "/tmp/recent-live-refresh.jsonl": dataset,
      },
      activeRunId: dataset.run.traceId,
      selection: { kind: "event" as const, id: dataset.events[0]?.eventId ?? "" },
      followLiveByRunId: {
        [dataset.run.traceId]: true,
      },
      liveConnectionByRunId: {
        [dataset.run.traceId]: "live" as const,
      },
      collapsedGapIds: {
        [dataset.run.traceId]: [],
      },
    };

    const refreshedState = monitorStateReducer(initialState, {
      type: "refresh-recent-snapshot",
      filePath: "/tmp/recent-live-refresh.jsonl",
      dataset,
    });

    expect(refreshedState.selection).toEqual({
      kind: "event",
      id: latestEvent.eventId,
    });
    expect(refreshedState.followLiveByRunId[dataset.run.traceId]).toBe(true);
  });

  it("recent snapshot 취소는 loading 상태를 비우고 이전 resolve를 무효화한다", () => {
    const initialState = monitorStateReducer(
      monitorStateReducer(createMonitorInitialState(), {
        type: "begin-recent-index-request",
      }),
      {
        type: "resolve-recent-index-request",
        items: [buildRecentIndexItem("recent-001")],
      },
    );
    const pendingState = monitorStateReducer(initialState, {
      type: "begin-recent-snapshot-request",
      requestId: 5,
      filePath: "/tmp/recent-001.jsonl",
    });
    const cancelledState = monitorStateReducer(pendingState, {
      type: "cancel-recent-snapshot-request",
      requestId: 6,
    });
    const staleResolved = monitorStateReducer(cancelledState, {
      type: "resolve-recent-snapshot-request",
      requestId: 5,
      filePath: "/tmp/recent-001.jsonl",
      dataset: buildArchivedDataset("recent-cancelled"),
    });

    expect(cancelledState.recentSnapshotLoadingId).toBeNull();
    expect(cancelledState.selectionLoadState).toBeNull();
    expect(staleResolved.datasets).toEqual(cancelledState.datasets);
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
    expect(nextState.collapsedGapIds).toEqual({
      [replacementDataset.run.traceId]: [],
    });
  });
});
