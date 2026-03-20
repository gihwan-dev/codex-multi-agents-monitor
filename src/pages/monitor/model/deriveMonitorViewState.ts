import {
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  hasRawPayload,
} from "../../../entities/run";
import { createDefaultFilters, type MonitorState } from "./state";

function resolveActiveDataset(state: MonitorState) {
  const activeDataset =
    state.datasets.find((item) => item.run.traceId === state.activeRunId) ??
    state.datasets[0];
  if (!activeDataset) {
    throw new Error("dataset missing");
  }
  return activeDataset;
}

export function deriveMonitorViewState(state: MonitorState) {
  const activeDataset = resolveActiveDataset(state);
  const activeFilters =
    state.filtersByRunId[activeDataset.run.traceId] ?? createDefaultFilters();
  const graphScene = buildGraphSceneModel(
    activeDataset,
    activeFilters,
    state.selection,
  );

  return {
    activeDataset,
    activeFilters,
    activeFollowLive: state.followLiveByRunId[activeDataset.run.traceId] ?? false,
    activeLiveConnection:
      state.liveConnectionByRunId[activeDataset.run.traceId] ??
      (activeDataset.run.liveMode === "live" ? "live" : "paused"),
    archivedIndexLoading: state.archivedIndexLoading,
    archivedIndexError: state.archivedIndexError,
    rawTabAvailable: hasRawPayload(activeDataset),
    graphScene,
    inspectorSummary: buildInspectorCausalSummary(
      activeDataset,
      state.selection,
      activeDataset.run.rawIncluded,
    ),
    summaryFacts: buildSummaryFacts(activeDataset, graphScene.selectionPath),
    anomalyJumps: buildAnomalyJumps(activeDataset),
  };
}
