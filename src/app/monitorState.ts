import { FIXTURE_DATASETS, FIXTURE_IMPORT_TEXT, LIVE_FIXTURE_FRAMES } from "../features/fixtures";
import { applyLiveFrame } from "../features/ingestion";
import {
  type ArchivedSessionIndexItem,
  type ArchivedSessionIndexResult,
  type DrawerTab,
  hasRawPayload,
  type InspectorTab,
  type RunDataset,
  type RunFilters,
  type SelectionState,
} from "../shared/domain";

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
  archivedIndexLoading: boolean;
  archivedSnapshotLoading: boolean;
  archivedIndexRequestId: number;
  archivedSnapshotRequestId: number;
  archiveSectionOpen: boolean;
}

export type MonitorAction =
  | { type: "set-active-run"; traceId: string }
  | { type: "set-selection"; selection: SelectionState | null }
  | { type: "set-inspector-tab"; tab: InspectorTab }
  | { type: "set-drawer-tab"; tab: DrawerTab; open?: boolean }
  | { type: "toggle-drawer" }
  | { type: "toggle-inspector" }
  | { type: "toggle-pin" }
  | { type: "toggle-follow-live"; traceId: string }
  | { type: "set-follow-live"; traceId: string; value: boolean }
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
  | { type: "begin-archived-index-request"; requestId: number }
  | { type: "resolve-archived-index-request"; requestId: number; result: ArchivedSessionIndexResult; append: boolean }
  | { type: "finish-archived-index-request"; requestId: number }
  | { type: "begin-archived-snapshot-request"; requestId: number }
  | { type: "resolve-archived-snapshot-request"; requestId: number; dataset: RunDataset }
  | { type: "finish-archived-snapshot-request"; requestId: number }
  | { type: "set-archived-search"; value: string }
  | { type: "toggle-archive-section" };

export function createDefaultFilters(): RunFilters {
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

function defaultSelectionForDataset(dataset: RunDataset): SelectionState | null {
  return dataset.run.selectedByDefaultId
    ? { kind: "event", id: dataset.run.selectedByDefaultId }
    : null;
}

function buildDatasetActivationPatch(state: MonitorState, dataset: RunDataset) {
  return {
    activeRunId: dataset.run.traceId,
    selection: defaultSelectionForDataset(dataset),
    collapsedGapIds: {
      ...state.collapsedGapIds,
      [dataset.run.traceId]: [],
    },
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [dataset.run.traceId]: false,
    },
    filtersByRunId: {
      ...state.filtersByRunId,
      [dataset.run.traceId]: createDefaultFilters(),
    },
    inspectorTab: hasRawPayload(dataset) ? state.inspectorTab : "summary",
    drawerTab:
      hasRawPayload(dataset) || state.drawerTab !== "raw" ? state.drawerTab : "artifacts",
  };
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
    selection: defaultSelectionForDataset(activeDataset),
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
    archivedIndexLoading: false,
    archivedSnapshotLoading: false,
    archivedIndexRequestId: 0,
    archivedSnapshotRequestId: 0,
    archiveSectionOpen: false,
  };
}

export function monitorStateReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case "set-active-run": {
      const dataset = state.datasets.find((item) => item.run.traceId === action.traceId);
      return {
        ...state,
        activeRunId: action.traceId,
        selection: dataset ? defaultSelectionForDataset(dataset) : null,
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
        ...buildDatasetActivationPatch(state, action.dataset),
        drawerTab: "artifacts",
        drawerOpen: true,
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
        selection: defaultSelectionForDataset(activeDataset),
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
    case "begin-archived-index-request":
      return {
        ...state,
        archivedIndexLoading: true,
        archivedIndexRequestId: action.requestId,
      };
    case "resolve-archived-index-request": {
      if (action.requestId !== state.archivedIndexRequestId) {
        return state;
      }
      const items = action.append
        ? [...state.archivedIndex, ...action.result.items]
        : action.result.items;
      return {
        ...state,
        archivedIndex: items,
        archivedTotal: action.result.total,
        archivedHasMore: action.result.hasMore,
        archivedIndexLoading: false,
      };
    }
    case "finish-archived-index-request":
      if (action.requestId !== state.archivedIndexRequestId) {
        return state;
      }
      return { ...state, archivedIndexLoading: false };
    case "begin-archived-snapshot-request":
      return {
        ...state,
        archivedSnapshotLoading: true,
        archivedSnapshotRequestId: action.requestId,
      };
    case "resolve-archived-snapshot-request":
      if (action.requestId !== state.archivedSnapshotRequestId) {
        return state;
      }
      return {
        ...state,
        archivedSnapshotLoading: false,
        datasets: [
          action.dataset,
          ...state.datasets.filter((item) => item.run.traceId !== action.dataset.run.traceId),
        ],
        ...buildDatasetActivationPatch(state, action.dataset),
      };
    case "finish-archived-snapshot-request":
      if (action.requestId !== state.archivedSnapshotRequestId) {
        return state;
      }
      return { ...state, archivedSnapshotLoading: false };
    case "set-archived-search":
      return { ...state, archivedSearch: action.value };
    case "toggle-archive-section":
      return { ...state, archiveSectionOpen: !state.archiveSectionOpen };
    default:
      return state;
  }
}
