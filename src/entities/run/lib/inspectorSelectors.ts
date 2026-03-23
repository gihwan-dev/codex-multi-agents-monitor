import type {
  EventRecord,
  InspectorCausalSummary,
  RunDataset,
  SelectionState,
} from "../model/types.js";
import {
  buildArtifactInspectorSummary,
  buildEdgeInspectorSummary,
} from "./inspectorStaticSummaryBuilders.js";
import {
  buildEventInspectorSummary,
} from "./inspectorSummaryBuilders.js";
import { buildEdgeMaps, buildLaneEventMaps } from "./selectorShared.js";

function findSelectionDetails(
  dataset: RunDataset,
  selection: SelectionState | null,
): EventRecord | RunDataset["edges"][number] | RunDataset["artifacts"][number] | null {
  if (!selection) {
    return null;
  }

  if (selection.kind === "event") {
    return dataset.events.find((event) => event.eventId === selection.id) ?? null;
  }

  if (selection.kind === "edge") {
    return dataset.edges.find((edge) => edge.edgeId === selection.id) ?? null;
  }

  return dataset.artifacts.find((artifact) => artifact.artifactId === selection.id) ?? null;
}

function buildInspectorContext(dataset: RunDataset) {
  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const { previousByEventId } = buildLaneEventMaps(dataset);
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));
  const buildEventJump = (eventId: string, label: string, description: string) => ({
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

function buildSelectionSummary(
  dataset: RunDataset,
  details: NonNullable<ReturnType<typeof findSelectionDetails>>,
  rawEnabled: boolean,
) {
  const { buildEventJump, context } = buildInspectorContext(dataset);
  if ("eventId" in details) {
    return buildEventInspectorSummary(details, context, rawEnabled);
  }

  return "edgeId" in details
    ? buildEdgeInspectorSummary(details, buildEventJump)
    : buildArtifactInspectorSummary(details, rawEnabled, buildEventJump);
}

export function buildInspectorCausalSummary(
  dataset: RunDataset,
  selection: SelectionState | null,
  rawEnabled: boolean,
): InspectorCausalSummary | null {
  const details = findSelectionDetails(dataset, selection);
  return details ? buildSelectionSummary(dataset, details, rawEnabled) : null;
}
