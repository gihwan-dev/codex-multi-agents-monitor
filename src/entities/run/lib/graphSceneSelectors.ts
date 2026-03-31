import type {
  GraphSceneModel,
  RunDataset,
  SelectionState,
} from "../model/types.js";
import {
  buildContextObservabilityBase,
  resolveContextObservability,
} from "./contextObservability.js";
import { buildGraphSceneEdgeBundles } from "./graphSceneEdgeBundles.js";
import { buildGraphSceneRows } from "./graphSceneRows.js";
import { buildSelectionPath } from "./graphSelectionPath.js";
import { sortEvents } from "./selectorShared.js";

const LARGE_RUN_LANE_THRESHOLD = 8;

interface BuildGraphSceneRowStateArgs {
  dataset: RunDataset;
  graphLanes: ReturnType<typeof buildGraphLanes>;
  selection: SelectionState | null;
  selectionPath: ReturnType<typeof buildSelectionPath>;
  contextObservabilityBase: ReturnType<typeof buildContextObservabilityBase>;
}

function toGraphLane(lane: RunDataset["lanes"][number]) {
  return {
    laneId: lane.laneId,
    name: lane.name,
    role: lane.role,
    model: lane.model,
    badge: lane.badge,
    status: lane.laneStatus,
  };
}

function buildGraphLanes(dataset: RunDataset) {
  const visibleLanes = dataset.lanes.filter(
    (lane, index) =>
      lane.role === "user" || index < LARGE_RUN_LANE_THRESHOLD || lane.laneStatus !== "done",
  );

  return {
    lanes: visibleLanes.map(toGraphLane),
    hiddenLaneCount: Math.max(dataset.lanes.length - visibleLanes.length, 0),
  };
}

function buildGraphVisibleEvents(dataset: RunDataset) {
  return sortEvents(dataset.events);
}

function buildGraphSceneRowState({
  dataset,
  graphLanes,
  selection,
  selectionPath,
  contextObservabilityBase,
}: BuildGraphSceneRowStateArgs) {
  const laneIds = new Set(graphLanes.lanes.map((lane) => lane.laneId));
  const selectionPathEventIds = new Set(selectionPath.eventIds);
  const hasMultiAgentTopology = dataset.lanes.length > 1 && dataset.edges.length > 0;

  return {
    laneIds,
    selectionPathEventIds,
    hasMultiAgentTopology,
    rowsResult: buildGraphSceneRows({
      contextPointsByEventId: contextObservabilityBase.pointsByEventId,
      dataset,
      visibleEvents: buildGraphVisibleEvents(dataset),
      laneIds,
      visibleLaneCount: graphLanes.lanes.length || 1,
      selection,
      selectionPathEventIds,
      hasMultiAgentTopology,
    }),
  };
}

export function buildGraphSceneModel(
  dataset: RunDataset,
  selection: SelectionState | null,
): GraphSceneModel {
  const selectionPath = buildSelectionPath(dataset, selection);
  const graphLanes = buildGraphLanes(dataset);
  const contextObservabilityBase = buildContextObservabilityBase(dataset);
  const { hasMultiAgentTopology, laneIds, rowsResult, selectionPathEventIds } =
    buildGraphSceneRowState({
      dataset,
      graphLanes,
      selection,
      selectionPath,
      contextObservabilityBase,
    });

  return {
    lanes: graphLanes.lanes,
    rows: rowsResult.rows,
    edgeBundles: buildGraphSceneEdgeBundles({
      dataset,
      laneIds,
      selection,
      selectionPathEventIds,
      selectionPathEdgeIds: new Set(selectionPath.edgeIds),
      hasMultiAgentTopology,
      visibleRowsByEventId: rowsResult.visibleRowsByEventId,
    }),
    contextObservability: resolveContextObservability({
      dataset,
      base: contextObservabilityBase,
      selection,
      fallbackEventId: rowsResult.latestVisibleEventId,
    }),
    selectionPath,
    hiddenLaneCount: graphLanes.hiddenLaneCount,
    latestVisibleEventId: rowsResult.latestVisibleEventId,
  };
}
