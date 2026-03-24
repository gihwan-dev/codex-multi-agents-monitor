import type {
  RunDataset,
  SelectionPath,
  SelectionState,
} from "../model/types.js";
import { buildSelectionPathFromBaseEvents } from "./graphSelectionTraversal.js";

function resolveSelectedEdgeEventIds(dataset: RunDataset, edgeId: string) {
  const edge = dataset.edges.find((item) => item.edgeId === edgeId);
  return edge ? [edge.sourceEventId, edge.targetEventId] : [];
}

function resolveArtifactProducerEventIds(dataset: RunDataset, artifactId: string) {
  const artifact = dataset.artifacts.find((item) => item.artifactId === artifactId);
  return artifact ? [artifact.producerEventId] : [];
}

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

  return selection.kind === "edge"
    ? resolveSelectedEdgeEventIds(dataset, selection.id)
    : resolveArtifactProducerEventIds(dataset, selection.id);
}

export function buildSelectionPath(
  dataset: RunDataset,
  selection: SelectionState | null,
): SelectionPath {
  return buildSelectionPathFromBaseEvents(dataset, resolveBaseEventIds(dataset, selection));
}
