import type {
  RunDataset,
  SelectionPath,
  SelectionState,
} from "../model/types.js";
import {
  buildEdgeMaps,
  buildLaneEventMaps,
  sortEvents,
} from "./selectorShared.js";

function resolveBaseEventIds(
  dataset: RunDataset,
  selection: SelectionState | null,
) {
  if (!selection) {
    return dataset.run.selectedByDefaultId ? [dataset.run.selectedByDefaultId] : [];
  }

  if (selection.kind === "event") {
    return [selection.id];
  }

  if (selection.kind === "edge") {
    const edge = dataset.edges.find((item) => item.edgeId === selection.id);
    return edge ? [edge.sourceEventId, edge.targetEventId] : [];
  }

  const artifact = dataset.artifacts.find((item) => item.artifactId === selection.id);
  return artifact ? [artifact.producerEventId] : [];
}

export function buildSelectionPath(
  dataset: RunDataset,
  selection: SelectionState | null,
): SelectionPath {
  const maxDepth = 3;
  const baseEventIds = resolveBaseEventIds(dataset, selection);
  const eventIds = new Set<string>(baseEventIds);
  const edgeIds = new Set<string>();
  const laneIds = new Set<string>();
  const visited = new Set<string>();
  const queue = baseEventIds.map((eventId) => ({ eventId, depth: 0 }));
  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const { previousByEventId, nextByEventId } = buildLaneEventMaps(dataset);
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));

  while (queue.length && visited.size < 24) {
    const current = queue.shift();
    if (!current || visited.has(current.eventId)) {
      continue;
    }

    visited.add(current.eventId);
    const event = eventsById.get(current.eventId);
    if (!event) {
      continue;
    }

    eventIds.add(event.eventId);
    laneIds.add(event.laneId);

    if (current.depth >= maxDepth) {
      continue;
    }

    const enqueue = (eventId: string | null | undefined) => {
      if (!eventId || visited.has(eventId)) {
        return;
      }
      queue.push({ eventId, depth: current.depth + 1 });
    };

    enqueue(previousByEventId.get(event.eventId)?.eventId);
    enqueue(nextByEventId.get(event.eventId)?.eventId);
    enqueue(event.parentId);

    dataset.events
      .filter((candidate) => candidate.parentId === event.eventId)
      .forEach((candidate) => {
        enqueue(candidate.eventId);
      });

    (incomingByEventId.get(event.eventId) ?? []).forEach((edge) => {
      edgeIds.add(edge.edgeId);
      enqueue(edge.sourceEventId);
    });

    (outgoingByEventId.get(event.eventId) ?? []).forEach((edge) => {
      edgeIds.add(edge.edgeId);
      enqueue(edge.targetEventId);
    });
  }

  // Always include spawn topology in the selection path.
  // Spawn edges create parallel execution branches that BFS
  // may not reach when the source event is far from the selection origin.
  const spawnTargetLaneIds = new Set<string>();
  dataset.edges
    .filter((edge) => edge.edgeType === "spawn")
    .forEach((edge) => {
      edgeIds.add(edge.edgeId);
      eventIds.add(edge.sourceEventId);
      eventIds.add(edge.targetEventId);
      const targetEvent = eventsById.get(edge.targetEventId);
      if (targetEvent) {
        spawnTargetLaneIds.add(targetEvent.laneId);
      }
    });

  dataset.events.forEach((event) => {
    if (spawnTargetLaneIds.has(event.laneId)) {
      eventIds.add(event.eventId);
    }
  });

  // Always include merge topology in the selection path.
  // Merge edges represent join points where subagent results flow back
  // to the parent, completing the fork-join causal graph.
  dataset.edges
    .filter((edge) => edge.edgeType === "merge")
    .forEach((edge) => {
      edgeIds.add(edge.edgeId);
      eventIds.add(edge.sourceEventId);
      eventIds.add(edge.targetEventId);
    });

  dataset.events
    .filter((event) => eventIds.has(event.eventId))
    .forEach((event) => {
      laneIds.add(event.laneId);
    });

  return {
    eventIds: sortEvents(dataset.events)
      .filter((event) => eventIds.has(event.eventId))
      .map((event) => event.eventId),
    edgeIds: dataset.edges
      .filter(
        (edge) =>
          edgeIds.has(edge.edgeId) ||
          (eventIds.has(edge.sourceEventId) && eventIds.has(edge.targetEventId)),
      )
      .map((edge) => edge.edgeId),
    laneIds: dataset.lanes
      .filter((lane) => laneIds.has(lane.laneId))
      .map((lane) => lane.laneId),
  };
}
