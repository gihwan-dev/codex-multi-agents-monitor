import type { RunDataset, SelectionState } from "../../../../entities/run";
import { FIXTURE_DATASETS, FIXTURE_IMPORT_TEXT } from "../../../../entities/run";
import { buildConnectionMap, updateLiveConnectionMap } from "./liveConnection";
import type { MonitorState } from "./types";

export const DEFAULT_ACTIVE_RUN_ID = "trace-fix-002";
export const DEFAULT_RAIL_WIDTH = 236;
export const DEFAULT_INSPECTOR_WIDTH = 288;
export const MIN_RAIL_WIDTH = 220;
export const MIN_INSPECTOR_WIDTH = 0;
export const ARCHIVE_PAGE_SIZE = 50;
export const LIVE_FIXTURE_TRACE_ID = "trace-fix-006";
const FIXTURE_TRACE_IDS = new Set(FIXTURE_DATASETS.map((dataset) => dataset.run.traceId));

export function buildFollowLiveMap(datasets: RunDataset[]) {
  return Object.fromEntries(datasets.map((dataset) => [dataset.run.traceId, dataset.run.liveMode === "live"])) as Record<string, boolean>;
}

export function buildCollapsedGapIds(datasets: RunDataset[]) {
  return Object.fromEntries(datasets.map((dataset) => [dataset.run.traceId, [] as string[]])) as Record<string, string[]>;
}

export function isFixtureDatasetTraceId(traceId: string) {
  return FIXTURE_TRACE_IDS.has(traceId);
}

export function stripFixtureDatasets(datasets: RunDataset[]) {
  return datasets.filter((dataset) => !isFixtureDatasetTraceId(dataset.run.traceId));
}

export function defaultSelectionForDataset(dataset: RunDataset): SelectionState | null {
  return dataset.run.selectedByDefaultId ? { kind: "event", id: dataset.run.selectedByDefaultId } : null;
}

export function liveSelectionForDataset(dataset: RunDataset): SelectionState | null {
  const latestEvent = dataset.events[dataset.events.length - 1];
  return latestEvent ? { kind: "event", id: latestEvent.eventId } : defaultSelectionForDataset(dataset);
}

export function activationSelectionForDataset(dataset: RunDataset): SelectionState | null {
  return dataset.run.liveMode === "live" ? liveSelectionForDataset(dataset) : defaultSelectionForDataset(dataset);
}

export function resolveDatasetDrawerTab(state: MonitorState, dataset: RunDataset) {
  return { drawerTab: dataset.run.rawIncluded || state.drawerTab !== "raw" ? state.drawerTab : "artifacts" };
}

type DatasetActivationPatch = Pick<
  MonitorState,
  | "activeRunId"
  | "selection"
  | "selectionNavigationRequestId"
  | "selectionNavigationRunId"
  | "collapsedGapIds"
  | "followLiveByRunId"
  | "liveConnectionByRunId"
  | "drawerTab"
>;

export function buildDatasetActivationPatch(state: MonitorState, dataset: RunDataset): DatasetActivationPatch {
  const followLive = dataset.run.liveMode === "live";
  const liveConnectionByRunId = followLive
    ? updateLiveConnectionMap({
        liveConnectionByRunId: state.liveConnectionByRunId,
        traceId: dataset.run.traceId,
        dataset,
        followLive: true,
      })
    : state.liveConnectionByRunId;

  return {
    activeRunId: dataset.run.traceId,
    selection: activationSelectionForDataset(dataset),
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
    collapsedGapIds: {
      ...state.collapsedGapIds,
      [dataset.run.traceId]: [],
    },
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [dataset.run.traceId]: followLive,
    },
    liveConnectionByRunId,
    ...resolveDatasetDrawerTab(state, dataset),
  };
}

export function upsertDataset(state: MonitorState, dataset: MonitorState["datasets"][number]) {
  return [dataset, ...state.datasets.filter((item) => item.run.traceId !== dataset.run.traceId)];
}

export function toggleGapIds(state: MonitorState, traceId: string, gapId: string) {
  const current = new Set(state.collapsedGapIds[traceId] ?? []);
  if (current.has(gapId)) {
    current.delete(gapId);
  } else {
    current.add(gapId);
  }
  return Array.from(current);
}

function resolveInitialActiveDataset() {
  const fallbackDataset = FIXTURE_DATASETS[0];
  if (!fallbackDataset) {
    throw new Error("fixture dataset missing");
  }

  return FIXTURE_DATASETS.find((item) => item.run.traceId === DEFAULT_ACTIVE_RUN_ID) ?? fallbackDataset;
}

function resolveInitialViewportMode() {
  return typeof window !== "undefined" ? window.innerWidth <= 720 : false;
}

function buildInitialDatasetState(activeDataset: RunDataset) {
  return {
    datasets: FIXTURE_DATASETS,
    hydratedDatasetsByFilePath: {},
    activeRunId: activeDataset.run.traceId,
    selection: defaultSelectionForDataset(activeDataset),
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
    followLiveByRunId: buildFollowLiveMap(FIXTURE_DATASETS),
    liveConnectionByRunId: buildConnectionMap(FIXTURE_DATASETS),
    collapsedGapIds: buildCollapsedGapIds(FIXTURE_DATASETS),
  };
}

function buildInitialPanelState(compactViewport: boolean): Pick<MonitorState, "drawerTab" | "drawerOpen" | "inspectorOpen" | "railWidth" | "inspectorWidth" | "importText" | "allowRawImport" | "noRawStorage" | "exportText" | "shortcutHelpOpen" | "appliedLiveFrames"> {
  return { drawerTab: "artifacts" as MonitorState["drawerTab"], drawerOpen: false, inspectorOpen: !compactViewport, railWidth: DEFAULT_RAIL_WIDTH, inspectorWidth: DEFAULT_INSPECTOR_WIDTH, importText: FIXTURE_IMPORT_TEXT, allowRawImport: false, noRawStorage: true, exportText: "", shortcutHelpOpen: false, appliedLiveFrames: 0 };
}

function buildInitialRequestState(): Pick<MonitorState, "recentIndex" | "recentIndexLoading" | "recentIndexReady" | "recentIndexError" | "selectionLoadState" | "recentSnapshotLoadingId" | "recentSnapshotRequestId" | "archivedIndex" | "archivedTotal" | "archivedHasMore" | "archivedSearch" | "archivedIndexLoading" | "archivedIndexError" | "archivedSnapshotLoading" | "archivedIndexRequestId" | "archivedSnapshotRequestId" | "archiveSectionOpen"> {
  return { recentIndex: [], recentIndexLoading: false, recentIndexReady: false, recentIndexError: null, selectionLoadState: null, recentSnapshotLoadingId: null, recentSnapshotRequestId: 0, archivedIndex: [], archivedTotal: 0, archivedHasMore: false, archivedSearch: "", archivedIndexLoading: false, archivedIndexError: null, archivedSnapshotLoading: false, archivedIndexRequestId: 0, archivedSnapshotRequestId: 0, archiveSectionOpen: false };
}

function buildInitialMonitorState(activeDataset: RunDataset, compactViewport: boolean): MonitorState {
  return { ...buildInitialDatasetState(activeDataset), ...buildInitialPanelState(compactViewport), ...buildInitialRequestState() };
}

export function createMonitorInitialState(): MonitorState {
  return buildInitialMonitorState(resolveInitialActiveDataset(), resolveInitialViewportMode());
}
