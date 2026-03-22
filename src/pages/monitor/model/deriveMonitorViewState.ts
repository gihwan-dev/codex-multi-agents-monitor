import {
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  type GraphSceneModel,
  hasRawPayload,
} from "../../../entities/run";
import type { MonitorState } from "./state";
import { describeSelectionLoadState } from "./state/selectionLoadState";

function resolveActiveDataset(state: MonitorState) {
  return (
    state.datasets.find((item) => item.run.traceId === state.activeRunId) ??
    state.datasets[0] ??
    null
  );
}

const EMPTY_GRAPH_SCENE: GraphSceneModel = {
  lanes: [],
  rows: [],
  edgeBundles: [],
  selectionPath: {
    eventIds: [],
    edgeIds: [],
    laneIds: [],
  },
  hiddenLaneCount: 0,
  latestVisibleEventId: null,
};

function resolveActiveSessionFilePath(state: MonitorState) {
  if (state.selectionLoadState?.filePath) {
    return state.selectionLoadState.filePath;
  }

  return (
    Object.entries(state.hydratedDatasetsByFilePath).find(
      ([, dataset]) => dataset.run.traceId === state.activeRunId,
    )?.[0] ?? null
  );
}

export function deriveMonitorViewState(state: MonitorState) {
  const activeDataset = resolveActiveDataset(state);
  const graphScene = activeDataset
    ? buildGraphSceneModel(activeDataset, state.selection)
    : EMPTY_GRAPH_SCENE;
  const selectionLoadState = state.selectionLoadState;
  const selectionLoadingPresentation =
    describeSelectionLoadState(selectionLoadState);
  const activeSessionFilePath = resolveActiveSessionFilePath(state);

  return {
    activeDataset,
    activeSessionFilePath,
    activeFollowLive: activeDataset
      ? state.followLiveByRunId[activeDataset.run.traceId] ?? false
      : false,
    activeLiveConnection:
      activeDataset
        ? state.liveConnectionByRunId[activeDataset.run.traceId] ??
          (activeDataset.run.liveMode === "live" ? "live" : "paused")
        : "paused",
    recentIndexReady: state.recentIndexReady,
    recentIndexLoading: state.recentIndexLoading,
    recentIndexError: state.recentIndexError,
    archivedIndexLoading: state.archivedIndexLoading,
    archivedIndexError: state.archivedIndexError,
    selectionLoadState,
    selectionLoadingPresentation,
    rawTabAvailable: activeDataset ? hasRawPayload(activeDataset) : false,
    graphScene,
    inspectorSummary: activeDataset
      ? buildInspectorCausalSummary(
          activeDataset,
          state.selection,
          activeDataset.run.rawIncluded,
        )
      : null,
    summaryFacts: activeDataset
      ? buildSummaryFacts(activeDataset, graphScene.selectionPath)
      : [],
    anomalyJumps: activeDataset ? buildAnomalyJumps(activeDataset) : [],
  };
}
