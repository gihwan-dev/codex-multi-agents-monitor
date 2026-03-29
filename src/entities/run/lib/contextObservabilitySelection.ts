import type {
  ContextTimelinePoint,
  RunDataset,
  SelectionState,
} from "../model/types.js";

interface ResolveActiveEventIdArgs {
  dataset: RunDataset;
  fallbackEventId: string | null;
  pointsByEventId: Map<string, ContextTimelinePoint>;
  selection: SelectionState | null;
}

export function resolveActiveEventId(args: ResolveActiveEventIdArgs) {
  const { dataset, fallbackEventId, pointsByEventId, selection } = args;
  const selectedEventId = resolveSelectedEventId(dataset, selection);

  if (selectedEventId && pointsByEventId.has(selectedEventId)) {
    return selectedEventId;
  }

  return fallbackEventId;
}

export function resolveActiveEventTitle(dataset: RunDataset, activeEventId: string | null) {
  if (!activeEventId) {
    return null;
  }

  return dataset.events.find((event) => event.eventId === activeEventId)?.title ?? null;
}

function resolveSelectedEventId(dataset: RunDataset, selection: SelectionState | null) {
  if (!selection) {
    return null;
  }

  if (selection.kind === "event") {
    return selection.id;
  }

  return selection.kind === "edge"
    ? resolveEdgeSelectionEventId(dataset, selection.id)
    : resolveArtifactSelectionEventId(dataset, selection.id);
}

function resolveEdgeSelectionEventId(dataset: RunDataset, selectionId: string) {
  return dataset.edges.find((edge) => edge.edgeId === selectionId)?.targetEventId ?? null;
}

function resolveArtifactSelectionEventId(dataset: RunDataset, selectionId: string) {
  return (
    dataset.artifacts.find((artifact) => artifact.artifactId === selectionId)?.producerEventId ??
    null
  );
}
