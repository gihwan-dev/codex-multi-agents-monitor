import {
  buildCollapsedGapIds,
  buildDatasetActivationPatch,
  buildFollowLiveMap,
  isFixtureDatasetTraceId,
  stripFixtureDatasets,
  upsertDataset,
} from "./helpers";
import { buildConnectionMap } from "./liveConnection";
import type { MonitorState } from "./types";

export function beginRecentIndexRequest(state: MonitorState): MonitorState {
  return {
    ...state,
    recentIndexLoading: true,
    recentIndexError: null,
  };
}

export function resolveRecentIndexRequest(
  state: MonitorState,
  items: MonitorState["recentIndex"],
): MonitorState {
  const datasets = stripFixtureDatasets(state.datasets);
  const fixtureActive = isFixtureDatasetTraceId(state.activeRunId);
  const nextActiveRunId = fixtureActive ? (items[0]?.sessionId ?? "") : state.activeRunId;

  return {
    ...state,
    datasets,
    recentIndex: items,
    recentIndexLoading: false,
    recentIndexReady: true,
    recentIndexError: null,
    activeRunId: nextActiveRunId,
    selection: fixtureActive ? null : state.selection,
    followLiveByRunId: buildFollowLiveMap(datasets),
    liveConnectionByRunId: buildConnectionMap(datasets),
    collapsedGapIds: buildCollapsedGapIds(datasets),
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
  };
}

export function beginRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
  filePath: string,
): MonitorState {
  return {
    ...state,
    recentSnapshotLoadingId: filePath,
    recentSnapshotRequestId: requestId,
  };
}

export function resolveRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
  filePath: string,
  dataset: MonitorState["datasets"][number],
): MonitorState {
  if (requestId !== state.recentSnapshotRequestId) {
    return state;
  }

  const nextState = {
    ...state,
    recentSnapshotLoadingId: null,
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

export function finishRecentSnapshotRequest(
  state: MonitorState,
  requestId: number,
): MonitorState {
  return requestId === state.recentSnapshotRequestId
    ? { ...state, recentSnapshotLoadingId: null }
    : state;
}
