import {
  formatDuration,
  formatTimestamp,
} from "../../../shared/lib/format/index.js";
import type {
  EventRecord,
  GraphSceneEdgeBundle,
  GraphSceneModel,
  GraphSceneRow,
  RunDataset,
  RunFilters,
  SelectionPath,
  SelectionState,
} from "../model/types.js";
import {
  buildEdgeMaps,
  buildLaneEventMaps,
  sortEvents,
} from "./selectorShared.js";

const GAP_THRESHOLD_MS = 30_000;
const LARGE_RUN_LANE_THRESHOLD = 8;

function formatGapLabel(durationMs: number, idleLaneCount: number) {
  return `// ${formatDuration(durationMs)} hidden · ${idleLaneCount} lanes idle //`;
}

function eventMatchesFilters(event: EventRecord, filters: RunFilters): boolean {
  if (filters.agentId && event.agentId !== filters.agentId) {
    return false;
  }

  if (filters.eventType !== "all" && event.eventType !== filters.eventType) {
    return false;
  }

  if (filters.errorOnly && event.status !== "failed" && event.eventType !== "error") {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const query = filters.search.toLowerCase();
  return [
    event.title,
    event.outputPreview ?? "",
    event.inputPreview ?? "",
    event.waitReason ?? "",
    event.errorMessage ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function resolveBaseEventIds(dataset: RunDataset, selection: SelectionState | null) {
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

function buildSelectionPath(
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

function buildGraphLanes(dataset: RunDataset) {
  const visibleLanes = dataset.lanes.filter(
    (lane, index) =>
      lane.role === "user" || index < LARGE_RUN_LANE_THRESHOLD || lane.laneStatus !== "done",
  );

  return {
    lanes: visibleLanes.map((lane) => ({
      laneId: lane.laneId,
      name: lane.name,
      role: lane.role,
      model: lane.model,
      badge: lane.badge,
      status: lane.laneStatus,
    })),
    hiddenLaneCount: Math.max(dataset.lanes.length - visibleLanes.length, 0),
  };
}

function buildGraphVisibleEvents(
  dataset: RunDataset,
  filters: RunFilters,
  selectionPath: SelectionPath,
) {
  const pathEventIds = new Set(selectionPath.eventIds);
  return sortEvents(dataset.events).filter((event) => {
    return pathEventIds.has(event.eventId) || eventMatchesFilters(event, filters);
  });
}

export function buildGraphSceneModel(
  dataset: RunDataset,
  filters: RunFilters,
  selection: SelectionState | null,
): GraphSceneModel {
  const selectionPath = buildSelectionPath(dataset, selection);
  const selectionPathEventIds = new Set(selectionPath.eventIds);
  const selectionPathEdgeIds = new Set(selectionPath.edgeIds);
  const visibleEvents = buildGraphVisibleEvents(dataset, filters, selectionPath);
  const hasMultiAgentTopology = dataset.lanes.length > 1 && dataset.edges.length > 0;
  const graphLanes = buildGraphLanes(dataset);
  const visibleLanes = graphLanes.lanes;
  const laneIds = new Set(visibleLanes.map((lane) => lane.laneId));
  const rows: GraphSceneRow[] = [];
  const visibleRowsByEventId = new Map<string, string>();
  const seenEventIds = new Set<string>();
  const visibleEventIdSet = new Set(visibleEvents.map((event) => event.eventId));

  visibleEvents.forEach((event, index) => {
    const previous = visibleEvents[index - 1];
    const previousEnd = previous ? previous.endTs ?? previous.startTs : null;
    const gap = previousEnd ? event.startTs - previousEnd : 0;
    if (gap >= GAP_THRESHOLD_MS && previousEnd !== null) {
      const gapStart = previousEnd;
      const gapEnd = event.startTs;
      const hiddenEventIds = dataset.events
        .filter(
          (candidate) =>
            candidate.startTs >= gapStart &&
            candidate.startTs < gapEnd &&
            !visibleEventIdSet.has(candidate.eventId),
        )
        .map((candidate) => candidate.eventId);
      rows.push({
        kind: "gap",
        id: `graph-gap-${previous?.eventId ?? "start"}-${event.eventId}`,
        label: formatGapLabel(gap, visibleLanes.length || 1),
        idleLaneCount: visibleLanes.length || 1,
        durationMs: gap,
        hiddenEventIds,
      });
    }

    if (!laneIds.has(event.laneId) || seenEventIds.has(event.eventId)) {
      return;
    }
    seenEventIds.add(event.eventId);

    const rowId = `graph-row-${event.eventId}`;
    visibleRowsByEventId.set(event.eventId, rowId);
    rows.push({
      kind: "event",
      id: rowId,
      eventId: event.eventId,
      laneId: event.laneId,
      title: event.title,
      summary: event.waitReason ?? event.outputPreview ?? event.inputPreview ?? "n/a",
      status: event.status,
      waitReason: event.waitReason,
      timeLabel: formatTimestamp(event.startTs),
      durationLabel: formatDuration(event.durationMs),
      inPath: hasMultiAgentTopology && selectionPathEventIds.has(event.eventId),
      selected: selection?.kind === "event" && selection.id === event.eventId,
      eventType: event.eventType,
      toolName: event.toolName,
    });
  });

  const visibleEventIds = new Set(
    rows.flatMap((row) => (row.kind === "event" ? [row.eventId] : [])),
  );
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));
  const edgeBundleMap = new Map<string, GraphSceneEdgeBundle>();

  dataset.edges
    .filter(
      (edge) =>
        visibleEventIds.has(edge.sourceEventId) &&
        visibleEventIds.has(edge.targetEventId) &&
        visibleRowsByEventId.has(edge.sourceEventId) &&
        visibleRowsByEventId.has(edge.targetEventId),
    )
    .forEach((edge) => {
      const sourceEvent = eventsById.get(edge.sourceEventId);
      const targetEvent = eventsById.get(edge.targetEventId);
      if (!sourceEvent || !targetEvent) {
        return;
      }

      const bundleKey = [
        edge.sourceEventId,
        edge.targetEventId,
        edge.edgeType,
        sourceEvent.laneId,
        targetEvent.laneId,
      ].join(":");
      const existing = edgeBundleMap.get(bundleKey);

      if (existing) {
        existing.edgeIds.push(edge.edgeId);
        existing.bundleCount += 1;
        existing.selected =
          existing.selected || (selection?.kind === "edge" && selection.id === edge.edgeId);
        if (!existing.label && edge.payloadPreview) {
          existing.label = edge.payloadPreview;
        }
        return;
      }

      edgeBundleMap.set(bundleKey, {
        id: bundleKey,
        primaryEdgeId: edge.edgeId,
        edgeIds: [edge.edgeId],
        sourceEventId: edge.sourceEventId,
        targetEventId: edge.targetEventId,
        sourceLaneId: sourceEvent.laneId,
        targetLaneId: targetEvent.laneId,
        edgeType: edge.edgeType,
        label: edge.payloadPreview ?? edge.edgeType,
        bundleCount: 1,
        inPath:
          hasMultiAgentTopology &&
          (selectionPathEdgeIds.has(edge.edgeId) ||
            (selectionPathEventIds.has(edge.sourceEventId) &&
              selectionPathEventIds.has(edge.targetEventId))),
        selected: selection?.kind === "edge" && selection.id === edge.edgeId,
      });
    });

  const edgeBundles = [...edgeBundleMap.values()].map((bundle) => ({
    ...bundle,
    label:
      bundle.bundleCount > 1 ? `${bundle.bundleCount} ${bundle.edgeType} events` : bundle.label,
  }));

  return {
    lanes: visibleLanes,
    rows,
    edgeBundles: edgeBundles.filter(
      (bundle) => laneIds.has(bundle.sourceLaneId) && laneIds.has(bundle.targetLaneId),
    ),
    selectionPath,
    hiddenLaneCount: graphLanes.hiddenLaneCount,
    latestVisibleEventId:
      [...rows]
        .reverse()
        .find((row) => row.kind === "event")
        ?.eventId ?? null,
  };
}
