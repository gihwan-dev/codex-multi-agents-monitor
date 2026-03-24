import { resolveFixtureFrameSnapshot } from "./datasetFixtureFrame";
import {
  findDatasetByTraceId,
  getActiveDataset,
  resolveFixtureFrameSelection,
  shouldPauseFollowLiveForManualNavigation,
} from "./datasetStateShared";
import { resolveFollowLiveConnectionState } from "./followLiveConnectionState";
import {
  activationSelectionForDataset,
  buildCollapsedGapIds,
  buildDatasetActivationPatch,
  buildFollowLiveMap,
  resolveDatasetDrawerTab,
  toggleGapIds,
  upsertDataset,
} from "./helpers";
import { buildConnectionMap, updateLiveConnectionMap } from "./liveConnection";
import type { MonitorState } from "./types";

export function setActiveRunState(state: MonitorState, traceId: string): MonitorState {
  const dataset = findDatasetByTraceId(state.datasets, traceId);
  if (!dataset) {
    return {
      ...state,
      activeRunId: traceId,
      selection: null,
      selectionNavigationRequestId: 0,
      selectionNavigationRunId: null,
    };
  }

  const followLive = dataset.run.liveMode === "live";

  return {
    ...state,
    activeRunId: traceId,
    selection: activationSelectionForDataset(dataset),
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
    followLiveByRunId: followLive
      ? {
          ...state.followLiveByRunId,
          [traceId]: true,
        }
      : state.followLiveByRunId,
    liveConnectionByRunId: followLive
      ? updateLiveConnectionMap({
          liveConnectionByRunId: state.liveConnectionByRunId,
          traceId,
          dataset,
          followLive: true,
        })
      : state.liveConnectionByRunId,
    ...resolveDatasetDrawerTab(state, dataset),
  };
}

export function navigateSelectionState(
  state: MonitorState,
  selection: NonNullable<MonitorState["selection"]>,
): MonitorState {
  const activeDataset = getActiveDataset(state);
  const shouldPauseFollowLive = shouldPauseFollowLiveForManualNavigation(state, selection);

  return {
    ...state,
    selection,
    selectionNavigationRequestId: state.selectionNavigationRequestId + 1,
    selectionNavigationRunId: activeDataset?.run.traceId ?? null,
    followLiveByRunId:
      shouldPauseFollowLive && activeDataset
        ? {
            ...state.followLiveByRunId,
            [activeDataset.run.traceId]: false,
          }
        : state.followLiveByRunId,
    liveConnectionByRunId:
      shouldPauseFollowLive && activeDataset
        ? updateLiveConnectionMap({
            liveConnectionByRunId: state.liveConnectionByRunId,
            traceId: activeDataset.run.traceId,
            dataset: activeDataset,
            followLive: false,
          })
        : state.liveConnectionByRunId,
  };
}

export function toggleFollowLiveState(
  state: MonitorState,
  traceId: string,
): MonitorState {
  const dataset = findDatasetByTraceId(state.datasets, traceId);
  if (!dataset || dataset.run.liveMode !== "live") {
    return state;
  }

  const nextFollow = !(state.followLiveByRunId[traceId] ?? false);
  const liveConnectionByRunId = updateLiveConnectionMap({
    liveConnectionByRunId: state.liveConnectionByRunId,
    traceId,
    dataset,
    followLive: nextFollow,
  });
  return {
    ...state,
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [traceId]: nextFollow,
    },
    liveConnectionByRunId,
  };
}

export function setFollowLiveState(
  state: MonitorState,
  traceId: string,
  value: boolean,
): MonitorState {
  const dataset = findDatasetByTraceId(state.datasets, traceId);
  const liveConnectionByRunId = resolveFollowLiveConnectionState({
    state,
    traceId,
    value,
    dataset,
  });

  return {
    ...state,
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [traceId]: value,
    },
    liveConnectionByRunId,
  };
}

export function toggleGapState(
  state: MonitorState,
  traceId: string,
  gapId: string,
): MonitorState {
  return {
    ...state,
    collapsedGapIds: {
      ...state.collapsedGapIds,
      [traceId]: toggleGapIds(state, traceId, gapId),
    },
  };
}

export function importDatasetState(
  state: MonitorState,
  dataset: MonitorState["datasets"][number],
): MonitorState {
  return {
    ...state,
    datasets: upsertDataset(state, dataset),
    ...buildDatasetActivationPatch(state, dataset),
    drawerTab: "artifacts",
    drawerOpen: true,
  };
}

export function replaceDatasetsState(
  state: MonitorState,
  datasets: MonitorState["datasets"],
): MonitorState {
  if (!datasets.length) {
    return state;
  }

  const activeDataset =
    datasets.find((item) => item.run.traceId === state.activeRunId) ?? datasets[0];

  return {
    ...state,
    datasets,
    activeRunId: activeDataset.run.traceId,
    selection: activationSelectionForDataset(activeDataset),
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
    followLiveByRunId: buildFollowLiveMap(datasets),
    liveConnectionByRunId: buildConnectionMap(datasets),
    collapsedGapIds: buildCollapsedGapIds(datasets),
    ...resolveDatasetDrawerTab(state, activeDataset),
    appliedLiveFrames: 0,
  };
}

export function applyFixtureFrameState(state: MonitorState): MonitorState {
  const frameUpdate = resolveFixtureFrameSnapshot(state);
  if (!frameUpdate) {
    return state;
  }

  const { followLive, snapshot, traceId } = frameUpdate;

  return {
    ...state,
    datasets: state.datasets.map((item) =>
      item.run.traceId === traceId ? snapshot.dataset : item,
    ),
    liveConnectionByRunId: updateLiveConnectionMap({ liveConnectionByRunId: state.liveConnectionByRunId, traceId, dataset: snapshot.dataset, followLive, nextConnection: snapshot.connection }),
    selection: resolveFixtureFrameSelection(state, snapshot.dataset),
    appliedLiveFrames: state.appliedLiveFrames + 1,
  };
}
