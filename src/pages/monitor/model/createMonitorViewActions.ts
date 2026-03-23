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

function buildSelectionActions({
  activeDataset,
  activeFollowLive,
  dispatch,
}: CreateMonitorViewActionsOptions) {
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

function buildLiveActions({
  activeDataset,
  activeFollowLive,
  dispatch,
}: CreateMonitorViewActionsOptions) {
  return {
    toggleFollowLive() {
      if (!activeDataset) {
        return;
      }

      dispatch({
        type: "toggle-follow-live",
        traceId: activeDataset.run.traceId,
      });

      if (!activeFollowLive && activeDataset.run.liveMode === "live") {
        const latestEvent = activeDataset.events[activeDataset.events.length - 1];
        if (latestEvent) {
          dispatch({
            type: "set-selection",
            selection: { kind: "event", id: latestEvent.eventId },
          });
        }
      }
    },
    pauseFollowLive() {
      if (!activeDataset) {
        return;
      }

      if (!activeFollowLive || activeDataset.run.liveMode !== "live") {
        return;
      }

      dispatch({
        type: "set-follow-live",
        traceId: activeDataset.run.traceId,
        value: false,
      });
    },
    toggleGap(gapId: string) {
      if (!activeDataset) {
        return;
      }

      dispatch({
        type: "toggle-gap",
        traceId: activeDataset.run.traceId,
        gapId,
      });
    },
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
