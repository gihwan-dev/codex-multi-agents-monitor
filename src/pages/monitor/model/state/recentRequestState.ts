import {
  buildCollapsedGapIds,
  buildDatasetActivationPatch,
  buildFollowLiveMap,
  defaultSelectionForDataset,
  isFixtureDatasetTraceId,
  resolveDatasetDrawerTab,
  stripFixtureDatasets,
  upsertDataset,
} from "./helpers";
import { buildConnectionMap, updateLiveConnectionMap } from "./liveConnection";
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
  const nextActiveRunId = fixtureActive ? (items[0]?.sessionId ?? "") : state.activeRunId;

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
    activeRunId: nextActiveRunId,
    selection: fixtureActive ? null : state.selection,
    selectionNavigationRequestId: fixtureActive ? 0 : state.selectionNavigationRequestId,
    selectionNavigationRunId: fixtureActive ? null : state.selectionNavigationRunId,
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
  filePath: string,
  dataset: MonitorState["datasets"][number],
): MonitorState {
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

function resolveSelectionAfterRecentRefresh(
  state: MonitorState,
  dataset: MonitorState["datasets"][number],
  followLive: boolean,
) {
  if (state.activeRunId !== dataset.run.traceId) {
    return state.selection;
  }

  const latestEvent = dataset.events[dataset.events.length - 1];
  if (followLive && latestEvent) {
    return { kind: "event" as const, id: latestEvent.eventId };
  }

  if (!state.selection) {
    return defaultSelectionForDataset(dataset);
  }

  if (
    state.selection.kind === "event" &&
    dataset.events.some((event) => event.eventId === state.selection?.id)
  ) {
    return state.selection;
  }

  if (
    state.selection.kind === "edge" &&
    dataset.edges.some((edge) => edge.edgeId === state.selection?.id)
  ) {
    return state.selection;
  }

  if (
    state.selection.kind === "artifact" &&
    dataset.artifacts.some((artifact) => artifact.artifactId === state.selection?.id)
  ) {
    return state.selection;
  }

  return defaultSelectionForDataset(dataset);
}

export function refreshRecentSnapshot(
  state: MonitorState,
  filePath: string,
  dataset: MonitorState["datasets"][number],
): MonitorState {
  const nextFollowLive =
    dataset.run.liveMode === "live"
      ? (state.followLiveByRunId[dataset.run.traceId] ?? true)
      : false;
  const { [dataset.run.traceId]: _removedConnection, ...remainingConnections } =
    state.liveConnectionByRunId;

  return {
    ...state,
    hydratedDatasetsByFilePath: {
      ...state.hydratedDatasetsByFilePath,
      [filePath]: dataset,
    },
    datasets: upsertDataset(state, dataset),
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [dataset.run.traceId]: nextFollowLive,
    },
    liveConnectionByRunId:
      dataset.run.liveMode === "live"
        ? updateLiveConnectionMap(
            state.liveConnectionByRunId,
            dataset.run.traceId,
            dataset,
            nextFollowLive,
          )
        : remainingConnections,
    selection: resolveSelectionAfterRecentRefresh(state, dataset, nextFollowLive),
    ...resolveDatasetDrawerTab(state, dataset),
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
