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
  contextObservability: {
    activeEventId: null,
    activeEventTitle: null,
    activeLaneId: null,
    activeSource: "latest",
    activeContextWindowTokens: 0,
    activeCumulativeContextTokens: 0,
    peakContextWindowTokens: 0,
    peakCumulativeContextTokens: 0,
    maxContextWindowTokens: null,
    laneSummaries: [],
    timelinePoints: [],
    pointsByEventId: new Map(),
  },
  selectionPath: {
    eventIds: [],
    edgeIds: [],
    laneIds: [],
  },
  hiddenLaneCount: 0,
  latestVisibleEventId: null,
};

function resolveLastHandoffFromJumps(
  activeDataset: MonitorState["datasets"][number],
  anomalyJumps: ReturnType<typeof buildAnomalyJumps>,
) {
  for (const jump of anomalyJumps) {
    if (jump.selection.kind !== "edge") {
      continue;
    }

    const edge = activeDataset.edges.find((candidate) => candidate.edgeId === jump.selection.id);
    if (edge?.edgeType === "handoff") {
      return edge;
    }
  }

  return null;
}

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
  const anomalyJumps = activeDataset ? buildAnomalyJumps(activeDataset) : [];
  const lastHandoff = activeDataset
    ? resolveLastHandoffFromJumps(activeDataset, anomalyJumps)
    : null;

  return {
    activeFollowLive: resolveActiveFollowLive(activeDataset, state),
    activeLiveConnection: resolveActiveLiveConnection(activeDataset, state),
    rawTabAvailable: activeDataset ? hasRawPayload(activeDataset) : false,
    selectionRevealTarget: buildSelectionRevealTarget({
      activeDataset,
      selection: state.selection,
      graphScene,
    }),
    inspectorSummary: activeDataset
      ? buildInspectorCausalSummary(
          activeDataset,
          state.selection,
          activeDataset.run.rawIncluded,
        )
      : null,
    contextObservability: activeDataset ? graphScene.contextObservability : null,
    summaryFacts: activeDataset
      ? buildSummaryFacts(activeDataset, graphScene.selectionPath, lastHandoff)
      : [],
    anomalyJumps,
  };
}
