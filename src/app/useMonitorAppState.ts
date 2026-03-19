import { startTransition, useEffect, useEffectEvent, useReducer } from "react";
import { FIXTURE_DATASETS, FIXTURE_IMPORT_TEXT, LIVE_FIXTURE_FRAMES } from "../features/fixtures";
import { applyLiveFrame, buildExportPayload, normalizeImportPayload, parseCompletedRunPayload } from "../features/ingestion";
import {
  type ArchivedSessionIndexItem,
  type ArchivedSessionIndexResult,
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  type DrawerTab,
  hasRawPayload,
  type InspectorTab,
  type RunDataset,
  type RunFilters,
  type SelectionState,
} from "../shared/domain";
import {
  loadArchivedSessionIndex,
  loadArchivedSessionSnapshot,
  loadSessionLogDatasets,
} from "./sessionLogLoader";

export type LiveConnection = "live" | "stale" | "disconnected" | "reconnected" | "paused";

export interface MonitorState {
  datasets: RunDataset[];
  activeRunId: string;
  selection: SelectionState | null;
  inspectorTab: InspectorTab;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
  inspectorOpen: boolean;
  inspectorPinned: boolean;
  followLiveByRunId: Record<string, boolean>;
  liveConnectionByRunId: Record<string, LiveConnection>;
  filtersByRunId: Record<string, RunFilters>;
  collapsedGapIds: Record<string, string[]>;
  railWidth: number;
  inspectorWidth: number;
  importText: string;
  allowRawImport: boolean;
  noRawStorage: boolean;
  exportText: string;
  shortcutHelpOpen: boolean;
  appliedLiveFrames: number;
  archivedIndex: ArchivedSessionIndexItem[];
  archivedTotal: number;
  archivedHasMore: boolean;
  archivedSearch: string;
  archivedLoading: boolean;
  archiveSectionOpen: boolean;
}

type Action =
  | { type: "set-active-run"; traceId: string }
  | { type: "set-selection"; selection: SelectionState | null }
  | { type: "set-inspector-tab"; tab: InspectorTab }
  | { type: "set-drawer-tab"; tab: DrawerTab; open?: boolean }
  | { type: "toggle-drawer" }
  | { type: "toggle-inspector" }
  | { type: "toggle-pin" }
  | { type: "toggle-follow-live"; traceId: string }
  | { type: "set-follow-live"; traceId: string; value: boolean }
  | { type: "set-live-connection"; traceId: string; connection: LiveConnection }
  | { type: "set-filter"; traceId: string; key: keyof RunFilters; value: string | boolean | null }
  | { type: "toggle-gap"; traceId: string; gapId: string }
  | { type: "set-rail-width"; width: number }
  | { type: "set-inspector-width"; width: number }
  | { type: "set-import-text"; value: string }
  | { type: "set-allow-raw"; value: boolean }
  | { type: "set-no-raw"; value: boolean }
  | { type: "set-export-text"; value: string; open?: boolean }
  | { type: "toggle-shortcuts" }
  | { type: "import-dataset"; dataset: RunDataset }
  | { type: "replace-datasets"; datasets: RunDataset[] }
  | { type: "apply-live-frame" }
  | { type: "set-archived-index"; result: ArchivedSessionIndexResult; append: boolean }
  | { type: "set-archived-search"; value: string }
  | { type: "set-archived-loading"; value: boolean }
  | { type: "toggle-archive-section" }
  | { type: "load-archived-dataset"; dataset: RunDataset };

function createDefaultFilters(): RunFilters {
  return {
    agentId: null,
    eventType: "all",
    search: "",
    errorOnly: false,
  };
}

function buildFollowLiveMap(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets.map((dataset) => [dataset.run.traceId, dataset.run.liveMode === "live"]),
  ) as Record<string, boolean>;
}

function buildConnectionMap(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets
      .filter((dataset) => dataset.run.liveMode === "live")
      .map((dataset) => {
        if (dataset.run.status === "stale") {
          return [dataset.run.traceId, "stale" as const];
        }
        if (dataset.run.status === "disconnected") {
          return [dataset.run.traceId, "disconnected" as const];
        }
        return [dataset.run.traceId, "live" as const];
      }),
  ) as Record<string, LiveConnection>;
}

function buildFilterMap(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets.map((dataset) => [dataset.run.traceId, createDefaultFilters()]),
  ) as Record<string, RunFilters>;
}

function buildCollapsedGapIds(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets.map((dataset) => [dataset.run.traceId, [] as string[]]),
  ) as Record<string, string[]>;
}

export function createMonitorInitialState(): MonitorState {
  const activeRunId = "trace-fix-002";
  const activeDataset =
    FIXTURE_DATASETS.find((item) => item.run.traceId === activeRunId) ?? FIXTURE_DATASETS[0];
  const compactViewport =
    typeof window !== "undefined" ? window.innerWidth <= 720 : false;
  return {
    datasets: FIXTURE_DATASETS,
    activeRunId,
    selection: activeDataset.run.selectedByDefaultId
      ? { kind: "event", id: activeDataset.run.selectedByDefaultId }
      : null,
    inspectorTab: "summary",
    drawerTab: "artifacts",
    drawerOpen: false,
    inspectorOpen: !compactViewport,
    inspectorPinned: false,
    followLiveByRunId: buildFollowLiveMap(FIXTURE_DATASETS),
    liveConnectionByRunId: buildConnectionMap(FIXTURE_DATASETS),
    filtersByRunId: buildFilterMap(FIXTURE_DATASETS),
    collapsedGapIds: buildCollapsedGapIds(FIXTURE_DATASETS),
    railWidth: 236,
    inspectorWidth: 288,
    importText: FIXTURE_IMPORT_TEXT,
    allowRawImport: false,
    noRawStorage: true,
    exportText: "",
    shortcutHelpOpen: false,
    appliedLiveFrames: 0,
    archivedIndex: [],
    archivedTotal: 0,
    archivedHasMore: false,
    archivedSearch: "",
    archivedLoading: false,
    archiveSectionOpen: false,
  };
}

export function monitorStateReducer(state: MonitorState, action: Action): MonitorState {
  switch (action.type) {
    case "set-active-run": {
      const dataset = state.datasets.find((item) => item.run.traceId === action.traceId);
      return {
        ...state,
        activeRunId: action.traceId,
        selection: dataset?.run.selectedByDefaultId
          ? { kind: "event", id: dataset.run.selectedByDefaultId }
          : null,
        inspectorTab:
          dataset && !hasRawPayload(dataset) && state.inspectorTab === "raw"
            ? "summary"
            : state.inspectorTab,
        drawerTab:
          dataset && !hasRawPayload(dataset) && state.drawerTab === "raw"
            ? "artifacts"
            : state.drawerTab,
      };
    }
    case "set-selection":
      return { ...state, selection: action.selection };
    case "set-inspector-tab":
      return { ...state, inspectorTab: action.tab };
    case "set-drawer-tab":
      return {
        ...state,
        drawerTab: action.tab,
        drawerOpen: action.open ?? state.drawerOpen,
      };
    case "toggle-drawer":
      return { ...state, drawerOpen: !state.drawerOpen };
    case "toggle-inspector":
      return { ...state, inspectorOpen: !state.inspectorOpen };
    case "toggle-pin":
      return { ...state, inspectorPinned: !state.inspectorPinned };
    case "toggle-follow-live": {
      const dataset = state.datasets.find((item) => item.run.traceId === action.traceId);
      if (!dataset || dataset.run.liveMode !== "live") {
        return state;
      }
      const nextFollow = !(state.followLiveByRunId[action.traceId] ?? false);
      return {
        ...state,
        followLiveByRunId: {
          ...state.followLiveByRunId,
          [action.traceId]: nextFollow,
        },
        liveConnectionByRunId: {
          ...state.liveConnectionByRunId,
          [action.traceId]: nextFollow ? "live" : "paused",
        },
      };
    }
    case "set-follow-live":
      return {
        ...state,
        followLiveByRunId: {
          ...state.followLiveByRunId,
          [action.traceId]: action.value,
        },
        liveConnectionByRunId: {
          ...state.liveConnectionByRunId,
          [action.traceId]: action.value ? "live" : "paused",
        },
      };
    case "set-live-connection":
      return {
        ...state,
        liveConnectionByRunId: {
          ...state.liveConnectionByRunId,
          [action.traceId]: action.connection,
        },
      };
    case "set-filter":
      return {
        ...state,
        filtersByRunId: {
          ...state.filtersByRunId,
          [action.traceId]: {
            ...(state.filtersByRunId[action.traceId] ?? createDefaultFilters()),
            [action.key]: action.value,
          },
        },
      };
    case "toggle-gap": {
      const current = new Set(state.collapsedGapIds[action.traceId] ?? []);
      if (current.has(action.gapId)) {
        current.delete(action.gapId);
      } else {
        current.add(action.gapId);
      }
      return {
        ...state,
        collapsedGapIds: {
          ...state.collapsedGapIds,
          [action.traceId]: Array.from(current),
        },
      };
    }
    case "set-rail-width":
      return { ...state, railWidth: action.width };
    case "set-inspector-width":
      return { ...state, inspectorWidth: action.width };
    case "set-import-text":
      return { ...state, importText: action.value };
    case "set-allow-raw":
      return { ...state, allowRawImport: action.value };
    case "set-no-raw":
      return { ...state, noRawStorage: action.value };
    case "set-export-text":
      return {
        ...state,
        exportText: action.value,
        drawerTab: "log",
        drawerOpen: action.open ?? state.drawerOpen,
      };
    case "toggle-shortcuts":
      return { ...state, shortcutHelpOpen: !state.shortcutHelpOpen };
    case "import-dataset": {
      const datasets = [action.dataset, ...state.datasets.filter((item) => item.run.traceId !== action.dataset.run.traceId)];
      return {
        ...state,
        datasets,
        activeRunId: action.dataset.run.traceId,
        selection: action.dataset.run.selectedByDefaultId
          ? { kind: "event", id: action.dataset.run.selectedByDefaultId }
          : null,
        collapsedGapIds: {
          ...state.collapsedGapIds,
          [action.dataset.run.traceId]: [],
        },
        followLiveByRunId: {
          ...state.followLiveByRunId,
          [action.dataset.run.traceId]: false,
        },
        filtersByRunId: {
          ...state.filtersByRunId,
          [action.dataset.run.traceId]: createDefaultFilters(),
        },
        drawerTab: "artifacts",
        drawerOpen: true,
        inspectorTab: hasRawPayload(action.dataset) ? state.inspectorTab : "summary",
      };
    }
    case "replace-datasets": {
      if (!action.datasets.length) {
        return state;
      }

      const activeDataset =
        action.datasets.find((item) => item.run.traceId === state.activeRunId) ?? action.datasets[0];

      return {
        ...state,
        datasets: action.datasets,
        activeRunId: activeDataset.run.traceId,
        selection: activeDataset.run.selectedByDefaultId
          ? { kind: "event", id: activeDataset.run.selectedByDefaultId }
          : null,
        followLiveByRunId: buildFollowLiveMap(action.datasets),
        liveConnectionByRunId: buildConnectionMap(action.datasets),
        filtersByRunId: buildFilterMap(action.datasets),
        collapsedGapIds: buildCollapsedGapIds(action.datasets),
        inspectorTab:
          activeDataset.run.rawIncluded || state.inspectorTab !== "raw" ? state.inspectorTab : "summary",
        drawerTab:
          activeDataset.run.rawIncluded || state.drawerTab !== "raw" ? state.drawerTab : "artifacts",
        appliedLiveFrames: 0,
      };
    }
    case "apply-live-frame": {
      if (state.appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
        return state;
      }

      const dataset = state.datasets.find((item) => item.run.traceId === "trace-fix-006");
      if (!dataset) {
        return state;
      }

      const snapshot = applyLiveFrame(dataset, LIVE_FIXTURE_FRAMES[state.appliedLiveFrames]);
      const latestEvent = snapshot.dataset.events[snapshot.dataset.events.length - 1];
      const datasets = state.datasets.map((item) =>
        item.run.traceId === "trace-fix-006" ? snapshot.dataset : item,
      );
      return {
        ...state,
        datasets,
        liveConnectionByRunId: {
          ...state.liveConnectionByRunId,
          "trace-fix-006": state.followLiveByRunId["trace-fix-006"] ? snapshot.connection : "paused",
        },
        selection:
          state.followLiveByRunId["trace-fix-006"] && state.activeRunId === "trace-fix-006" && latestEvent
            ? { kind: "event", id: latestEvent.eventId }
            : state.selection,
        appliedLiveFrames: state.appliedLiveFrames + 1,
      };
    }
    case "set-archived-index": {
      const items = action.append
        ? [...state.archivedIndex, ...action.result.items]
        : action.result.items;
      return {
        ...state,
        archivedIndex: items,
        archivedTotal: action.result.total,
        archivedHasMore: action.result.hasMore,
        archivedLoading: false,
      };
    }
    case "set-archived-search":
      return { ...state, archivedSearch: action.value };
    case "set-archived-loading":
      return { ...state, archivedLoading: action.value };
    case "toggle-archive-section":
      return { ...state, archiveSectionOpen: !state.archiveSectionOpen };
    case "load-archived-dataset": {
      const datasets = [
        action.dataset,
        ...state.datasets.filter(
          (item) => item.run.traceId !== action.dataset.run.traceId,
        ),
      ];
      return {
        ...state,
        datasets,
        activeRunId: action.dataset.run.traceId,
        selection: action.dataset.run.selectedByDefaultId
          ? { kind: "event", id: action.dataset.run.selectedByDefaultId }
          : null,
        collapsedGapIds: {
          ...state.collapsedGapIds,
          [action.dataset.run.traceId]: [],
        },
        followLiveByRunId: {
          ...state.followLiveByRunId,
          [action.dataset.run.traceId]: false,
        },
        filtersByRunId: {
          ...state.filtersByRunId,
          [action.dataset.run.traceId]: createDefaultFilters(),
        },
        inspectorTab: hasRawPayload(action.dataset) ? state.inspectorTab : "summary",
      };
    }
    default:
      return state;
  }
}

export function useMonitorAppState() {
  const [state, dispatch] = useReducer(monitorStateReducer, undefined, createMonitorInitialState);
  const activeDataset =
    state.datasets.find((item) => item.run.traceId === state.activeRunId) ?? state.datasets[0];
  const activeFilters = state.filtersByRunId[activeDataset.run.traceId] ?? createDefaultFilters();
  const activeFollowLive = state.followLiveByRunId[activeDataset.run.traceId] ?? false;
  const activeLiveConnection =
    state.liveConnectionByRunId[activeDataset.run.traceId] ??
    (activeDataset.run.liveMode === "live" ? "live" : "paused");
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
    let cancelled = false;
    loadArchivedSessionIndex(0, 50).then((result) => {
      if (cancelled || !result) return;
      startTransition(() => {
        dispatch({ type: "set-archived-index", result, append: false });
      });
    });
    return () => { cancelled = true; };
  }, []);

  return {
    state,
    activeDataset,
    activeFilters,
    activeFollowLive,
    activeLiveConnection,
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
        dispatch({ type: "set-archived-loading", value: true });
        loadArchivedSessionIndex(offset, 50, state.archivedSearch || undefined).then(
          (result) => {
            if (!result) {
              dispatch({ type: "set-archived-loading", value: false });
              return;
            }
            startTransition(() => {
              dispatch({ type: "set-archived-index", result, append });
            });
          },
        );
      },
      searchArchive(query: string) {
        dispatch({ type: "set-archived-search", value: query });
        dispatch({ type: "set-archived-loading", value: true });
        loadArchivedSessionIndex(0, 50, query || undefined).then((result) => {
          if (!result) {
            dispatch({ type: "set-archived-loading", value: false });
            return;
          }
          startTransition(() => {
            dispatch({ type: "set-archived-index", result, append: false });
          });
        });
      },
      selectArchivedSession(filePath: string) {
        dispatch({ type: "set-archived-loading", value: true });
        loadArchivedSessionSnapshot(filePath).then((dataset) => {
          dispatch({ type: "set-archived-loading", value: false });
          if (!dataset) return;
          startTransition(() => {
            dispatch({ type: "load-archived-dataset", dataset });
          });
        });
      },
    },
  };
}
