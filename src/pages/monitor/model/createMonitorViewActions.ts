import type { Dispatch } from "react";
import type { DrawerTab, SelectionState } from "../../../entities/run";
import {
  MIN_INSPECTOR_WIDTH,
  MIN_RAIL_WIDTH,
  type MonitorAction,
  type MonitorState,
} from "./state";

interface CreateMonitorViewActionsOptions {
  drawerOpen: boolean;
  dispatch: Dispatch<MonitorAction>;
  activeDataset: MonitorState["datasets"][number] | null;
  activeFollowLive: boolean;
}

function buildSelectionActions(options: CreateMonitorViewActionsOptions) {
  const { activeDataset, activeFollowLive, dispatch } = options;
  return createSelectionActions({ activeDataset, activeFollowLive, dispatch });
}

function createSelectionActions(
  options: Pick<
    CreateMonitorViewActionsOptions,
    "activeDataset" | "activeFollowLive" | "dispatch"
  >,
) {
  const { activeDataset, activeFollowLive, dispatch } = options;
  return {
    selectRun(traceId: string) {
      dispatch({ type: "set-active-run", traceId });
    },
    navigateToItem(selection: SelectionState) {
      if (!activeDataset) {
        return;
      }

      dispatch({ type: "navigate-selection", selection });
    },
    selectItem(selection: SelectionState) {
      if (!activeDataset) {
        return;
      }

      dispatch({ type: "set-selection", selection });

      if (
        activeDataset.run.liveMode === "live" &&
        selection.kind === "event" &&
        activeFollowLive &&
        activeDataset.events[activeDataset.events.length - 1]?.eventId !== selection.id
      ) {
        dispatch({
          type: "set-follow-live",
          traceId: activeDataset.run.traceId,
          value: false,
        });
      }
    },
  };
}

function buildDrawerActions({
  dispatch,
  drawerOpen,
}: CreateMonitorViewActionsOptions) {
  return {
    setDrawerTab(tab: DrawerTab, open = drawerOpen) {
      dispatch({ type: "set-drawer-tab", tab, open });
    },
    setDrawerOpen(open: boolean) {
      dispatch({ type: "set-drawer-open", open });
    },
    toggleInspector() {
      dispatch({ type: "toggle-inspector" });
    },
    toggleShortcuts() {
      dispatch({ type: "toggle-shortcuts" });
    },
    toggleArchiveSection() {
      dispatch({ type: "toggle-archive-section" });
    },
  };
}

function buildLiveActions(options: CreateMonitorViewActionsOptions) {
  const { activeDataset, activeFollowLive, dispatch } = options;
  return createLiveActions({ activeDataset, activeFollowLive, dispatch });
}

function dispatchFollowLiveToggle(
  dispatch: Dispatch<MonitorAction>,
  activeDataset: NonNullable<CreateMonitorViewActionsOptions["activeDataset"]>,
) {
  dispatch({
    type: "toggle-follow-live",
    traceId: activeDataset.run.traceId,
  });
}

function selectLatestLiveEvent(
  dispatch: Dispatch<MonitorAction>,
  activeDataset: NonNullable<CreateMonitorViewActionsOptions["activeDataset"]>,
) {
  const latestEvent = activeDataset.events[activeDataset.events.length - 1];
  if (!latestEvent) {
    return;
  }

  dispatch({
    type: "set-selection",
    selection: { kind: "event", id: latestEvent.eventId },
  });
}

function createLiveActions(
  options: Pick<
    CreateMonitorViewActionsOptions,
    "activeDataset" | "activeFollowLive" | "dispatch"
  >,
) {
  return {
    toggleFollowLive: createToggleFollowLiveAction(options),
    pauseFollowLive: createPauseFollowLiveAction(options),
    toggleGap: createToggleGapAction(options),
  };
}

function createToggleFollowLiveAction(
  options: Pick<
    CreateMonitorViewActionsOptions,
    "activeDataset" | "activeFollowLive" | "dispatch"
  >,
) {
  const { activeDataset, activeFollowLive, dispatch } = options;
  return function toggleFollowLive() {
    if (!activeDataset) {
      return;
    }

    dispatchFollowLiveToggle(dispatch, activeDataset);
    if (!activeFollowLive && activeDataset.run.liveMode === "live") {
      selectLatestLiveEvent(dispatch, activeDataset);
    }
  };
}

function createPauseFollowLiveAction(
  options: Pick<
    CreateMonitorViewActionsOptions,
    "activeDataset" | "activeFollowLive" | "dispatch"
  >,
) {
  const { activeDataset, activeFollowLive, dispatch } = options;
  return function pauseFollowLive() {
    if (!activeDataset || !activeFollowLive || activeDataset.run.liveMode !== "live") {
      return;
    }

    dispatch({
      type: "set-follow-live",
      traceId: activeDataset.run.traceId,
      value: false,
    });
  };
}

function createToggleGapAction(
  options: Pick<CreateMonitorViewActionsOptions, "activeDataset" | "dispatch">,
) {
  const { activeDataset, dispatch } = options;
  return function toggleGap(gapId: string) {
    if (!activeDataset) {
      return;
    }

    dispatch({
      type: "toggle-gap",
      traceId: activeDataset.run.traceId,
      gapId,
    });
  };
}

function buildSizingActions({ dispatch }: CreateMonitorViewActionsOptions) {
  return {
    resizeRail(width: number) {
      dispatch({
        type: "set-rail-width",
        width: Math.max(width, MIN_RAIL_WIDTH),
      });
    },
    resizeInspector(width: number) {
      dispatch({
        type: "set-inspector-width",
        width: Math.max(width, MIN_INSPECTOR_WIDTH),
      });
    },
  };
}

export function createMonitorViewActions(options: CreateMonitorViewActionsOptions) {
  return {
    ...buildSelectionActions(options),
    ...buildDrawerActions(options),
    ...buildLiveActions(options),
    ...buildSizingActions(options),
  };
}
