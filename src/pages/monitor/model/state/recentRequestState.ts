import {
  buildCollapsedGapIds,
  buildDatasetActivationPatch,
  buildFollowLiveMap,
  isFixtureDatasetTraceId,
  stripFixtureDatasets,
  upsertDataset,
} from "./helpers";
import { buildConnectionMap } from "./liveConnection";
import {
  buildRecentIndexSelectionPatch,
} from "./recentRequestSelection";
import { createSelectionLoadState } from "./selectionLoadState";
import type { MonitorState } from "./types";

export function beginRecentIndexRequest(state: MonitorState): MonitorState {
  const datasets = stripFixtureDatasets(state.datasets);
  const fixtureActive = isFixtureDatasetTraceId(state.activeRunId);

  return {
    ...state,
    datasets,
    recentIndexLoading: true,
    recentIndexError: null,
    selectionLoadState: createSelectionLoadState("recent", null, "indexing_recent"),
    activeRunId: fixtureActive ? "" : state.activeRunId,
    selection: fixtureActive ? null : state.selection,
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
    followLiveByRunId: buildFollowLiveMap(datasets),
    liveConnectionByRunId: buildConnectionMap(datasets),
    collapsedGapIds: buildCollapsedGapIds(datasets),
  };
}

export function resolveRecentIndexRequest(
  state: MonitorState,
  items: MonitorState["recentIndex"],
): MonitorState {
  const datasets = stripFixtureDatasets(state.datasets);
  const fixtureActive = isFixtureDatasetTraceId(state.activeRunId);
  const nextActiveRunId = "";

  return {
    ...state,
    datasets,
    recentIndex: items,
    recentIndexLoading: false,
    recentIndexReady: true,
    recentIndexError: null,
    selectionLoadState:
      state.selectionLoadState?.phase === "indexing_recent"
        ? null
        : state.selectionLoadState,
    followLiveByRunId: buildFollowLiveMap(datasets),
    liveConnectionByRunId: buildConnectionMap(datasets),
    collapsedGapIds: buildCollapsedGapIds(datasets),
    ...buildRecentIndexSelectionPatch(state, nextActiveRunId, fixtureActive),
  };
}

export function finishRecentIndexRequest(
  state: MonitorState,
  error?: string | null,
): MonitorState {
  return {
    ...state,
    recentIndexLoading: false,
    recentIndexReady: true,
    recentIndexError: error ?? null,
    selectionLoadState:
      state.selectionLoadState?.phase === "indexing_recent"
        ? null
        : state.selectionLoadState,
  };
}

export function beginRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
  filePath: string,
): MonitorState {
  const activeRecentItem =
    state.recentIndex.find((item) => item.filePath === filePath) ?? null;

  return {
    ...state,
    activeRunId: activeRecentItem?.sessionId ?? state.activeRunId,
    selection: null,
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
    recentSnapshotLoadingId: filePath,
    recentSnapshotRequestId: requestId,
    selectionLoadState: createSelectionLoadState(
      "recent",
      filePath,
      "loading_snapshot",
    ),
  };
}

export function beginRecentSnapshotBuild(
  state: MonitorState,
  requestId: number,
  filePath: string,
): MonitorState {
  if (requestId !== state.recentSnapshotRequestId) {
    return state;
  }

  return {
    ...state,
    selectionLoadState: createSelectionLoadState(
      "recent",
      filePath,
      "building_graph",
    ),
  };
}

export function resolveRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
  ...rest: [filePath: string, dataset: MonitorState["datasets"][number]]
): MonitorState {
  const [filePath, dataset] = rest;
  if (requestId !== state.recentSnapshotRequestId) {
    return state;
  }

  const nextState = {
    ...state,
    recentSnapshotLoadingId: null,
    selectionLoadState: null,
    hydratedDatasetsByFilePath: {
      ...state.hydratedDatasetsByFilePath,
      [filePath]: dataset,
    },
    datasets: upsertDataset(state, dataset),
  };

  return {
    ...nextState,
    ...buildDatasetActivationPatch(nextState, dataset),
  };
}

export function cancelRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
): MonitorState {
  return {
    ...state,
    recentSnapshotLoadingId: null,
    recentSnapshotRequestId: requestId,
    selectionLoadState:
      state.selectionLoadState?.source === "recent" ? null : state.selectionLoadState,
  };
}

export function finishRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
): MonitorState {
  return requestId === state.recentSnapshotRequestId
    ? { ...state, recentSnapshotLoadingId: null, selectionLoadState: null }
    : state;
}
