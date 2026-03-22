// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGraphSceneModel, FIXTURE_DATASETS } from "../src/entities/run/index.js";
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

function requireDataset(traceId: string) {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    throw new Error(`fixture dataset missing: ${traceId}`);
  }
  return dataset;
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

  vi.clearAllMocks();
});

describe("CausalGraphView selection reveal", () => {
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
