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
    const incoming = incomingByEventId.get(edge.targetEventId);
    if (incoming) {
      incoming.push(edge);
    } else {
      incomingByEventId.set(edge.targetEventId, [edge]);
    }

    const outgoing = outgoingByEventId.get(edge.sourceEventId);
    if (outgoing) {
      outgoing.push(edge);
    } else {
      outgoingByEventId.set(edge.sourceEventId, [edge]);
    }
  });

  return {
    incomingByEventId,
    outgoingByEventId,
  };
}

export function buildLaneEventMaps(dataset: RunDataset) {
  const orderedByLaneId = new Map<string, EventRecord[]>();
  const buckets = new Map<string, EventRecord[]>();

  dataset.events.forEach((event) => {
    const bucket = buckets.get(event.laneId);
    if (bucket) {
      bucket.push(event);
    } else {
      buckets.set(event.laneId, [event]);
    }
  });

  dataset.lanes.forEach((lane) => {
    orderedByLaneId.set(lane.laneId, sortEvents(buckets.get(lane.laneId) ?? []));
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
