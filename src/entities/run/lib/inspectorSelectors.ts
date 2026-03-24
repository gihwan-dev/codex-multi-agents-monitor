import type {
  InspectorCausalSummary,
  RunDataset,
  SelectionState,
} from "../model/types.js";
import {
  buildInspectorContext,
  findSelectionDetails,
  type InspectorSelectionDetails,
} from "./inspectorSelection.js";
import {
  buildArtifactInspectorSummary,
  buildEdgeInspectorSummary,
} from "./inspectorStaticSummaryBuilders.js";
import {
  buildEventInspectorSummary,
} from "./inspectorSummaryBuilders.js";

function buildSelectionSummary(
  dataset: RunDataset,
  details: InspectorSelectionDetails,
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
