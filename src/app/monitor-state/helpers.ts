import {
  FIXTURE_DATASETS,
  FIXTURE_IMPORT_TEXT,
} from "../../features/fixtures";
import type {
  RunDataset,
  RunFilters,
  SelectionState,
} from "../../shared/domain";
import type { LiveConnection, MonitorState } from "./types";

export const DEFAULT_ACTIVE_RUN_ID = "trace-fix-002";
export const DEFAULT_RAIL_WIDTH = 236;
export const DEFAULT_INSPECTOR_WIDTH = 288;
export const MIN_RAIL_WIDTH = 220;
export const MIN_INSPECTOR_WIDTH = 256;
export const ARCHIVE_PAGE_SIZE = 50;
export const LIVE_FIXTURE_TRACE_ID = "trace-fix-006";

export function createDefaultFilters(): RunFilters {
  return {
    agentId: null,
    eventType: "all",
    search: "",
    errorOnly: false,
  };
}

export function buildFollowLiveMap(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets.map((dataset) => [dataset.run.traceId, dataset.run.liveMode === "live"]),
  ) as Record<string, boolean>;
}

export function buildConnectionMap(datasets: RunDataset[]) {
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

export function buildFilterMap(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets.map((dataset) => [dataset.run.traceId, createDefaultFilters()]),
  ) as Record<string, RunFilters>;
}

export function buildCollapsedGapIds(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets.map((dataset) => [dataset.run.traceId, [] as string[]]),
  ) as Record<string, string[]>;
}

export function defaultSelectionForDataset(
  dataset: RunDataset,
): SelectionState | null {
  return dataset.run.selectedByDefaultId
    ? { kind: "event", id: dataset.run.selectedByDefaultId }
    : null;
}

export function resolveDatasetDrawerTab(
  state: MonitorState,
  dataset: RunDataset,
) {
  return {
    drawerTab:
      dataset.run.rawIncluded || state.drawerTab !== "raw"
        ? state.drawerTab
        : "artifacts",
  };
}

export function buildDatasetActivationPatch(
  state: MonitorState,
  dataset: RunDataset,
) {
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
    ...resolveDatasetDrawerTab(state, dataset),
  };
}

export function upsertDataset(
  state: MonitorState,
  dataset: MonitorState["datasets"][number],
) {
  return [
    dataset,
    ...state.datasets.filter((item) => item.run.traceId !== dataset.run.traceId),
  ];
}

export function toggleGapIds(
  state: MonitorState,
  traceId: string,
  gapId: string,
) {
  const current = new Set(state.collapsedGapIds[traceId] ?? []);
  if (current.has(gapId)) {
    current.delete(gapId);
  } else {
    current.add(gapId);
  }
  return Array.from(current);
}

export function createMonitorInitialState(): MonitorState {
  const fallbackDataset = FIXTURE_DATASETS[0];
  if (!fallbackDataset) {
    throw new Error("fixture dataset missing");
  }

  const activeDataset =
    FIXTURE_DATASETS.find(
      (item) => item.run.traceId === DEFAULT_ACTIVE_RUN_ID,
    ) ?? fallbackDataset;
  const compactViewport =
    typeof window !== "undefined" ? window.innerWidth <= 720 : false;

  return {
    datasets: FIXTURE_DATASETS,
    activeRunId: activeDataset.run.traceId,
    selection: defaultSelectionForDataset(activeDataset),
    drawerTab: "artifacts",
    drawerOpen: false,
    inspectorOpen: !compactViewport,
    followLiveByRunId: buildFollowLiveMap(FIXTURE_DATASETS),
    liveConnectionByRunId: buildConnectionMap(FIXTURE_DATASETS),
    filtersByRunId: buildFilterMap(FIXTURE_DATASETS),
    collapsedGapIds: buildCollapsedGapIds(FIXTURE_DATASETS),
    railWidth: DEFAULT_RAIL_WIDTH,
    inspectorWidth: DEFAULT_INSPECTOR_WIDTH,
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
