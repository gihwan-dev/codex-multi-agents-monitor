// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createMonitorInitialState,
  deriveMonitorViewState,
  dispatchMonitorKeyboardShortcut,
} from "./helpers/monitorTestApi.js";

function expectDefined<T>(value: T | null | undefined, message: string): T {
  expect(value).toBeDefined();
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function buildShortcutContext(traceId?: string) {
  const initialState = createMonitorInitialState();
  const nextState = traceId
    ? {
        ...initialState,
        activeRunId: traceId,
      }
    : initialState;
  const derivedState = deriveMonitorViewState(nextState);

  return {
    activeDataset: derivedState.activeDataset,
    graphRows: derivedState.graphScene.rows,
  };
}

function requireLiveTraceId() {
  const state = createMonitorInitialState();
  const liveDataset = expectDefined(
    state.datasets.find((dataset) => dataset.run.liveMode === "live"),
    "live dataset missing",
  );
  return liveDataset.run.traceId;
}

function createShortcutEvent(
  key: string,
  options?: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    target?: EventTarget | null;
  },
) {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: options?.ctrlKey,
    metaKey: options?.metaKey,
    cancelable: true,
  });

  if (options && "target" in options) {
    Object.defineProperty(event, "target", {
      configurable: true,
      value: options.target,
    });
  }

  return event;
}

describe("monitor 키보드 단축키", () => {
  it("편집 가능한 대상에서는 단축키를 무시한다", () => {
    const context = buildShortcutContext();
    const dispatch = vi.fn();
    const event = createShortcutEvent("i", {
      target: document.createElement("input"),
    });

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: null,
      },
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("Ctrl+K 입력 시 단축키 도움말 토글 action을 보낸다", () => {
    const context = buildShortcutContext();
    const dispatch = vi.fn();
    const event = createShortcutEvent("k", { ctrlKey: true });

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: null,
      },
    });

    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-shortcuts" });
    expect(event.defaultPrevented).toBe(true);
  });

  it("마침표 입력 시 live run의 follow-live 토글 action을 보낸다", () => {
    const context = buildShortcutContext(requireLiveTraceId());
    const dispatch = vi.fn();
    const event = createShortcutEvent(".");

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: null,
      },
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "toggle-follow-live",
      traceId: context.activeDataset.run.traceId,
    });
  });

  it("E 입력은 더 이상 별도 action을 만들지 않는다", () => {
    const context = buildShortcutContext();
    const dispatch = vi.fn();
    const event = createShortcutEvent("e");

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: null,
      },
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("? 입력 시 단축키 도움말 토글 action을 보낸다", () => {
    const context = buildShortcutContext();
    const dispatch = vi.fn();
    const event = createShortcutEvent("?");

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: null,
      },
    });

    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-shortcuts" });
  });

  it("C 입력 시 context drawer를 연다", () => {
    const context = buildShortcutContext();
    const dispatch = vi.fn();
    const event = createShortcutEvent("c");

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: null,
      },
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-drawer-tab",
      tab: "context",
      open: true,
    });
  });

  it("ArrowDown 입력 시 다음 보이는 이벤트를 선택한다", () => {
    const context = buildShortcutContext();
    const dispatch = vi.fn();
    const visibleEventRows = context.graphRows.filter((row) => row.kind === "event");
    const currentEvent = expectDefined(visibleEventRows[0], "current event missing");
    const nextEvent = expectDefined(visibleEventRows[1], "next event missing");
    const event = createShortcutEvent("ArrowDown");

    dispatchMonitorKeyboardShortcut({
      event,
      context: {
        ...context,
        dispatch,
        selection: { kind: "event", id: currentEvent.eventId },
      },
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "navigate-selection",
      selection: { kind: "event", id: nextEvent.eventId },
    });
    expect(event.defaultPrevented).toBe(true);
  });
});
