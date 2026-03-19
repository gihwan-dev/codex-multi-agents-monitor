import {
  type Dispatch,
  type MutableRefObject,
  startTransition,
} from "react";
import {
  buildExportPayload,
  normalizeImportPayload,
  parseCompletedRunPayload,
} from "../features/ingestion";
import type {
  DrawerTab,
  RunFilters,
  SelectionState,
} from "../shared/domain";
import { createMonitorArchiveActions } from "./createMonitorArchiveActions";
import {
  MIN_INSPECTOR_WIDTH,
  MIN_RAIL_WIDTH,
  type MonitorAction,
  type MonitorState,
} from "./monitorState";

interface CreateMonitorActionsOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  activeDataset: MonitorState["datasets"][number];
  activeFollowLive: boolean;
  requestArchiveIndex: (
    offset: number,
    append: boolean,
    search?: string,
  ) => void;
  archiveSnapshotRequestIdRef: MutableRefObject<number>;
}

export function createMonitorActions({
  state,
  dispatch,
  activeDataset,
  activeFollowLive,
  requestArchiveIndex,
  archiveSnapshotRequestIdRef,
}: CreateMonitorActionsOptions) {
  const archiveActions = createMonitorArchiveActions({
    state,
    dispatch,
    requestArchiveIndex,
    archiveSnapshotRequestIdRef,
  });

  return {
    selectRun(traceId: string) {
      dispatch({ type: "set-active-run", traceId });
    },
    selectItem(selection: SelectionState) {
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
    setDrawerTab(tab: DrawerTab, open = state.drawerOpen) {
      dispatch({ type: "set-drawer-tab", tab, open });
    },
    toggleDrawer() {
      dispatch({ type: "toggle-drawer" });
    },
    toggleInspector() {
      dispatch({ type: "toggle-inspector" });
    },
    toggleFollowLive() {
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
      if (!activeFollowLive || activeDataset.run.liveMode !== "live") {
        return;
      }

      dispatch({
        type: "set-follow-live",
        traceId: activeDataset.run.traceId,
        value: false,
      });
    },
    setFilter(key: keyof RunFilters, value: string | boolean | null) {
      dispatch({
        type: "set-filter",
        traceId: activeDataset.run.traceId,
        key,
        value,
      });
    },
    toggleGap(gapId: string) {
      dispatch({
        type: "toggle-gap",
        traceId: activeDataset.run.traceId,
        gapId,
      });
    },
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
    setImportText(value: string) {
      dispatch({ type: "set-import-text", value });
    },
    setAllowRaw(value: boolean) {
      dispatch({ type: "set-allow-raw", value });
    },
    setNoRawStorage(value: boolean) {
      dispatch({ type: "set-no-raw", value });
    },
    importPayload() {
      try {
        const parsed = parseCompletedRunPayload(state.importText);
        const dataset = normalizeImportPayload(parsed, {
          allowRaw: state.allowRawImport,
          noRawStorage: state.noRawStorage,
        });

        startTransition(() => {
          dispatch({ type: "import-dataset", dataset });
        });
      } catch (error) {
        dispatch({
          type: "set-export-text",
          value: error instanceof Error ? error.message : "Import failed.",
          open: true,
        });
      }
    },
    exportDataset(includeRaw = false) {
      dispatch({
        type: "set-export-text",
        value: buildExportPayload(
          activeDataset,
          includeRaw && activeDataset.run.rawIncluded,
        ),
        open: true,
      });
    },
    toggleShortcuts() {
      dispatch({ type: "toggle-shortcuts" });
    },
    toggleArchiveSection() {
      dispatch({ type: "toggle-archive-section" });
    },
    ...archiveActions,
  };
}
