import type { EventRecord, RunDataset } from "../model/types.js";

const SORTED_EVENT_CACHE = new WeakMap<EventRecord[], EventRecord[]>();

export function sortEvents(events: EventRecord[]) {
  const cached = SORTED_EVENT_CACHE.get(events);
  if (cached) {
    return cached;
  }

  const sorted = [...events].sort((left, right) => left.startTs - right.startTs);
  SORTED_EVENT_CACHE.set(events, sorted);
  return sorted;
}

export function buildEdgeMaps(dataset: RunDataset) {
  const incomingByEventId = new Map<string, RunDataset["edges"]>();
  const outgoingByEventId = new Map<string, RunDataset["edges"]>();

  dataset.edges.forEach((edge) => {
    incomingByEventId.set(edge.targetEventId, [
      ...(incomingByEventId.get(edge.targetEventId) ?? []),
      edge,
    ]);
    outgoingByEventId.set(edge.sourceEventId, [
      ...(outgoingByEventId.get(edge.sourceEventId) ?? []),
      edge,
    ]);
  });

  return {
    incomingByEventId,
    outgoingByEventId,
  };
}

export function buildLaneEventMaps(dataset: RunDataset) {
  const orderedByLaneId = new Map<string, EventRecord[]>();

  dataset.lanes.forEach((lane) => {
    orderedByLaneId.set(
      lane.laneId,
      sortEvents(dataset.events.filter((event) => event.laneId === lane.laneId)),
    );
  });

  const previousByEventId = new Map<string, EventRecord>();
  const nextByEventId = new Map<string, EventRecord>();

  orderedByLaneId.forEach((events) => {
    events.forEach((event, index) => {
      const previous = events[index - 1];
      const next = events[index + 1];
      if (previous) {
        previousByEventId.set(event.eventId, previous);
      }
      if (next) {
        nextByEventId.set(event.eventId, next);
      }
    });
  });

  return {
    orderedByLaneId,
    previousByEventId,
    nextByEventId,
  };
}
