import { formatDuration } from "../../../shared/lib/format";
import type {
  AnomalyJump,
  EventRecord,
  RunDataset,
  SelectionPath,
  SummaryFact,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";
import {
  calculateSummaryMetrics,
  findLastHandoff,
} from "./summaryMetricCalculations.js";

export { calculateSummaryMetrics };

const BLOCKING_STATUSES = ["blocked", "waiting", "interrupted"] as const;
const AFFECTED_STATUSES = [...BLOCKING_STATUSES, "failed"] as const;

function findBlockerEvent(events: EventRecord[]) {
  return (
    events.find((event) => event.status === "blocked") ??
    events.find((event) => event.status === "waiting") ??
    events.find((event) => event.status === "interrupted") ??
    null
  );
}

function buildAffectedLaneIds(
  orderedEvents: EventRecord[],
  selectionPath: SelectionPath,
  blockerEvent: EventRecord | null,
) {
  const selectionEventIdSet = new Set(selectionPath.eventIds);
  const affectedLaneIds = new Set(
    orderedEvents
      .filter(
        (event) =>
          selectionEventIdSet.has(event.eventId) &&
          AFFECTED_STATUSES.includes(event.status as (typeof AFFECTED_STATUSES)[number]),
      )
      .map((event) => event.laneId),
  );

  if (blockerEvent) {
    affectedLaneIds.delete(blockerEvent.laneId);
  }

  return affectedLaneIds;
}

function buildLastHandoffLabel(
  dataset: RunDataset,
  orderedEvents: EventRecord[],
) {
  const lastHandoff = findLastHandoff(dataset, orderedEvents);
  if (!lastHandoff) {
    return { handoff: null, label: "n/a" };
  }

  const source =
    dataset.lanes.find((lane) => lane.agentId === lastHandoff.sourceAgentId)?.name ?? "Unknown";
  const target =
    dataset.lanes.find((lane) => lane.agentId === lastHandoff.targetAgentId)?.name ?? "Unknown";

  return {
    handoff: lastHandoff,
    label: `${source} -> ${target}`,
  };
}

function resolveBlockerLaneName(dataset: RunDataset, blockerEvent: EventRecord | null) {
  if (!blockerEvent) {
    return "n/a";
  }

  return dataset.lanes.find((lane) => lane.laneId === blockerEvent.laneId)?.name ?? blockerEvent.title;
}

export function buildAnomalyJumps(dataset: RunDataset): AnomalyJump[] {
  const events = sortEvents(dataset.events);
  const firstError = events.find(
    (event) => event.status === "failed" || event.eventType === "error",
  );
  const waitingEvent = [...events]
    .filter((event) => BLOCKING_STATUSES.includes(event.status as (typeof BLOCKING_STATUSES)[number]))
    .sort((left, right) => right.durationMs - left.durationMs)[0];
  const lastHandoff = findLastHandoff(dataset, events);
  const finalArtifact = dataset.artifacts.find(
    (artifact) => artifact.artifactId === dataset.run.finalArtifactId,
  );
  const expensive = [...events].sort((left, right) => right.costUsd - left.costUsd)[0];

  return [
    waitingEvent && {
      label: "Longest wait",
      selection: { kind: "event" as const, id: waitingEvent.eventId },
      emphasis: "warning" as const,
    },
    firstError && {
      label: "First error",
      selection: { kind: "event" as const, id: firstError.eventId },
      emphasis: "danger" as const,
    },
    expensive && {
      label: "Most expensive",
      selection: { kind: "event" as const, id: expensive.eventId },
      emphasis: "accent" as const,
    },
    lastHandoff && {
      label: "Last handoff",
      selection: { kind: "edge" as const, id: lastHandoff.edgeId },
      emphasis: "accent" as const,
    },
    finalArtifact && {
      label: "Final artifact",
      selection: { kind: "artifact" as const, id: finalArtifact.artifactId },
      emphasis: "default" as const,
    },
  ].filter(Boolean) as AnomalyJump[];
}

export function buildSummaryFacts(
  dataset: RunDataset,
  selectionPath: SelectionPath,
): SummaryFact[] {
  const orderedEvents = sortEvents(dataset.events);
  const blockerEvent = findBlockerEvent(orderedEvents);
  const affectedLaneIds = buildAffectedLaneIds(orderedEvents, selectionPath, blockerEvent);
  const { handoff: lastHandoff, label: lastHandoffLabel } = buildLastHandoffLabel(
    dataset,
    orderedEvents,
  );
  const firstFailure = orderedEvents.find(
    (event) => event.status === "failed" || event.eventType === "error",
  );

  return [
    {
      label: "Blocked by",
      value: resolveBlockerLaneName(dataset, blockerEvent),
      emphasis: blockerEvent ? "warning" : "default",
    },
    {
      label: "Affected",
      value: `${affectedLaneIds.size}`,
      emphasis: affectedLaneIds.size ? "accent" : "default",
    },
    {
      label: "Last handoff",
      value: lastHandoffLabel,
      emphasis: lastHandoff ? "accent" : "default",
    },
    {
      label: "Longest gap",
      value: formatDuration(dataset.run.summaryMetrics.longestGapMs),
      emphasis: "default",
    },
    {
      label: "First failure",
      value: firstFailure?.title ?? "None",
      emphasis: firstFailure ? "danger" : "default",
    },
  ];
}

export function hasRawPayload(dataset: RunDataset): boolean {
  if (dataset.run.rawIncluded) {
    return true;
  }

  return (
    dataset.events.some((event) => Boolean(event.rawInput || event.rawOutput)) ||
    dataset.artifacts.some((artifact) => Boolean(artifact.rawContent))
  );
}
