import type {
  EventSelectionRevealTarget,
  GraphSelectionRevealTarget,
  RunDataset,
  SelectionState,
} from "../../../entities/run";

export function buildEventRevealTarget(
  selection: SelectionState,
  visibleEventIds: Set<string>,
): EventSelectionRevealTarget | null {
  return selection.kind === "event" && visibleEventIds.has(selection.id)
    ? { kind: "event", eventId: selection.id }
    : null;
}

export function buildEdgeRevealTarget(
  dataset: RunDataset,
  selection: SelectionState,
  visibleEventIds: Set<string>,
): GraphSelectionRevealTarget | null {
  if (selection.kind !== "edge") {
    return null;
  }

  const edge = dataset.edges.find((item) => item.edgeId === selection.id);
  return edge && visibleEventIds.has(edge.sourceEventId) && visibleEventIds.has(edge.targetEventId)
    ? { kind: "edge", edgeId: edge.edgeId, sourceEventId: edge.sourceEventId, targetEventId: edge.targetEventId }
    : null;
}

export function buildArtifactRevealTarget(
  dataset: RunDataset,
  selection: SelectionState,
  visibleEventIds: Set<string>,
): GraphSelectionRevealTarget | null {
  if (selection.kind !== "artifact") {
    return null;
  }

  const artifact = dataset.artifacts.find((item) => item.artifactId === selection.id);
  return artifact && visibleEventIds.has(artifact.producerEventId)
    ? { kind: "artifact", artifactId: artifact.artifactId, producerEventId: artifact.producerEventId }
    : null;
}
