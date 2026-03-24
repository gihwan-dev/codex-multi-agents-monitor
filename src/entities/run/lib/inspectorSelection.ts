import type {
  EventRecord,
  RunDataset,
  SelectionState,
} from "../model/types.js";
import { buildEdgeMaps, buildLaneEventMaps } from "./selectorShared.js";

export type InspectorSelectionDetails =
  | EventRecord
  | RunDataset["edges"][number]
  | RunDataset["artifacts"][number];

export interface InspectorContextBundle {
  buildEventJump: (eventId: string, label: string, description: string) => {
    label: string;
    description: string;
    selection: { kind: "event"; id: string };
  };
  context: {
    dataset: RunDataset;
    eventsById: Map<string, EventRecord>;
    incomingByEventId: Map<string, RunDataset["edges"]>;
    outgoingByEventId: Map<string, RunDataset["edges"]>;
    previousByEventId: Map<string, EventRecord>;
    buildEventJump: InspectorContextBundle["buildEventJump"];
  };
}

function resolveEventSelection(dataset: RunDataset, selectionId: string) {
  return dataset.events.find((event) => event.eventId === selectionId) ?? null;
}

function resolveEdgeSelection(dataset: RunDataset, selectionId: string) {
  return dataset.edges.find((edge) => edge.edgeId === selectionId) ?? null;
}

function resolveArtifactSelection(dataset: RunDataset, selectionId: string) {
  return (
    dataset.artifacts.find((artifact) => artifact.artifactId === selectionId) ??
    null
  );
}

function resolveSelectionByKind(
  dataset: RunDataset,
  selection: SelectionState,
): InspectorSelectionDetails | null {
  const selectionResolvers = {
    artifact: resolveArtifactSelection,
    edge: resolveEdgeSelection,
    event: resolveEventSelection,
  } satisfies Record<
    SelectionState["kind"],
    (dataset: RunDataset, selectionId: string) => InspectorSelectionDetails | null
  >;

  return selectionResolvers[selection.kind](dataset, selection.id);
}

export function buildInspectorContext(dataset: RunDataset): InspectorContextBundle {
  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const { previousByEventId } = buildLaneEventMaps(dataset);
  const eventsById = new Map(
    dataset.events.map((event) => [event.eventId, event] as const),
  );
  const buildEventJump = (
    eventId: string,
    label: string,
    description: string,
  ) => ({
    label,
    description,
    selection: { kind: "event" as const, id: eventId },
  });

  return {
    buildEventJump,
    context: {
      dataset,
      eventsById,
      incomingByEventId,
      outgoingByEventId,
      previousByEventId,
      buildEventJump,
    },
  };
}

export function findSelectionDetails(
  dataset: RunDataset,
  selection: SelectionState | null,
): InspectorSelectionDetails | null {
  return selection ? resolveSelectionByKind(dataset, selection) : null;
}
