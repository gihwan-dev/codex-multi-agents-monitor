import { describe, expect, it, vi } from "vitest";
import {
  createMonitorInitialState,
  createMonitorViewActions,
} from "./helpers/monitorTestApi.js";

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

  it("manual navigation dispatches a navigate-selection action", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      drawerOpen: state.drawerOpen,
      dispatch,
      activeDataset,
      activeFollowLive: true,
    });
    const targetEventId = expectDefined(activeDataset.events[0]?.eventId, "target event missing");

    actions.navigateToItem({ kind: "event", id: targetEventId });

    expect(dispatch).toHaveBeenCalledWith({
      type: "navigate-selection",
      selection: { kind: "event", id: targetEventId },
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
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

  it("활성 live run을 pause하면 follow-live를 끈다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      drawerOpen: state.drawerOpen,
      dispatch,
      activeDataset,
      activeFollowLive: true,
    });

    actions.pauseFollowLive();

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-follow-live",
      traceId: activeDataset.run.traceId,
      value: false,
    });
  });

  it("이미 멈춘 run을 pause하면 추가 action을 보내지 않는다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      drawerOpen: state.drawerOpen,
      dispatch,
      activeDataset,
      activeFollowLive: false,
    });

    actions.pauseFollowLive();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("drawer tab 변경 시 기본 open 값으로 현재 drawer 상태를 사용한다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      drawerOpen: state.drawerOpen,
      dispatch,
      activeDataset,
      activeFollowLive: false,
    });

    actions.setDrawerTab("raw");

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-drawer-tab",
      tab: "raw",
      open: state.drawerOpen,
    });
  });

  it("rail resize는 최소 폭보다 작게 줄어들지 않는다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      drawerOpen: state.drawerOpen,
      dispatch,
      activeDataset,
      activeFollowLive: false,
    });

    actions.resizeRail(100);

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-rail-width",
      width: 220,
    });
  });

  it("inspector resize는 handle만 남길 정도까지 줄어들 수 있다", () => {
    const state = createMonitorInitialState();
    const activeDataset = requireLiveDataset();
    const dispatch = vi.fn();
    const actions = createMonitorViewActions({
      drawerOpen: state.drawerOpen,
      dispatch,
      activeDataset,
      activeFollowLive: false,
    });

    actions.resizeInspector(-20);

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-inspector-width",
      width: 0,
    });
  });
});
