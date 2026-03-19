import { describe, expect, it, vi } from "vitest";
import { createMonitorArchiveActions } from "../src/app/createMonitorArchiveActions.js";
import { createMonitorViewActions } from "../src/app/createMonitorViewActions.js";
import { createMonitorInitialState } from "../src/app/monitorState.js";
import { loadArchivedSessionSnapshot } from "../src/app/sessionLogLoader.js";

vi.mock("../src/app/sessionLogLoader.js", () => ({
  loadArchivedSessionSnapshot: vi.fn(),
}));

const mockedLoadArchivedSessionSnapshot = vi.mocked(loadArchivedSessionSnapshot);

function flushMicrotask() {
  return Promise.resolve();
}

function requireLiveDataset() {
  const dataset = createMonitorInitialState().datasets.find(
    (item) => item.run.liveMode === "live",
  );
  if (!dataset) {
    throw new Error("live dataset missing");
  }
  return dataset;
}

describe("createMonitorViewActions", () => {
  it("live run에서 과거 이벤트를 선택하면 follow-live를 끈다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      state,
      dispatch,
      activeDataset,
      activeFollowLive: true,
    });
    const staleEventId = activeDataset.events[0]?.eventId;

    expect(staleEventId).toBe(activeDataset.events[0]?.eventId);
    if (!staleEventId) {
      throw new Error("stale event missing");
    }

    actions.selectItem({ kind: "event", id: staleEventId });

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "set-selection",
      selection: { kind: "event", id: staleEventId },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "set-follow-live",
      traceId: activeDataset.run.traceId,
      value: false,
    });
  });

  it("멈춘 live run에서 follow-live를 다시 켜면 최신 이벤트를 선택한다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      state,
      dispatch,
      activeDataset,
      activeFollowLive: false,
    });
    const latestEventId = activeDataset.events[activeDataset.events.length - 1]?.eventId;

    expect(latestEventId).toBe(activeDataset.events[activeDataset.events.length - 1]?.eventId);
    if (!latestEventId) {
      throw new Error("latest event missing");
    }

    actions.toggleFollowLive();

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "toggle-follow-live",
      traceId: activeDataset.run.traceId,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "set-selection",
      selection: { kind: "event", id: latestEventId },
    });
  });
});

describe("createMonitorArchiveActions", () => {
  it("append 로드 시 현재 archive 길이와 검색어를 요청에 전달한다", () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 7,
      archivedSearch: "codex",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef: { current: 0 },
    });

    actions.loadArchiveIndex(true);

    expect(requestArchiveIndex).toHaveBeenCalledWith(7, true, "codex");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("archive 검색은 검색어를 상태에 저장한 뒤 첫 페이지를 다시 요청한다", () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 2,
      archivedSearch: "",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef: { current: 3 },
    });

    actions.searchArchive("planner");

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-archived-search",
      value: "planner",
    });
    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, "planner");
  });

  it("archive snapshot 로드 성공 시 최신 request id로 dataset을 반영한다", async () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const dataset = createMonitorInitialState().datasets[0];
    const archiveSnapshotRequestIdRef = { current: 4 };
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 0,
      archivedSearch: "",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef,
    });

    expect(dataset).toBe(createMonitorInitialState().datasets[0]);
    if (!dataset) {
      throw new Error("dataset missing");
    }
    mockedLoadArchivedSessionSnapshot.mockResolvedValueOnce(dataset);

    actions.selectArchivedSession("/tmp/archive.json");
    await flushMicrotask();

    expect(archiveSnapshotRequestIdRef.current).toBe(5);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "begin-archived-snapshot-request",
      requestId: 5,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "resolve-archived-snapshot-request",
      requestId: 5,
      dataset,
    });
    expect(requestArchiveIndex).not.toHaveBeenCalled();
  });
});
