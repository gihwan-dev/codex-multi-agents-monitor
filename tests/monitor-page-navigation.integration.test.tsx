// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitorPage } from "../src/pages/monitor/index.js";
import {
  createMonitorInitialState,
  deriveMonitorViewState,
} from "./helpers/monitorTestApi.js";

const CLIENT_HEIGHT = 220;
const LANE_HEADER_HEIGHT = 80;

let container: HTMLDivElement;
let root: Root;
let scrollToMock: ReturnType<typeof vi.fn>;
let originalClientHeight: PropertyDescriptor | undefined;
let originalClientWidth: PropertyDescriptor | undefined;
let originalOffsetHeight: PropertyDescriptor | undefined;
let originalScrollTo: PropertyDescriptor | undefined;

function findButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === text,
  ) ?? null;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  delete window.__TAURI_INTERNALS__;

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
  delete window.__TAURI_INTERNALS__;

  restoreDescriptor("clientHeight", originalClientHeight);
  restoreDescriptor("clientWidth", originalClientWidth);
  restoreDescriptor("offsetHeight", originalOffsetHeight);
  restoreDescriptor("scrollTo", originalScrollTo);

  vi.clearAllMocks();
});

describe("MonitorPage anomaly jump navigation", () => {
  it("clicking an anomaly jump updates selection and requests graph scrolling", async () => {
    const initialState = createMonitorInitialState();
    const derivedState = deriveMonitorViewState(initialState);
    const defaultSelectedId =
      initialState.selection?.kind === "event" ? initialState.selection.id : null;
    const targetJump = derivedState.anomalyJumps.find(
      (jump) => jump.selection.kind === "event" && jump.selection.id !== defaultSelectedId,
    );

    expect(targetJump).toBeDefined();
    if (!targetJump || targetJump.selection.kind !== "event") {
      throw new Error("event jump target missing");
    }

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    scrollToMock.mockClear();

    const jumpButton = findButtonByText(container, targetJump.label);
    expect(jumpButton).not.toBeNull();
    if (!jumpButton) {
      throw new Error("jump button missing");
    }

    await act(async () => {
      jumpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledTimes(1);
    });
    expect(scrollToMock.mock.calls[0]?.[0]).toMatchObject({
      behavior: "smooth",
    });

    await vi.waitFor(() => {
      const selectedCard = container.querySelector<HTMLElement>(
        '[data-slot="graph-event-card"][data-selected="true"]',
      );
      expect(selectedCard?.getAttribute("data-event-id")).toBe(targetJump.selection.id);
    });
  });

  it("clicking the last handoff jump requests graph scrolling for edge navigation", async () => {
    const initialState = createMonitorInitialState();
    const derivedState = deriveMonitorViewState(initialState);
    const targetJump = derivedState.anomalyJumps.find(
      (jump) => jump.selection.kind === "edge" && jump.label === "Last handoff",
    );

    expect(targetJump).toBeDefined();
    if (!targetJump) {
      throw new Error("last handoff jump missing");
    }

    await act(async () => {
      root.render(createElement(MonitorPage));
    });

    scrollToMock.mockClear();

    const jumpButton = findButtonByText(container, targetJump.label);
    expect(jumpButton).not.toBeNull();
    if (!jumpButton) {
      throw new Error("edge jump button missing");
    }

    await act(async () => {
      jumpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledTimes(1);
    });
    expect(scrollToMock.mock.calls[0]?.[0]).toMatchObject({
      behavior: "smooth",
    });
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
