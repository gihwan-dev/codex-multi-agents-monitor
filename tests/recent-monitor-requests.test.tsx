// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDatasetFromSessionLogAsync } from "../src/entities/session-log/index.js";
import type { SessionLogSnapshot } from "../src/entities/session-log/model/types.js";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/helpers.js";
import { useRecentMonitorRequests } from "../src/pages/monitor/model/useRecentMonitorRequests.js";

vi.mock("../src/entities/session-log/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/entities/session-log/index.js")>();

  return {
    ...actual,
    buildDatasetFromSessionLogAsync: vi.fn(),
  };
});

const mockedBuildDatasetFromSessionLogAsync = vi.mocked(buildDatasetFromSessionLogAsync);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createLiveUpdateSnapshot(sessionId: string): SessionLogSnapshot {
  return {
    sessionId,
    workspacePath: "/tmp/recent-workspace",
    originPath: "/tmp/recent-workspace",
    displayName: `Recent workspace ${sessionId}`,
    startedAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:05:00.000Z",
    model: "gpt-5",
    entries: [],
    isArchived: false,
    subagents: [],
    promptAssembly: [],
  };
}

describe("useRecentMonitorRequests", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mockedBuildDatasetFromSessionLogAsync.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    vi.clearAllMocks();
  });

  it("ignores stale async live snapshot builds that resolve after a newer update", async () => {
    const initialDataset = createMonitorInitialState().datasets.find(
      (dataset) => dataset.run.traceId === "trace-fix-006",
    );
    if (!initialDataset) {
      throw new Error("initial live dataset missing");
    }

    const firstDataset = {
      ...initialDataset,
      run: {
        ...initialDataset.run,
        traceId: "recent-live-001",
      },
    };
    const secondDataset = {
      ...firstDataset,
      events: [
        ...firstDataset.events,
        {
          ...firstDataset.events.at(-1)!,
          eventId: "fix6-reconnect",
        },
      ],
    };
    const firstBuild = createDeferred<typeof firstDataset | null>();
    const secondBuild = createDeferred<typeof secondDataset | null>();
    const dispatch = vi.fn();
    const recentLiveUpdateSequenceRef = { current: 0 };
    const recentSnapshotRequestIdRef = { current: 0 };
    let handleRecentLiveUpdate:
      | ReturnType<typeof useRecentMonitorRequests>["handleRecentLiveUpdate"]
      | null = null;

    mockedBuildDatasetFromSessionLogAsync
      .mockReturnValueOnce(firstBuild.promise)
      .mockReturnValueOnce(secondBuild.promise);

    function Harness() {
      handleRecentLiveUpdate = useRecentMonitorRequests({
        state: createMonitorInitialState(),
        dispatch,
        cancelPendingSelectionLoad: () => {},
        recentSnapshotRequestIdRef,
        recentLiveUpdateSequenceRef,
      }).handleRecentLiveUpdate;
      return null;
    }

    await act(async () => {
      root.render(createElement(Harness));
    });

    expect(handleRecentLiveUpdate).not.toBeNull();
    if (!handleRecentLiveUpdate) {
      throw new Error("recent live update handler missing");
    }

    await act(async () => {
      handleRecentLiveUpdate({
        subscriptionId: "recent-live-subscription",
        filePath: "/tmp/recent-workspace/recent-live-001.jsonl",
        connection: "live",
        snapshot: createLiveUpdateSnapshot("recent-live-001"),
      });
      handleRecentLiveUpdate({
        subscriptionId: "recent-live-subscription",
        filePath: "/tmp/recent-workspace/recent-live-001.jsonl",
        connection: "live",
        snapshot: createLiveUpdateSnapshot("recent-live-001"),
      });
    });

    expect(mockedBuildDatasetFromSessionLogAsync).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondBuild.resolve(secondDataset);
      await secondBuild.promise;
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "apply-recent-live-update",
        filePath: "/tmp/recent-workspace/recent-live-001.jsonl",
        connection: "live",
        dataset: secondDataset,
      });
    });

    await act(async () => {
      firstBuild.resolve(firstDataset);
      await firstBuild.promise;
      await Promise.resolve();
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
