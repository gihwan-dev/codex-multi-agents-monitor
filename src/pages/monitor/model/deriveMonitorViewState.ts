import {
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  type GraphSceneModel,
  hasRawPayload,
} from "../../../entities/run";
import type { MonitorState } from "./state";

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

export function deriveMonitorViewState(state: MonitorState) {
  const activeDataset = resolveActiveDataset(state);
  const graphScene = activeDataset
    ? buildGraphSceneModel(activeDataset, state.selection)
    : EMPTY_GRAPH_SCENE;

  return {
    activeDataset,
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
    recentSnapshotLoadingId: state.recentSnapshotLoadingId,
    archivedIndexLoading: state.archivedIndexLoading,
    archivedIndexError: state.archivedIndexError,
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
