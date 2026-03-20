import {
  formatDuration,
  formatTimestamp,
} from "../../../shared/lib/format/index.js";
import type {
  GraphSceneEdgeBundle,
  GraphSceneModel,
  GraphSceneRow,
  RunDataset,
  RunFilters,
  SelectionState,
} from "../model/types.js";
import {
  buildSelectionPath,
  eventMatchesFilters,
} from "./graphSelectionPath.js";
import { sortEvents } from "./selectorShared.js";

const GAP_THRESHOLD_MS = 30_000;
const LARGE_RUN_LANE_THRESHOLD = 8;

function formatGapLabel(durationMs: number, idleLaneCount: number) {
  return `// ${formatDuration(durationMs)} hidden · ${idleLaneCount} lanes idle //`;
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
  selectionEventIds: Set<string>,
) {
  return sortEvents(dataset.events).filter((event) => {
    return selectionEventIds.has(event.eventId) || eventMatchesFilters(event, filters);
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
  const visibleEvents = buildGraphVisibleEvents(dataset, filters, selectionPathEventIds);
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
