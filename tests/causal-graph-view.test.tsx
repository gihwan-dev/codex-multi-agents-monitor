// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGraphSceneModel, FIXTURE_DATASETS } from "../src/entities/run/index.js";
import {
  buildDatasetFromSessionLog,
  type SessionEntrySnapshot,
  type SessionLogSnapshot,
} from "../src/entities/session-log/index.js";
import { CausalGraphView } from "../src/widgets/causal-graph/index.js";

const CLIENT_HEIGHT = 220;
const LANE_HEADER_HEIGHT = 80;

let container: HTMLDivElement;
let root: Root;
let scrollToMock: ReturnType<typeof vi.fn>;
let originalClientHeight: PropertyDescriptor | undefined;
let originalClientWidth: PropertyDescriptor | undefined;
let originalOffsetHeight: PropertyDescriptor | undefined;
let originalScrollTo: PropertyDescriptor | undefined;
let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame | undefined;

function requireDataset(traceId: string) {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    throw new Error(`fixture dataset missing: ${traceId}`);
  }
  return dataset;
}

function makeMessageEntry(
  timestamp: string,
  role: "user" | "assistant",
  text: string,
): SessionEntrySnapshot {
  return {
    timestamp,
    entryType: "message",
    role,
    text,
    functionName: null,
    functionCallId: null,
    functionArgumentsPreview: null,
  };
}

function makeTokenCountEntry(
  timestamp: string,
  payload: string,
): SessionEntrySnapshot {
  return {
    timestamp,
    entryType: "token_count",
    role: null,
    text: payload,
    functionName: null,
    functionCallId: null,
    functionArgumentsPreview: null,
  };
}

function buildMeasuredViewportDataset() {
  const base = Date.parse("2026-03-22T09:00:00.000Z");
  const entries: SessionEntrySnapshot[] = [];

  for (let index = 0; index < 12; index += 1) {
    const userTs = new Date(base + index * 6_000).toISOString();
    const assistantTs = new Date(base + index * 6_000 + 2_000).toISOString();
    const tokenTs = new Date(base + index * 6_000 + 2_100).toISOString();
    const lastIn = 900 + index * 80;
    const lastOut = 150 + index * 20;
    const totalIn = 1_200 + index * 1_100;
    const totalOut = 220 + index * 180;
    const totalTotal = totalIn + totalOut;

    entries.push(makeMessageEntry(userTs, "user", `Prompt ${index + 1}`));
    entries.push(
      makeMessageEntry(
        assistantTs,
        "assistant",
        `Assistant response ${index + 1}`,
      ),
    );
    entries.push(
      makeTokenCountEntry(
        tokenTs,
        JSON.stringify({
          last: {
            in: lastIn,
            cached: 0,
            out: lastOut,
            reasoning: 0,
            total: lastIn + lastOut,
          },
          total: {
            in: totalIn,
            cached: 0,
            out: totalOut,
            reasoning: 0,
            total: totalTotal,
          },
        }),
      ),
    );
  }

  const snapshot: SessionLogSnapshot = {
    sessionId: "graph-context-runtime-usage",
    workspacePath: "/projects/runtime-usage",
    originPath: "/projects/runtime-usage",
    displayName: "runtime-usage",
    startedAt: new Date(base).toISOString(),
    updatedAt: new Date(base + 12 * 6_000 + 5_000).toISOString(),
    model: "gpt-5.4",
    maxContextWindowTokens: null,
    entries,
    subagents: [],
  };

  const dataset = buildDatasetFromSessionLog(snapshot);
  if (!dataset) {
    throw new Error("expected measured viewport dataset");
  }
  return dataset;
}

function parseCompactTokenLabel(label: string | null | undefined) {
  if (!label) {
    return 0;
  }

  const normalized = label.trim().toLowerCase();
  if (normalized === "n/a" || normalized === "steady" || normalized === "reset") {
    return 0;
  }

  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)([km])?$/);
  if (!match) {
    return Number.NaN;
  }

  const value = Number(match[1]);
  const suffix = match[2];
  if (suffix === "m") {
    return value * 1_000_000;
  }
  if (suffix === "k") {
    return value * 1_000;
  }
  return value;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  scrollToMock = vi.fn(function updateScrollTop(
    this: HTMLElement,
    options?: ScrollToOptions | number,
    top?: number,
  ) {
    const nextTop =
      typeof options === "number" ? top ?? 0 : options?.top ?? 0;
    Object.defineProperty(this, "scrollTop", {
      configurable: true,
      writable: true,
      value: nextTop,
    });
  });

  originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return CLIENT_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 1280;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.getAttribute("data-slot") === "graph-lane-strip" ? LANE_HEADER_HEIGHT : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock,
  });
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = vi.fn();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  restoreDescriptor("clientHeight", originalClientHeight);
  restoreDescriptor("clientWidth", originalClientWidth);
  restoreDescriptor("offsetHeight", originalOffsetHeight);
  restoreDescriptor("scrollTo", originalScrollTo);
  globalThis.requestAnimationFrame = originalRequestAnimationFrame as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame =
    originalCancelAnimationFrame as typeof globalThis.cancelAnimationFrame;

  vi.clearAllMocks();
});

describe("CausalGraphView edge rendering", () => {
  it("renders edge route elements with paths and ports for multi-agent scenes", async () => {
    const dataset = requireDataset("trace-fix-002");
    const scene = buildGraphSceneModel(dataset, null);

    expect(scene.edgeBundles.length).toBeGreaterThan(0);

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 0,
          selectionNavigationRunId: null,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: null,
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    const routeElements = container.querySelectorAll('[data-slot="graph-route"]');
    expect(routeElements.length).toBeGreaterThan(0);

    const portElements = container.querySelectorAll('[data-slot="graph-route-port"]');
    expect(portElements.length).toBeGreaterThanOrEqual(routeElements.length * 2);

    for (const route of routeElements) {
      const path = route.querySelector("path");
      expect(path).not.toBeNull();
      expect(path?.getAttribute("d")).toBeTruthy();
    }
  });

  it("renders interactive hit-target layer alongside visual edges", async () => {
    const dataset = requireDataset("trace-fix-002");
    const scene = buildGraphSceneModel(dataset, null);

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 0,
          selectionNavigationRunId: null,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: null,
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    const hitboxes = container.querySelectorAll('[data-slot="graph-route-hitbox"]');
    expect(hitboxes.length).toBeGreaterThan(0);

    const routeElements = container.querySelectorAll('[data-slot="graph-route"]');
    expect(hitboxes.length).toBe(routeElements.length);
  });
});

describe("CausalGraphView selection reveal", () => {
  it("reports the viewport-focused event and updates it after scrolling", async () => {
    const dataset = requireDataset("trace-fix-002");
    const scene = buildGraphSceneModel(dataset, null);
    const onViewportFocusEventChange = vi.fn();
    const firstVisibleEventId = scene.rows.find((row) => row.kind === "event")?.eventId ?? null;

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          onViewportFocusEventChange,
          selectionNavigationRequestId: 0,
          selectionNavigationRunId: null,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: null,
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(onViewportFocusEventChange).toHaveBeenCalledWith(firstVisibleEventId);

    const scrollElement = container.querySelector('[data-slot="graph-scroll"]');
    expect(scrollElement).not.toBeNull();
    if (!scrollElement) {
      throw new Error("graph scroll area missing");
    }

    Object.defineProperty(scrollElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 1200,
    });

    await act(async () => {
      scrollElement.dispatchEvent(new Event("scroll"));
    });

    expect(onViewportFocusEventChange).toHaveBeenLastCalledWith(
      expect.any(String),
    );
    expect(onViewportFocusEventChange.mock.calls.at(-1)?.[0]).not.toBe(
      firstVisibleEventId,
    );
  });

  it("hides the in-graph context card when no measured runtime usage exists", async () => {
    const dataset = requireDataset("trace-fix-002");
    const scene = buildGraphSceneModel(dataset, null);

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 0,
          selectionNavigationRunId: null,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: null,
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(container.querySelector('[data-slot="graph-context-card-overlay"]')).toBeNull();
  });

  it("renders a measured-only cumulative context card without progress or delta copy", async () => {
    const dataset = buildMeasuredViewportDataset();
    const scene = buildGraphSceneModel(dataset, null);

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 0,
          selectionNavigationRunId: null,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: null,
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    const scrollElement = container.querySelector('[data-slot="graph-scroll"]');
    expect(scrollElement).not.toBeNull();
    if (!scrollElement) {
      throw new Error("graph scroll area missing");
    }

    Object.defineProperty(scrollElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 420,
    });

    await act(async () => {
      scrollElement.dispatchEvent(new Event("scroll"));
    });

    const overlay = container.querySelector('[data-slot="graph-context-card-overlay"]');
    expect(overlay).not.toBeNull();
    expect(container.querySelector('[data-slot="graph-context-card"]')).not.toBeNull();
    expect(
      container.querySelector('[data-slot="graph-context-card-value"]')?.textContent,
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="graph-context-card-cause"]')?.textContent,
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="graph-context-card-cumulative"]')?.textContent,
    ).toBeTruthy();
    expect(container.querySelector('[data-slot="graph-context-card-progress-fill"]')).toBeNull();
    expect(container.querySelector('[data-slot="graph-context-card-progress-label"]')).toBeNull();
    expect(container.querySelector('[data-slot="graph-context-card-limit"]')).toBeNull();
    expect(container.querySelector('[data-slot="graph-context-card-change"]')).toBeNull();
    expect(container.textContent).not.toContain("limit unavailable");
  });

  it("does not increase the displayed cumulative usage when scrolling back to an earlier viewport event", async () => {
    const dataset = buildMeasuredViewportDataset();
    const scene = buildGraphSceneModel(dataset, null);

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 0,
          selectionNavigationRunId: null,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: null,
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    const scrollElement = container.querySelector('[data-slot="graph-scroll"]');
    expect(scrollElement).not.toBeNull();
    if (!scrollElement) {
      throw new Error("graph scroll area missing");
    }

    Object.defineProperty(scrollElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 1400,
    });

    await act(async () => {
      scrollElement.dispatchEvent(new Event("scroll"));
    });

    const laterCumulativeLabel =
      container.querySelector('[data-slot="graph-context-card-cumulative"]')?.textContent;
    const laterCumulativeValue = parseCompactTokenLabel(laterCumulativeLabel);

    Object.defineProperty(scrollElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });

    await act(async () => {
      scrollElement.dispatchEvent(new Event("scroll"));
    });

    const earlierCumulativeLabel =
      container.querySelector('[data-slot="graph-context-card-cumulative"]')?.textContent;
    const earlierCumulativeValue = parseCompactTokenLabel(earlierCumulativeLabel);

    expect(earlierCumulativeValue).not.toBeNaN();
    expect(laterCumulativeValue).not.toBeNaN();
    expect(earlierCumulativeValue).toBeLessThanOrEqual(laterCumulativeValue);
  });

  it("scrolls when a navigation request targets an offscreen event", async () => {
    const dataset = requireDataset("trace-fix-002");
    const targetEventId = dataset.events[dataset.events.length - 1]?.eventId;
    if (!targetEventId) {
      throw new Error("target event missing");
    }
    const scene = buildGraphSceneModel(dataset, { kind: "event", id: targetEventId });

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 1,
          selectionNavigationRunId: dataset.run.traceId,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: { kind: "event", eventId: targetEventId },
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(scrollToMock).toHaveBeenCalledTimes(1);
    expect(scrollToMock.mock.calls[0]?.[0]).toMatchObject({
      behavior: "smooth",
    });
    expect((scrollToMock.mock.calls[0]?.[0] as ScrollToOptions).top ?? 0).toBeGreaterThan(0);
  });

  it("does not scroll when a navigation request targets an already visible event", async () => {
    const dataset = requireDataset("trace-fix-002");
    const firstEventId = dataset.events[0]?.eventId;
    if (!firstEventId) {
      throw new Error("first event missing");
    }
    const scene = buildGraphSceneModel(dataset, { kind: "event", id: firstEventId });

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 1,
          selectionNavigationRunId: dataset.run.traceId,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: { kind: "event", eventId: firstEventId },
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("scrolls when a navigation request targets an offscreen edge", async () => {
    const dataset = requireDataset("trace-fix-002");
    const edge = dataset.edges.find((item) => item.edgeType === "handoff");
    if (!edge) {
      throw new Error("handoff edge missing");
    }
    const scene = buildGraphSceneModel(dataset, { kind: "edge", id: edge.edgeId });

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 1,
          selectionNavigationRunId: dataset.run.traceId,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: {
            kind: "edge",
            edgeId: edge.edgeId,
            sourceEventId: edge.sourceEventId,
            targetEventId: edge.targetEventId,
          },
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(scrollToMock).toHaveBeenCalledTimes(1);
  });

  it("scrolls when a navigation request targets an offscreen artifact", async () => {
    const dataset = requireDataset("trace-fix-001");
    const artifact = dataset.artifacts.find(
      (item) => item.artifactId === dataset.run.finalArtifactId,
    );
    if (!artifact) {
      throw new Error("final artifact missing");
    }
    const scene = buildGraphSceneModel(dataset, {
      kind: "artifact",
      id: artifact.artifactId,
    });

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 1,
          selectionNavigationRunId: dataset.run.traceId,
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: {
            kind: "artifact",
            artifactId: artifact.artifactId,
            producerEventId: artifact.producerEventId,
          },
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(scrollToMock).toHaveBeenCalledTimes(1);
  });

  it("ignores stale navigation requests from a different run after remount", async () => {
    const dataset = requireDataset("trace-fix-002");
    const targetEventId = dataset.events[dataset.events.length - 1]?.eventId;
    if (!targetEventId) {
      throw new Error("target event missing");
    }
    const scene = buildGraphSceneModel(dataset, { kind: "event", id: targetEventId });

    await act(async () => {
      root.render(
        createElement(CausalGraphView, {
          scene,
          onSelect: () => undefined,
          selectionNavigationRequestId: 5,
          selectionNavigationRunId: "trace-fix-001",
          runTraceId: dataset.run.traceId,
          selectionRevealTarget: { kind: "event", eventId: targetEventId },
          followLive: false,
          liveMode: dataset.run.liveMode,
          onPauseFollowLive: () => undefined,
          viewportHeightOverride: CLIENT_HEIGHT,
          laneHeaderHeightOverride: LANE_HEADER_HEIGHT,
        }),
      );
    });

    expect(scrollToMock).not.toHaveBeenCalled();
  });
});

function restoreDescriptor(
  key: "clientHeight" | "clientWidth" | "offsetHeight" | "scrollTo",
  descriptor?: PropertyDescriptor,
) {
  if (descriptor) {
    Object.defineProperty(HTMLElement.prototype, key, descriptor);
    return;
  }

  delete (HTMLElement.prototype as Partial<HTMLElement>)[key];
}
