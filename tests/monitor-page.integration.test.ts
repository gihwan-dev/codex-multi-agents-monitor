// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_FIXTURE_FRAMES } from "../src/entities/run/testing.js";
import {
  loadArchivedSessionIndex,
  loadArchivedSessionSnapshot,
  loadRecentSessionIndex,
  loadRecentSessionSnapshot,
} from "../src/entities/session-log/index.js";
import { applyLiveFrame } from "../src/features/follow-live/index.js";
import { MonitorPage } from "../src/pages/monitor/index.js";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/helpers.js";

vi.mock("../src/entities/session-log/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/entities/session-log/index.js")>();

  return {
    ...actual,
    loadArchivedSessionIndex: vi.fn(),
    loadArchivedSessionSnapshot: vi.fn(),
    loadRecentSessionIndex: vi.fn(),
    loadRecentSessionSnapshot: vi.fn(),
  };
});

const mockedLoadArchivedSessionIndex = vi.mocked(loadArchivedSessionIndex);
const mockedLoadArchivedSessionSnapshot = vi.mocked(loadArchivedSessionSnapshot);
const mockedLoadRecentSessionIndex = vi.mocked(loadRecentSessionIndex);
const mockedLoadRecentSessionSnapshot = vi.mocked(loadRecentSessionSnapshot);

let container: HTMLDivElement;
let root: Root;
let scrollToSpy: ReturnType<typeof vi.fn>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function restorePrototypeProperty(
  key: "clientHeight" | "clientWidth" | "offsetHeight",
  descriptor?: PropertyDescriptor,
) {
  if (descriptor) {
    Object.defineProperty(HTMLElement.prototype, key, descriptor);
    return;
  }

  delete (HTMLElement.prototype as Record<string, unknown>)[key];
}

function installGraphViewportMetrics() {
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight",
  );
  const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      const slot = this.getAttribute?.("data-slot");
      if (slot === "graph" || slot === "graph-scroll") {
        return 480;
      }
      return clientWidthDescriptor?.get?.call(this) ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      const slot = this.getAttribute?.("data-slot");
      if (slot === "graph" || slot === "graph-scroll") {
        return 240;
      }
      return clientHeightDescriptor?.get?.call(this) ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      const slot = this.getAttribute?.("data-slot");
      if (slot === "graph-lane-strip") {
        return 80;
      }
      return offsetHeightDescriptor?.get?.call(this) ?? 0;
    },
  });

  return () => {
    restorePrototypeProperty("clientWidth", clientWidthDescriptor);
    restorePrototypeProperty("clientHeight", clientHeightDescriptor);
    restorePrototypeProperty("offsetHeight", offsetHeightDescriptor);
  };
}

function buildArchivedSessionIndexItem() {
  return {
    sessionId: "session-archive-001",
    workspacePath: "/tmp/archive-workspace",
    originPath: "/tmp/archive-workspace",
    displayName: "Archived workspace",
    startedAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:05:00.000Z",
    model: "gpt-5",
    messageCount: 12,
    filePath: "/tmp/archive-workspace/session-archive-001.json",
    firstUserMessage: "Archive regression coverage",
  };
}

function buildRecentSessionIndexItem(sessionId: string) {
  return {
    sessionId,
    workspacePath: "/tmp/recent-workspace",
    originPath: "/tmp/recent-workspace",
    displayName: "Recent workspace",
    startedAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:05:00.000Z",
    model: "gpt-5",
    filePath: `/tmp/recent-workspace/${sessionId}.jsonl`,
    firstUserMessage: `Open ${sessionId}`,
    title: `Run ${sessionId}`,
    status: "done" as const,
    lastEventSummary: `Last update ${sessionId}`,
  };
}

function buildRecentDataset(sessionId: string) {
  const baseDataset = createMonitorInitialState().datasets[0];
  if (!baseDataset) {
    throw new Error("dataset missing");
  }

  return {
    ...baseDataset,
    project: {
      ...baseDataset.project,
      name: "Recent workspace",
      projectId: "/tmp/recent-workspace",
      repoPath: "/tmp/recent-workspace",
    },
    session: {
      ...baseDataset.session,
      sessionId,
      title: `Session ${sessionId}`,
    },
    run: {
      ...baseDataset.run,
      traceId: sessionId,
      title: `Run ${sessionId}`,
      isArchived: false,
    },
  };
}

function buildLiveRecentDataset(sessionId: string) {
  const baseDataset = createMonitorInitialState().datasets.find(
    (dataset) => dataset.run.traceId === "trace-fix-006",
  );
  if (!baseDataset) {
    throw new Error("live dataset missing");
  }

  return {
    ...baseDataset,
    project: {
      ...baseDataset.project,
      name: "Recent workspace",
      projectId: "/tmp/recent-workspace",
      repoPath: "/tmp/recent-workspace",
    },
    session: {
      ...baseDataset.session,
      sessionId,
      title: `Session ${sessionId}`,
    },
    run: {
      ...baseDataset.run,
      traceId: sessionId,
      title: `Run ${sessionId}`,
      isArchived: false,
      liveMode: "live" as const,
    },
  };
}

function buildArchivedDataset(sessionId: string) {
  const dataset = buildRecentDataset(sessionId);

  return {
    ...dataset,
    project: {
      ...dataset.project,
      name: "Archived workspace",
      projectId: "/tmp/archive-workspace",
      repoPath: "/tmp/archive-workspace",
    },
    session: {
      ...dataset.session,
      title: `Archived ${sessionId}`,
    },
    run: {
      ...dataset.run,
      title: `Archived ${sessionId}`,
      isArchived: true,
    },
  };
}

function dispatchKeydown(key: string) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.__TAURI_INTERNALS__ = {
    invoke: vi.fn(),
  };
  scrollToSpy = vi.fn(function scrollTo(
    this: HTMLElement,
    options?: ScrollToOptions | number,
    y?: number,
  ) {
    const left =
      typeof options === "number"
        ? options
        : options?.left ?? (this as HTMLElement & { scrollLeft: number }).scrollLeft;
    const top =
      typeof options === "number"
        ? y ?? (this as HTMLElement & { scrollTop: number }).scrollTop
        : options?.top ?? (this as HTMLElement & { scrollTop: number }).scrollTop;
    (this as HTMLElement & { scrollLeft: number }).scrollLeft = left;
    (this as HTMLElement & { scrollTop: number }).scrollTop = top;
    void act(() => {
      this.dispatchEvent(new Event("scroll"));
    });
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToSpy,
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  vi.useRealTimers();
  vi.clearAllMocks();
  delete window.__TAURI_INTERNALS__;
  delete (HTMLElement.prototype as { scrollTo?: () => void }).scrollTo;
  vi.unstubAllGlobals();
});

describe("MonitorPage integration", () => {
  it("웹 런타임에서는 fixture 데모를 유지하고 Tauri 로더를 호출하지 않는다", async () => {
    delete window.__TAURI_INTERNALS__;

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    expect(mockedLoadRecentSessionIndex).not.toHaveBeenCalled();
    expect(mockedLoadArchivedSessionIndex).not.toHaveBeenCalled();
    expect(container.querySelector("header h1")?.textContent).toBe(
      "FIX-002 Waiting chain run",
    );
    expect(container.textContent).not.toContain("Preparing recent sessions");
  });

  it("kicks off mount loading and keeps keyboard, drawer, and focus behavior intact", async () => {
    const recentIndexRequest = createDeferred<Array<never>>();
    const archivedIndexRequest = createDeferred<{
      items: Array<ReturnType<typeof buildArchivedSessionIndexItem>>;
      total: number;
      hasMore: boolean;
    }>();

    mockedLoadRecentSessionIndex.mockReturnValue(recentIndexRequest.promise);
    mockedLoadRecentSessionSnapshot.mockResolvedValue(null);
    mockedLoadArchivedSessionIndex.mockReturnValue(archivedIndexRequest.promise);

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    await vi.waitFor(() => {
      expect(mockedLoadRecentSessionIndex).toHaveBeenCalledTimes(1);
      expect(mockedLoadArchivedSessionIndex).toHaveBeenCalledTimes(1);
    });
    expect(container.textContent).toContain("Preparing recent sessions");
    expect(container.textContent).not.toContain("Summary first");
    expect(container.textContent).not.toContain("without blocking the UI");

    await act(async () => {
      recentIndexRequest.resolve([]);
      archivedIndexRequest.resolve({
        items: [buildArchivedSessionIndexItem()],
        total: 1,
        hasMore: false,
      });
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Archive");
    });
    expect(container.textContent).toContain("Select a recent or archived run to inspect.");
    expect(container.textContent).not.toContain("Loading selected run");

    const archiveCount = container.querySelector<HTMLElement>('[data-slot="archive-count"]');
    expect(archiveCount?.textContent).toBe("1");

    const archiveSectionToggle = container.querySelector<HTMLButtonElement>(
      '[data-slot="archive-section-toggle"]',
    );
    expect(archiveSectionToggle).not.toBeNull();
    if (!archiveSectionToggle) {
      throw new Error("archive section toggle missing");
    }

    await act(async () => {
      archiveSectionToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("1 / 1");
    });

    expect(container.textContent).toContain("Archived workspace");

    const searchInput = container.querySelector<HTMLInputElement>('[aria-label="Search workspaces and runs"]');
    expect(searchInput).not.toBeNull();
    if (!searchInput) {
      throw new Error("monitor search input missing");
    }

    await act(async () => {
      dispatchKeydown("/");
    });

    expect(document.activeElement).toBe(searchInput);

    searchInput.blur();

    await act(async () => {
      dispatchKeydown("?");
    });

    expect(document.body.textContent).toContain("Shortcut help");

    await act(async () => {
      dispatchKeydown("?");
    });

    expect(document.body.textContent).not.toContain("Shortcut help");

    const helpButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Help",
    );
    expect(helpButton).not.toBeNull();
    if (!helpButton) {
      throw new Error("help button missing");
    }

    helpButton.focus();

    await act(async () => {
      helpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const closeHelpButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.textContent?.trim() === "Close",
    );
    const closeHelpButton = closeHelpButtons.at(-1) ?? null;
    expect(closeHelpButton).not.toBeNull();
    if (!closeHelpButton) {
      throw new Error("close help button missing");
    }

    await act(async () => {
      closeHelpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(document.body.textContent).not.toContain("Shortcut help");
    });

    const importButton =
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Import",
      ) ?? null;
    expect(importButton).not.toBeNull();
    if (!importButton) {
      throw new Error("import button missing");
    }

    importButton.focus();

    await act(async () => {
      importButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const closeDrawerButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close drawer"]',
    );
    expect(closeDrawerButton).not.toBeNull();
    if (!closeDrawerButton) {
      throw new Error("close drawer button missing");
    }

    await act(async () => {
      closeDrawerButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.activeElement).toBe(importButton);
  });

  it("로딩 중 다른 recent session으로 바꾸면 선택 표시와 최종 결과가 새 선택 기준으로 유지된다", async () => {
    const archivedIndexRequest = createDeferred<{
      items: Array<ReturnType<typeof buildArchivedSessionIndexItem>>;
      total: number;
      hasMore: boolean;
    }>();
    const firstSnapshot = createDeferred<ReturnType<typeof buildRecentDataset> | null>();
    const secondSnapshot = createDeferred<ReturnType<typeof buildRecentDataset> | null>();
    const firstItem = buildRecentSessionIndexItem("recent-001");
    const secondItem = buildRecentSessionIndexItem("recent-002");

    mockedLoadRecentSessionIndex.mockResolvedValue([firstItem, secondItem]);
    mockedLoadArchivedSessionIndex.mockReturnValue(archivedIndexRequest.promise);
    mockedLoadRecentSessionSnapshot
      .mockImplementationOnce(() => firstSnapshot.promise)
      .mockImplementationOnce(() => secondSnapshot.promise);

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    await vi.waitFor(() => {
      expect(mockedLoadRecentSessionSnapshot).toHaveBeenCalledWith(firstItem.filePath);
    });

    const secondRecentButton = () =>
      container.querySelector<HTMLButtonElement>('[data-run-id="recent-002"]');

    await vi.waitFor(() => {
      expect(secondRecentButton()).not.toBeNull();
    });

    await act(async () => {
      secondRecentButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockedLoadRecentSessionSnapshot).toHaveBeenNthCalledWith(2, secondItem.filePath);
    expect(secondRecentButton()?.getAttribute("data-active")).toBe("true");
    expect(container.textContent).toContain("Preparing run details");
    expect(container.textContent).toContain("Recent session");
    expect(container.textContent).toContain("Run recent-002");
    expect(container.textContent).toContain("Recent workspace");

    await act(async () => {
      secondSnapshot.resolve(buildRecentDataset("recent-002"));
      firstSnapshot.resolve(buildRecentDataset("recent-001"));
      archivedIndexRequest.resolve({
        items: [],
        total: 0,
        hasMore: false,
      });
    });

    await vi.waitFor(() => {
      expect(container.querySelector("header h1")?.textContent).toBe("Run recent-002");
    });
    expect(
      container.querySelector('[data-run-id="recent-001"]')?.getAttribute("data-active"),
    ).toBe("false");
  });

  it("hydrated session에서 다른 session으로 전환해도 상단 chrome 레이아웃이 빈 상태로 되돌아가지 않는다", async () => {
    const firstSnapshot = createDeferred<ReturnType<typeof buildRecentDataset> | null>();
    const secondSnapshot = createDeferred<ReturnType<typeof buildRecentDataset> | null>();
    const firstItem = buildRecentSessionIndexItem("recent-001");
    const secondItem = buildRecentSessionIndexItem("recent-002");

    mockedLoadRecentSessionIndex.mockResolvedValue([firstItem, secondItem]);
    mockedLoadArchivedSessionIndex.mockResolvedValue({
      items: [],
      total: 0,
      hasMore: false,
    });
    mockedLoadRecentSessionSnapshot
      .mockImplementationOnce(() => firstSnapshot.promise)
      .mockImplementationOnce(() => secondSnapshot.promise);

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    await vi.waitFor(() => {
      expect(mockedLoadRecentSessionSnapshot).toHaveBeenCalledWith(firstItem.filePath);
    });

    await act(async () => {
      firstSnapshot.resolve(buildRecentDataset("recent-001"));
    });

    await vi.waitFor(() => {
      expect(container.querySelector("header h1")?.textContent).toBe("Run recent-001");
    });

    const secondRecentButton = container.querySelector<HTMLButtonElement>(
      '[data-run-id="recent-002"]',
    );
    expect(secondRecentButton).not.toBeNull();
    if (!secondRecentButton) {
      throw new Error("second recent button missing");
    }

    await act(async () => {
      secondRecentButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("header h1")?.textContent).toBe("Run recent-001");
    expect(container.textContent).toContain("Preparing run details");
    expect(container.textContent).not.toContain("Ready to inspect");
    expect(
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Export",
      )?.disabled,
    ).toBe(true);

    await act(async () => {
      secondSnapshot.resolve(buildRecentDataset("recent-002"));
    });

    await vi.waitFor(() => {
      expect(container.querySelector("header h1")?.textContent).toBe("Run recent-002");
    });
  });

  it("archive session으로 전환할 때도 상단 chrome을 유지하고 로딩 카드에 대상을 보여준다", async () => {
    const archiveSnapshot = createDeferred<ReturnType<typeof buildArchivedDataset> | null>();
    const recentItem = buildRecentSessionIndexItem("recent-001");

    mockedLoadRecentSessionIndex.mockResolvedValue([recentItem]);
    mockedLoadRecentSessionSnapshot.mockResolvedValue(buildRecentDataset("recent-001"));
    mockedLoadArchivedSessionIndex.mockResolvedValue({
      items: [buildArchivedSessionIndexItem()],
      total: 1,
      hasMore: false,
    });
    mockedLoadArchivedSessionSnapshot.mockImplementationOnce(() => archiveSnapshot.promise);

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    await vi.waitFor(() => {
      expect(container.querySelector("header h1")?.textContent).toBe("Run recent-001");
    });

    const archiveSectionToggle = container.querySelector<HTMLButtonElement>(
      '[data-slot="archive-section-toggle"]',
    );
    expect(archiveSectionToggle).not.toBeNull();
    if (!archiveSectionToggle) {
      throw new Error("archive section toggle missing");
    }

    await act(async () => {
      archiveSectionToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const archiveWorkspaceToggle = container.querySelector<HTMLButtonElement>(
      '[data-slot="archive-workspace-toggle"]',
    );
    expect(archiveWorkspaceToggle).not.toBeNull();
    if (!archiveWorkspaceToggle) {
      throw new Error("archive workspace toggle missing");
    }

    await act(async () => {
      archiveWorkspaceToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const archiveSessionButton = container.querySelector<HTMLButtonElement>(
      '[data-slot="archive-session-item"]',
    );
    expect(archiveSessionButton).not.toBeNull();
    if (!archiveSessionButton) {
      throw new Error("archive session button missing");
    }

    await act(async () => {
      archiveSessionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("header h1")?.textContent).toBe("Run recent-001");
    expect(container.textContent).toContain("Archived session");
    expect(container.textContent).toContain("Archive regression coverage");
    expect(container.textContent).toContain("Archived workspace");

    await act(async () => {
      archiveSnapshot.resolve(buildArchivedDataset("session-archive-001"));
    });

    await vi.waitFor(() => {
      expect(container.querySelector("header h1")?.textContent).toBe(
        "Archived session-archive-001",
      );
    });
  });

  it("live frame append 시 최신 이벤트를 따라가고 manual scroll-away 시 paused/resume 상태를 반영한다", async () => {
    vi.useFakeTimers();
    delete window.__TAURI_INTERNALS__;
    const restoreViewportMetrics = installGraphViewportMetrics();

    try {
      await act(async () => {
        root.render(createElement(MonitorPage));
      });

      const liveRunButton = container.querySelector<HTMLButtonElement>(
        '[data-run-id="trace-fix-006"]',
      );
      const initialLatestEventId =
        createMonitorInitialState().datasets.find(
          (dataset) => dataset.run.traceId === "trace-fix-006",
        )?.events.at(-1)?.eventId ?? null;
      expect(liveRunButton).not.toBeNull();
      if (!liveRunButton) {
        throw new Error("live run button missing");
      }

      await act(async () => {
        liveRunButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await vi.waitFor(() => {
        expect(container.querySelector("header h1")?.textContent).toBe(
          "FIX-006 Disconnected live watch run",
        );
      });
      const graphScroll = container.querySelector<HTMLElement>('[data-slot="graph-scroll"]');
      expect(graphScroll).not.toBeNull();
      if (!graphScroll) {
        throw new Error("graph scroll container missing");
      }
      await vi.waitFor(() => {
        expect((graphScroll as HTMLElement & { scrollTop: number }).scrollTop).toBeGreaterThan(0);
      });
      if (!initialLatestEventId) {
        throw new Error("initial latest fixture event missing");
      }
      expect(
        container
          .querySelector<HTMLElement>(
            `[data-slot="graph-event-card"][data-event-id="${initialLatestEventId}"]`,
          )
          ?.getAttribute("data-selected"),
      ).toBe("true");
      expect(container.textContent).toContain("Live watch");
      expect(container.textContent).toContain("Follow live");

      const initialScrollCallCount = scrollToSpy.mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });

      await vi.waitFor(() => {
        const followUpCard = container.querySelector<HTMLElement>(
          '[data-slot="graph-event-card"][data-event-id="fix6-follow-up"]',
        );
        expect(followUpCard?.getAttribute("data-selected")).toBe("true");
      });

      expect(scrollToSpy.mock.calls.length).toBeGreaterThan(initialScrollCallCount);
      const latestScrollCall = scrollToSpy.mock.calls.at(-1)?.[0];
      expect(latestScrollCall).toMatchObject({
        behavior: "auto",
      });
      if (
        !latestScrollCall ||
        typeof latestScrollCall !== "object" ||
        latestScrollCall === null
      ) {
        throw new Error("follow-live scroll call missing");
      }
      const latestScrollOptions = latestScrollCall as ScrollToOptions;
      expect(latestScrollOptions.top ?? 0).toBeGreaterThan(0);
      expect(latestScrollOptions.left ?? 0).toBeGreaterThan(0);
      expect(container.textContent).not.toContain("Following paused");

      const currentScrollTop = (graphScroll as HTMLElement & { scrollTop: number }).scrollTop;
      await act(async () => {
        (graphScroll as HTMLElement & { scrollTop: number; scrollLeft: number }).scrollLeft = 0;
        (graphScroll as HTMLElement & { scrollTop: number; scrollLeft: number }).scrollTop =
          currentScrollTop;
        graphScroll.dispatchEvent(new Event("scroll"));
      });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Following paused");
        expect(container.textContent).toContain("Resume follow");
      });

      const scrollCountWhilePaused = scrollToSpy.mock.calls.length;
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
      await vi.waitFor(() => {
        expect(container.textContent).toContain("stale");
        expect(container.textContent).toContain("Resume follow");
      });
      expect(scrollToSpy.mock.calls.length).toBe(scrollCountWhilePaused);

      const resumeButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Resume follow",
      );
      expect(resumeButton).not.toBeNull();
      if (!resumeButton) {
        throw new Error("resume button missing");
      }

      await act(async () => {
        resumeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await vi.waitFor(() => {
        expect(scrollToSpy.mock.calls.length).toBeGreaterThan(scrollCountWhilePaused);
      });
    } finally {
      restoreViewportMetrics();
    }
  });

  it("recent running session은 follow-live를 활성화하고 폴링된 최신 이벤트를 선택한다", async () => {
    const recentItem = {
      ...buildRecentSessionIndexItem("recent-live-001"),
      status: "running" as const,
    };
    const initialDataset = buildLiveRecentDataset("recent-live-001");
    const refreshedDataset = applyLiveFrame(
      initialDataset,
      LIVE_FIXTURE_FRAMES[0],
    ).dataset;

    mockedLoadRecentSessionIndex.mockResolvedValue([recentItem]);
    mockedLoadArchivedSessionIndex.mockResolvedValue({
      items: [],
      total: 0,
      hasMore: false,
    });
    mockedLoadRecentSessionSnapshot
      .mockResolvedValueOnce(initialDataset)
      .mockResolvedValueOnce(refreshedDataset)
      .mockResolvedValue(refreshedDataset);

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    await vi.waitFor(() => {
      expect(container.querySelector("header h1")?.textContent).toBe("Run recent-live-001");
    });
    await vi.waitFor(() => {
      expect(mockedLoadRecentSessionSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    const followButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Follow live",
    );
    expect(followButton).not.toBeNull();
    expect(followButton?.disabled).toBe(false);
    expect(container.textContent).toContain("Live watch");
    expect(container.textContent).not.toContain("Resume follow");

    await vi.waitFor(() => {
      expect(
        container
          .querySelector<HTMLElement>(
            '[data-slot="graph-event-card"][data-event-id="fix6-follow-up"]',
          )
          ?.getAttribute("data-selected"),
      ).toBe("true");
    });
  });
});
