import type {
  RunDataset,
  SelectionPath,
} from "../model/types.js";
import type {
  SelectionContext,
  SelectionTraversalState,
} from "./graphSelectionTraversalCore.js";
import { sortEvents } from "./selectorShared.js";

function includeTopologyEdge(
  state: SelectionTraversalState,
  edge: RunDataset["edges"][number],
) {
  state.edgeIds.add(edge.edgeId);
  state.eventIds.add(edge.sourceEventId);
  state.eventIds.add(edge.targetEventId);
}

function includeTopologyLane(
  args: {
    context: SelectionContext;
    state: SelectionTraversalState;
    edgeType: RunDataset["edges"][number]["edgeType"];
    targetEventId: string;
  },
) {
  if (args.edgeType !== "spawn") {
    return;
  }

  const targetEvent = args.context.eventsById.get(args.targetEventId);
  if (targetEvent) {
    args.state.laneIds.add(targetEvent.laneId);
  }
}

export function includeEdgeTopology(
  args: {
    dataset: RunDataset;
    context: SelectionContext;
    state: SelectionTraversalState;
    edgeType: RunDataset["edges"][number]["edgeType"];
  },
) {
  for (const edge of args.dataset.edges.filter((candidate) => candidate.edgeType === args.edgeType)) {
    includeTopologyEdge(args.state, edge);
    includeTopologyLane({
      context: args.context,
      state: args.state,
      edgeType: args.edgeType,
      targetEventId: edge.targetEventId,
    });
  }
}

export function includeSpawnLaneEvents(
  dataset: RunDataset,
  state: SelectionTraversalState,
) {
  if (state.laneIds.size === 0) {
    return;
  }

  for (const event of dataset.events) {
    if (state.laneIds.has(event.laneId)) {
      state.eventIds.add(event.eventId);
    }
  }
}

export function syncLaneIds(
  dataset: RunDataset,
  state: SelectionTraversalState,
) {
  for (const event of dataset.events) {
    if (state.eventIds.has(event.eventId)) {
      state.laneIds.add(event.laneId);
    }
  }
}

export function buildSelectionResult(
  dataset: RunDataset,
  state: SelectionTraversalState,
): SelectionPath {
  const orderedEventIds = sortEvents(dataset.events)
    .filter((event) => state.eventIds.has(event.eventId))
    .map((event) => event.eventId);
  const orderedEventIdSet = new Set(orderedEventIds);

  return {
    eventIds: [
      ...orderedEventIds,
      ...[...state.eventIds].filter((eventId) => !orderedEventIdSet.has(eventId)),
    ],
    edgeIds: dataset.edges
      .filter(
        (edge) =>
          state.edgeIds.has(edge.edgeId) ||
          (state.eventIds.has(edge.sourceEventId) && state.eventIds.has(edge.targetEventId)),
      )
      .map((edge) => edge.edgeId),
    laneIds: dataset.lanes
      .filter((lane) => state.laneIds.has(lane.laneId))
      .map((lane) => lane.laneId),
  };
}
