import { startTransition, useEffect, useEffectEvent, useReducer, useRef } from "react";
import { LIVE_FIXTURE_FRAMES } from "../features/fixtures";
import { buildExportPayload, normalizeImportPayload, parseCompletedRunPayload } from "../features/ingestion";
import {
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  type DrawerTab,
  hasRawPayload,
  type InspectorTab,
  type RunFilters,
  type SelectionState,
} from "../shared/domain";
import {
  createDefaultFilters,
  createMonitorInitialState,
  monitorStateReducer,
} from "./monitorState";
import {
  loadArchivedSessionIndex,
  loadArchivedSessionSnapshot,
  loadSessionLogDatasets,
} from "./sessionLogLoader";

export type {
  LiveConnection,
  MonitorState,
} from "./monitorState";
export {
  createMonitorInitialState,
  monitorStateReducer,
} from "./monitorState";

export function useMonitorAppState() {
  const [state, dispatch] = useReducer(monitorStateReducer, undefined, createMonitorInitialState);
  const archiveIndexRequestIdRef = useRef(0);
  const archiveSnapshotRequestIdRef = useRef(0);
  const activeDataset =
    state.datasets.find((item) => item.run.traceId === state.activeRunId) ?? state.datasets[0];
  const activeFilters = state.filtersByRunId[activeDataset.run.traceId] ?? createDefaultFilters();
  const activeFollowLive = state.followLiveByRunId[activeDataset.run.traceId] ?? false;
  const activeLiveConnection =
    state.liveConnectionByRunId[activeDataset.run.traceId] ??
    (activeDataset.run.liveMode === "live" ? "live" : "paused");
  const archivedLoading = state.archivedIndexLoading || state.archivedSnapshotLoading;
  const graphScene = buildGraphSceneModel(
    activeDataset,
    activeFilters,
    state.selection,
  );
  const inspectorSummary = buildInspectorCausalSummary(
    activeDataset,
    state.selection,
    activeDataset.run.rawIncluded,
  );
  const summaryFacts = buildSummaryFacts(
    activeDataset,
    graphScene.selectionPath,
  );
  const anomalyJumps = buildAnomalyJumps(activeDataset);
  const requestArchiveIndex = useEffectEvent((offset: number, append: boolean, search?: string) => {
    const requestId = archiveIndexRequestIdRef.current + 1;
    archiveIndexRequestIdRef.current = requestId;
    dispatch({ type: "begin-archived-index-request", requestId });
    loadArchivedSessionIndex(offset, 50, search).then((result) => {
      if (!result) {
        dispatch({ type: "finish-archived-index-request", requestId });
        return;
      }
      startTransition(() => {
        dispatch({ type: "resolve-archived-index-request", requestId, result, append });
      });
    });
  });

  useEffect(() => {
    let cancelled = false;

    loadSessionLogDatasets().then((datasets) => {
      if (cancelled || !datasets?.length) {
        return;
      }

      startTransition(() => {
        dispatch({ type: "replace-datasets", datasets });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const liveFixtureRun = state.datasets.find((item) => item.run.traceId === "trace-fix-006");
    if (!liveFixtureRun || liveFixtureRun.run.liveMode !== "live") {
      return undefined;
    }

    if (state.appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
      return undefined;
    }

    const frame = LIVE_FIXTURE_FRAMES[state.appliedLiveFrames];
    const timeout = window.setTimeout(() => {
      dispatch({ type: "apply-live-frame" });
    }, frame.delayMs);

    return () => window.clearTimeout(timeout);
  }, [state.appliedLiveFrames, state.datasets]);

  const keyHandler = useEffectEvent((event: KeyboardEvent) => {
    const visibleEventIds =
      graphScene.rows.flatMap((row) => (row.kind === "event" ? [row.eventId] : []));

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dispatch({ type: "toggle-shortcuts" });
      return;
    }

    switch (event.key.toLowerCase()) {
      case "i":
        dispatch({ type: "toggle-inspector" });
        break;
      case ".":
        dispatch({ type: "toggle-follow-live", traceId: activeDataset.run.traceId });
        break;
      case "e":
        dispatch({
          type: "set-filter",
          traceId: activeDataset.run.traceId,
          key: "errorOnly",
          value: !activeFilters.errorOnly,
        });
        break;
      case "c":
        dispatch({ type: "set-drawer-tab", tab: "context", open: true });
        break;
      case "?":
        dispatch({ type: "toggle-shortcuts" });
        break;
      case "arrowdown":
      case "arrowup": {
        if (!visibleEventIds.length) {
          break;
        }
        event.preventDefault();
        const currentIndex = state.selection
          ? visibleEventIds.indexOf(state.selection.id)
          : -1;
        const nextIndex =
          event.key.toLowerCase() === "arrowdown"
            ? Math.min(currentIndex + 1, visibleEventIds.length - 1)
            : Math.max(currentIndex - 1, 0);
        dispatch({
          type: "set-selection",
          selection: { kind: "event", id: visibleEventIds[nextIndex] },
        });
        break;
      }
      default:
        break;
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    requestArchiveIndex(0, false);
  }, []);

  return {
    state,
    activeDataset,
    activeFilters,
    activeFollowLive,
    activeLiveConnection,
    archivedLoading,
    rawTabAvailable: hasRawPayload(activeDataset),
    graphScene,
    inspectorSummary,
    summaryFacts,
    anomalyJumps,
    actions: {
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
          dispatch({ type: "set-follow-live", traceId: activeDataset.run.traceId, value: false });
        }
      },
      setInspectorTab(tab: InspectorTab) {
        dispatch({ type: "set-inspector-tab", tab });
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
      togglePinned() {
        dispatch({ type: "toggle-pin" });
      },
      toggleFollowLive() {
        dispatch({ type: "toggle-follow-live", traceId: activeDataset.run.traceId });
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
        dispatch({ type: "set-follow-live", traceId: activeDataset.run.traceId, value: false });
      },
      setFilter(key: keyof RunFilters, value: string | boolean | null) {
        dispatch({ type: "set-filter", traceId: activeDataset.run.traceId, key, value });
      },
      toggleGap(gapId: string) {
        dispatch({ type: "toggle-gap", traceId: activeDataset.run.traceId, gapId });
      },
      resizeRail(width: number) {
        dispatch({ type: "set-rail-width", width: Math.max(width, 220) });
      },
      resizeInspector(width: number) {
        dispatch({
          type: "set-inspector-width",
          width: Math.max(width, 256),
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
          value: buildExportPayload(activeDataset, includeRaw && activeDataset.run.rawIncluded),
          open: true,
        });
      },
      toggleShortcuts() {
        dispatch({ type: "toggle-shortcuts" });
      },
      toggleArchiveSection() {
        dispatch({ type: "toggle-archive-section" });
      },
      loadArchiveIndex(append: boolean) {
        const offset = append ? state.archivedIndex.length : 0;
        requestArchiveIndex(offset, append, state.archivedSearch || undefined);
      },
      searchArchive(query: string) {
        dispatch({ type: "set-archived-search", value: query });
        requestArchiveIndex(0, false, query || undefined);
      },
      selectArchivedSession(filePath: string) {
        const requestId = archiveSnapshotRequestIdRef.current + 1;
        archiveSnapshotRequestIdRef.current = requestId;
        dispatch({ type: "begin-archived-snapshot-request", requestId });
        loadArchivedSessionSnapshot(filePath).then((dataset) => {
          if (!dataset) {
            dispatch({ type: "finish-archived-snapshot-request", requestId });
            return;
          }
          startTransition(() => {
            dispatch({ type: "resolve-archived-snapshot-request", requestId, dataset });
          });
        });
      },
    },
  };
}
