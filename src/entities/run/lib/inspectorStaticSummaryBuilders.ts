import { truncateId } from "../../../shared/lib/format";
import type {
  ArtifactRecord,
  EdgeRecord,
  InspectorCausalSummary,
} from "../model/types.js";
import type { InspectorContext } from "./inspectorSummaryBuilders.js";

export function buildEdgeInspectorSummary(
  edge: EdgeRecord,
  buildEventJump: InspectorContext["buildEventJump"],
): InspectorCausalSummary {
  return {
    title: edge.edgeType,
    preview: edge.payloadPreview ?? "n/a",
    facts: [
      { label: "Source", value: truncateId(edge.sourceEventId) },
      { label: "Target", value: truncateId(edge.targetEventId) },
      { label: "Artifact", value: edge.artifactId ? truncateId(edge.artifactId) : "n/a" },
    ],
    whyBlocked: null,
    upstream: [
      buildEventJump(edge.sourceEventId, "Source event", "Jump to the upstream event."),
    ],
    downstream: [
      buildEventJump(edge.targetEventId, "Target event", "Jump to the downstream event."),
    ],
    nextAction: edge.payloadPreview ?? null,
    payloadPreview: edge.payloadPreview ?? "n/a",
    inputPreview: null,
    outputPreview: edge.payloadPreview,
    rawInput: null,
    rawOutput: null,
    rawStatusLabel: "Edge payload is summarized in the drawer log view.",
    affectedAgentCount: 0,
    downstreamWaitingCount: 0,
  };
}

export function buildArtifactInspectorSummary(
  artifact: ArtifactRecord,
  rawEnabled: boolean,
  buildEventJump: InspectorContext["buildEventJump"],
): InspectorCausalSummary {
  return {
    title: artifact.title,
    preview: artifact.preview,
    facts: [
      { label: "Artifact", value: truncateId(artifact.artifactId) },
      { label: "Producer", value: truncateId(artifact.producerEventId) },
      {
        label: "Raw",
        value: rawEnabled && artifact.rawContent ? "available" : "redacted",
      },
    ],
    whyBlocked: null,
    upstream: [
      buildEventJump(
        artifact.producerEventId,
        "Producer event",
        "Jump to the event that created this artifact.",
      ),
    ],
    downstream: [],
    nextAction: "Open artifacts or raw drawer for the full payload.",
    payloadPreview: artifact.preview,
    inputPreview: null,
    outputPreview: artifact.preview,
    rawInput: null,
    rawOutput: rawEnabled ? artifact.rawContent : null,
    rawStatusLabel:
      rawEnabled && artifact.rawContent ? "Raw available in drawer." : "Raw gated by default.",
    affectedAgentCount: 0,
    downstreamWaitingCount: 0,
  };
}
