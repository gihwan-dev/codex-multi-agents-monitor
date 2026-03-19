import { describe, expect, it, vi } from "vitest";
import { createMonitorArchiveActions } from "../src/app/createMonitorArchiveActions.js";
import { createMonitorViewActions } from "../src/app/createMonitorViewActions.js";
import { createMonitorInitialState } from "../src/app/monitorState.js";
import { loadArchivedSessionSnapshot } from "../src/app/sessionLogLoader.js";

vi.mock("../src/app/sessionLogLoader.js", () => ({
  loadArchivedSessionSnapshot: vi.fn(),
}));

const mockedLoadArchivedSessionSnapshot = vi.mocked(loadArchivedSessionSnapshot);

function expectDefined<T>(value: T | null | undefined, message: string): T {
  expect(value).toBeDefined();
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function requireLiveDataset() {
  return expectDefined(
    createMonitorInitialState().datasets.find((item) => item.run.liveMode === "live"),
    "live dataset missing",
  );
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
    const staleEventId = expectDefined(activeDataset.events[0]?.eventId, "stale event missing");

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
    const latestEventId = expectDefined(
      activeDataset.events[activeDataset.events.length - 1]?.eventId,
      "latest event missing",
    );

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

  it("첫 페이지 로드에서는 빈 검색어를 undefined로 정규화한다", () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 7,
      archivedSearch: "",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef: { current: 0 },
    });

    actions.loadArchiveIndex(false);

    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, undefined);
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

  it("archive 검색어가 비면 검색 파라미터를 비운다", () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 2,
      archivedSearch: "codex",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef: { current: 3 },
    });

    actions.searchArchive("");

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-archived-search",
      value: "",
    });
    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, undefined);
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

    expectDefined(dataset, "dataset missing");
    mockedLoadArchivedSessionSnapshot.mockResolvedValueOnce(dataset);

    actions.selectArchivedSession("/tmp/archive.json");
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: "resolve-archived-snapshot-request",
        requestId: 5,
        dataset,
      });
    });

    expect(archiveSnapshotRequestIdRef.current).toBe(5);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "begin-archived-snapshot-request",
      requestId: 5,
    });
    expect(requestArchiveIndex).not.toHaveBeenCalled();
  });

  it("archive snapshot 결과가 비어도 loading 상태를 종료한다", async () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 0,
      archivedSearch: "",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef: { current: 7 },
    });
    mockedLoadArchivedSessionSnapshot.mockResolvedValueOnce(null);

    actions.selectArchivedSession("/tmp/archive.json");
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: "finish-archived-snapshot-request",
        requestId: 8,
      });
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "begin-archived-snapshot-request",
      requestId: 8,
    });
    expect(requestArchiveIndex).not.toHaveBeenCalled();
  });

  it("archive snapshot 로드가 실패해도 loading 상태를 종료한다", async () => {
    const dispatch = vi.fn();
    const requestArchiveIndex = vi.fn();
    const actions = createMonitorArchiveActions({
      archivedIndexLength: 0,
      archivedSearch: "",
      dispatch,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef: { current: 1 },
    });
    mockedLoadArchivedSessionSnapshot.mockRejectedValueOnce(new Error("archive down"));

    actions.selectArchivedSession("/tmp/archive.json");
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: "finish-archived-snapshot-request",
        requestId: 2,
      });
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "begin-archived-snapshot-request",
      requestId: 2,
    });
    expect(requestArchiveIndex).not.toHaveBeenCalled();
  });
});
