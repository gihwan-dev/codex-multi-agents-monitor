import { afterEach, describe, expect, it, vi } from "vitest";
import { createMonitorArchiveActions } from "../src/app/createMonitorArchiveActions.js";
import { createMonitorInitialState } from "../src/app/monitorState.js";
import { loadArchivedSessionSnapshot } from "../src/app/sessionLogLoader.js";

vi.mock("../src/app/sessionLogLoader.js", () => ({
  loadArchivedSessionSnapshot: vi.fn(),
}));

const mockedLoadArchivedSessionSnapshot = vi.mocked(loadArchivedSessionSnapshot);
type ArchivedSnapshotResult = Awaited<ReturnType<typeof loadArchivedSessionSnapshot>>;

afterEach(() => {
  vi.clearAllMocks();
});

function expectDefined<T>(value: T | null | undefined, message: string): T {
  expect(value).toBeDefined();
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function createArchiveActionsHarness(options?: {
  archivedIndexLength?: number;
  archivedSearch?: string;
  requestId?: number;
}) {
  const dispatch = vi.fn();
  const requestArchiveIndex = vi.fn();
  const archiveSnapshotRequestIdRef = { current: options?.requestId ?? 0 };
  const actions = createMonitorArchiveActions({
    archivedIndexLength: options?.archivedIndexLength ?? 0,
    archivedSearch: options?.archivedSearch ?? "",
    dispatch,
    requestArchiveIndex,
    archiveSnapshotRequestIdRef,
  });

  return {
    actions,
    dispatch,
    requestArchiveIndex,
    archiveSnapshotRequestIdRef,
  };
}

function createDeferredSnapshotResult() {
  let resolve!: (value: ArchivedSnapshotResult) => void;
  const promise = new Promise<ArchivedSnapshotResult>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createArchiveDataset(traceId: string) {
  const baseDataset = expectDefined(
    createMonitorInitialState().datasets[0],
    "dataset missing",
  );

  return {
    ...baseDataset,
    run: {
      ...baseDataset.run,
      traceId,
      title: traceId,
    },
  };
}

describe("createMonitorArchiveActions", () => {
  it("append 로드 시 현재 archive 길이와 검색어를 요청에 전달한다", () => {
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      archivedIndexLength: 7,
      archivedSearch: "codex",
    });

    actions.loadArchiveIndex(true);

    expect(requestArchiveIndex).toHaveBeenCalledWith(7, true, "codex");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("첫 페이지 로드에서는 공백-only 검색어를 undefined로 정규화한다", () => {
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      archivedIndexLength: 7,
      archivedSearch: "   ",
    });

    actions.loadArchiveIndex(false);

    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, undefined);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("archive 검색은 검색어를 상태에 저장한 뒤 첫 페이지를 다시 요청한다", () => {
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      archivedIndexLength: 2,
      requestId: 3,
    });

    actions.searchArchive("planner");

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-archived-search",
      value: "planner",
    });
    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, "planner");
  });

  it("archive 검색어가 비면 검색 파라미터를 비운다", () => {
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      archivedIndexLength: 2,
      archivedSearch: "codex",
      requestId: 3,
    });

    actions.searchArchive("");

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-archived-search",
      value: "",
    });
    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, undefined);
  });

  it("archive 검색 요청은 앞뒤 공백을 제거한 검색어를 전달한다", () => {
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      archivedIndexLength: 2,
      requestId: 3,
    });

    actions.searchArchive("  planner  ");

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-archived-search",
      value: "  planner  ",
    });
    expect(requestArchiveIndex).toHaveBeenCalledWith(0, false, "planner");
  });

  it("archive snapshot 로드 성공 시 최신 request id로 dataset을 반영한다", async () => {
    const { actions, dispatch, requestArchiveIndex, archiveSnapshotRequestIdRef } =
      createArchiveActionsHarness({ requestId: 4 });
    const dataset = createArchiveDataset("archive-success");
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
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      requestId: 7,
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

  it("archive snapshot 연속 선택은 filePath를 유지하고 request id를 순차 증가시킨다", async () => {
    const { actions, dispatch, requestArchiveIndex, archiveSnapshotRequestIdRef } =
      createArchiveActionsHarness({ requestId: 10 });
    const firstResult = createDeferredSnapshotResult();
    const secondResult = createDeferredSnapshotResult();
    const firstDataset = createArchiveDataset("archive-a");
    const secondDataset = createArchiveDataset("archive-b");

    mockedLoadArchivedSessionSnapshot
      .mockImplementationOnce(() => firstResult.promise)
      .mockImplementationOnce(() => secondResult.promise);

    actions.selectArchivedSession("/tmp/archive-a.json");
    actions.selectArchivedSession("/tmp/archive-b.json");

    expect(mockedLoadArchivedSessionSnapshot).toHaveBeenNthCalledWith(
      1,
      "/tmp/archive-a.json",
    );
    expect(mockedLoadArchivedSessionSnapshot).toHaveBeenNthCalledWith(
      2,
      "/tmp/archive-b.json",
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "begin-archived-snapshot-request",
      requestId: 11,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "begin-archived-snapshot-request",
      requestId: 12,
    });

    secondResult.resolve(secondDataset);
    firstResult.resolve(firstDataset);

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "resolve-archived-snapshot-request",
        requestId: 12,
        dataset: secondDataset,
      });
      expect(dispatch).toHaveBeenCalledWith({
        type: "resolve-archived-snapshot-request",
        requestId: 11,
        dataset: firstDataset,
      });
    });

    expect(archiveSnapshotRequestIdRef.current).toBe(12);
    expect(requestArchiveIndex).not.toHaveBeenCalled();
  });

  it("archive snapshot 로드가 실패해도 loading 상태를 종료한다", async () => {
    const { actions, dispatch, requestArchiveIndex } = createArchiveActionsHarness({
      requestId: 1,
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
