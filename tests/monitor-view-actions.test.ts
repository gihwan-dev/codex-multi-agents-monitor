import { describe, expect, it, vi } from "vitest";
import { createMonitorViewActions } from "../src/pages/monitor/model/createMonitorViewActions.js";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/index.js";

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
      drawerOpen: state.drawerOpen,
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
      drawerOpen: state.drawerOpen,
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
