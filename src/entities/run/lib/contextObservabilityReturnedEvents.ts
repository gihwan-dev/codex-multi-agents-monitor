import type { EventRecord, RunDataset } from "../model/types.js";
import { CROSS_LANE_RETURN_EDGE_TYPES } from "./contextObservabilityShared.js";

export function buildReturnedEventIdsByLane(dataset: RunDataset) {
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));
  return dataset.edges.reduce(
    (returnedEventIdsByLane, edge) =>
      appendReturnedEventId(returnedEventIdsByLane, resolveReturnedSourceEvent(edge, eventsById)),
    new Map<string, Set<string>>(),
  );
}

function resolveReturnedSourceEvent(
  edge: RunDataset["edges"][number],
  eventsById: Map<string, EventRecord>,
) {
  if (!CROSS_LANE_RETURN_EDGE_TYPES.has(edge.edgeType)) {
    return null;
  }

  const sourceEvent = eventsById.get(edge.sourceEventId);
  const targetEvent = eventsById.get(edge.targetEventId);
  if (!sourceEvent || !targetEvent || sourceEvent.laneId === targetEvent.laneId) {
    return null;
  }

  return sourceEvent;
}

function appendReturnedEventId(
  returnedEventIdsByLane: Map<string, Set<string>>,
  sourceEvent: EventRecord | null,
) {
  if (!sourceEvent) {
    return returnedEventIdsByLane;
  }

  const laneEventIds = returnedEventIdsByLane.get(sourceEvent.laneId) ?? new Set<string>();
  laneEventIds.add(sourceEvent.eventId);
  returnedEventIdsByLane.set(sourceEvent.laneId, laneEventIds);

  return returnedEventIdsByLane;
}
