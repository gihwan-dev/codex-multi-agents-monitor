import {
  formatCompactNumber,
  formatDuration,
  formatTimestamp,
  truncateId,
} from "../../../shared/lib/format/index.js";
import type {
  EventRecord,
  InspectorCausalSummary,
  InspectorJump,
  RunDataset,
  SelectionState,
  SummaryFact,
} from "../model/types.js";
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

function buildEventFacts(event: EventRecord): SummaryFact[] {
  const facts: SummaryFact[] = [
    { label: "Status", value: event.status },
    { label: "Started", value: formatTimestamp(event.startTs) },
    { label: "Duration", value: formatDuration(event.durationMs) },
  ];

  if (event.toolName) {
    facts.push({ label: "Tool", value: event.toolName });
  }

  if (event.model && event.model !== "human") {
    facts.push({ label: "Model", value: event.model });
  }

  const totalTokens = event.tokensIn + event.tokensOut;
  if (totalTokens > 0) {
    const cacheSuffix =
      event.cacheReadTokens > 0
        ? ` (${formatCompactNumber(event.cacheReadTokens)} cached)`
        : "";
    const reasoningSuffix =
      event.reasoningTokens > 0
        ? ` + ${formatCompactNumber(event.reasoningTokens)} reasoning`
        : "";
    facts.push({
      label: "Tokens",
      value: `${formatCompactNumber(event.tokensIn)} in${cacheSuffix} / ${formatCompactNumber(event.tokensOut)} out${reasoningSuffix}`,
    });
  }

  if (event.errorMessage) {
    facts.push({ label: "Error", value: event.errorMessage, emphasis: "danger" });
  }

  if (event.finishReason && event.finishReason !== "stop") {
    facts.push({ label: "Finish", value: event.finishReason, emphasis: "warning" });
  }

  return facts;
}

export function buildInspectorCausalSummary(
  dataset: RunDataset,
  selection: SelectionState | null,
  rawEnabled: boolean,
): InspectorCausalSummary | null {
  const details = findSelectionDetails(dataset, selection);
  if (!details) {
    return null;
  }

  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));
  const { previousByEventId } = buildLaneEventMaps(dataset);
  const buildEventJump = (
    eventId: string,
    label: string,
    description: string,
  ): InspectorJump => ({
    label,
    description,
    selection: { kind: "event", id: eventId },
  });

  if ("eventId" in details) {
    const upstream = [
      ...(details.parentId
        ? [buildEventJump(details.parentId, "Parent event", "Jump to the upstream event context.")]
        : []),
      ...(incomingByEventId.get(details.eventId) ?? []).map((edge) =>
        buildEventJump(
          edge.sourceEventId,
          `${edge.edgeType} source`,
          edge.payloadPreview ?? "Jump to the upstream source event.",
        ),
      ),
    ];

    let downstream = [
      ...dataset.events
        .filter((event) => event.parentId === details.eventId)
        .map((event) =>
          buildEventJump(
            event.eventId,
            event.title,
            event.outputPreview ?? event.inputPreview ?? "Jump to the downstream event.",
          ),
        ),
      ...(outgoingByEventId.get(details.eventId) ?? []).map((edge) =>
        buildEventJump(
          edge.targetEventId,
          `${edge.edgeType} target`,
          edge.payloadPreview ?? "Jump to the downstream target event.",
        ),
      ),
    ];

    if (!downstream.length && ["blocked", "waiting", "interrupted"].includes(details.status)) {
      const previous = previousByEventId.get(details.eventId);
      if (previous) {
        downstream = [
          ...(outgoingByEventId.get(previous.eventId) ?? []).map((edge) =>
            buildEventJump(
              edge.targetEventId,
              `${edge.edgeType} target`,
              edge.payloadPreview ?? "Jump to the downstream target event.",
            ),
          ),
        ];
      }
    }

    const affectedStatuses = downstream
      .map((item) => ("selection" in item ? eventsById.get(item.selection.id) : null))
      .filter(Boolean) as EventRecord[];
    const whyBlocked =
      details.status === "blocked" ||
      details.status === "waiting" ||
      details.status === "interrupted"
        ? details.waitReason ?? "reason unavailable"
        : null;
    const nextAction =
      affectedStatuses.find((event) =>
        ["waiting", "blocked", "interrupted"].includes(event.status),
      )?.waitReason ??
      downstream[0]?.description ??
      null;

    const downstreamAgentIds = new Set(
      downstream
        .map((item) => eventsById.get(item.selection.id))
        .filter(Boolean)
        .map((event) => (event as EventRecord).agentId),
    );
    const downstreamWaitingCount = affectedStatuses.filter((event) =>
      ["waiting", "blocked", "interrupted"].includes(event.status),
    ).length;

    return {
      title: details.title,
      preview: details.outputPreview ?? details.inputPreview ?? "n/a",
      facts: buildEventFacts(details),
      whyBlocked,
      upstream,
      downstream,
      nextAction,
      payloadPreview: details.outputPreview ?? details.inputPreview ?? "n/a",
      rawStatusLabel:
        rawEnabled && (details.rawInput || details.rawOutput)
          ? "Raw available in drawer."
          : "Raw gated by default.",
      affectedAgentCount: downstreamAgentIds.size,
      downstreamWaitingCount,
    };
  }

  if ("edgeId" in details) {
    return {
      title: details.edgeType,
      preview: details.payloadPreview ?? "n/a",
      facts: [
        { label: "Source", value: truncateId(details.sourceEventId) },
        { label: "Target", value: truncateId(details.targetEventId) },
        {
          label: "Artifact",
          value: details.artifactId ? truncateId(details.artifactId) : "n/a",
        },
      ],
      whyBlocked: null,
      upstream: [
        buildEventJump(
          details.sourceEventId,
          "Source event",
          "Jump to the upstream event.",
        ),
      ],
      downstream: [
        buildEventJump(
          details.targetEventId,
          "Target event",
          "Jump to the downstream event.",
        ),
      ],
      nextAction: details.payloadPreview ?? null,
      payloadPreview: details.payloadPreview ?? "n/a",
      rawStatusLabel: "Edge payload is summarized in the drawer log view.",
      affectedAgentCount: 0,
      downstreamWaitingCount: 0,
    };
  }

  return {
    title: details.title,
    preview: details.preview,
    facts: [
      { label: "Artifact", value: truncateId(details.artifactId) },
      { label: "Producer", value: truncateId(details.producerEventId) },
      {
        label: "Raw",
        value: rawEnabled && details.rawContent ? "available" : "redacted",
      },
    ],
    whyBlocked: null,
    upstream: [
      buildEventJump(
        details.producerEventId,
        "Producer event",
        "Jump to the event that created this artifact.",
      ),
    ],
    downstream: [],
    nextAction: "Open artifacts or raw drawer for the full payload.",
    payloadPreview: details.preview,
    rawStatusLabel:
      rawEnabled && details.rawContent ? "Raw available in drawer." : "Raw gated by default.",
    affectedAgentCount: 0,
    downstreamWaitingCount: 0,
  };
}
