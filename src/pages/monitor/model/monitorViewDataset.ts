import {
  buildAnomalyJumps,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  type GraphSceneModel,
  hasRawPayload,
} from "../../../entities/run";
import { buildSelectionRevealTarget } from "./monitorViewSelection";
import type { MonitorState } from "./state";

export function resolveActiveDataset(state: MonitorState) {
  return (
    state.datasets.find((item) => item.run.traceId === state.activeRunId) ??
    state.datasets[0] ??
    null
  );
}

export const EMPTY_GRAPH_SCENE: GraphSceneModel = {
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

function resolveActiveFollowLive(
  activeDataset: MonitorState["datasets"][number] | null,
  state: MonitorState,
) {
  return activeDataset
    ? state.followLiveByRunId[activeDataset.run.traceId] ?? false
    : false;
}

function resolveActiveLiveConnection(
  activeDataset: MonitorState["datasets"][number] | null,
  state: MonitorState,
) {
  if (!activeDataset) {
    return "paused";
  }

  return (
    state.liveConnectionByRunId[activeDataset.run.traceId] ??
    (activeDataset.run.liveMode === "live" ? "live" : "paused")
  );
}

export function buildDatasetDerivedState(
  activeDataset: MonitorState["datasets"][number] | null,
  state: MonitorState,
  graphScene: GraphSceneModel,
) {
  return {
    activeFollowLive: resolveActiveFollowLive(activeDataset, state),
    activeLiveConnection: resolveActiveLiveConnection(activeDataset, state),
    rawTabAvailable: activeDataset ? hasRawPayload(activeDataset) : false,
    selectionRevealTarget: buildSelectionRevealTarget(
      activeDataset,
      state.selection,
      graphScene,
    ),
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
