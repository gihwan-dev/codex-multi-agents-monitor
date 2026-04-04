import { formatDuration } from "../../../shared/lib/format";
import type {
  EventRecord,
  RunDataset,
  SelectionPath,
  SummaryFact,
} from "../model/types.js";
import type { MaybeLastHandoff } from "./anomalyJumps.js";
import { sortEvents } from "./selectorShared.js";
import {
  calculateSummaryMetrics,
  findLastHandoff,
} from "./summaryMetricCalculations.js";

export { buildAnomalyJumps } from "./anomalyJumps.js";
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
  lastHandoff: MaybeLastHandoff,
) {
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

function resolveSummaryLastHandoff(
  dataset: RunDataset,
  orderedEvents: EventRecord[],
  lastHandoff?: MaybeLastHandoff,
) {
  return lastHandoff === undefined ? findLastHandoff(dataset, orderedEvents) : lastHandoff;
}

export function buildSummaryFacts(
  dataset: RunDataset,
  selectionPath: SelectionPath,
  lastHandoff?: MaybeLastHandoff,
): SummaryFact[] {
  const orderedEvents = sortEvents(dataset.events);
  const blockerEvent = findBlockerEvent(orderedEvents);
  const affectedLaneIds = buildAffectedLaneIds(orderedEvents, selectionPath, blockerEvent);
  const resolvedLastHandoff = resolveSummaryLastHandoff(dataset, orderedEvents, lastHandoff);
  const { handoff: finalLastHandoff, label: lastHandoffLabel } = buildLastHandoffLabel(
    dataset,
    resolvedLastHandoff,
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
      emphasis: finalLastHandoff ? "accent" : "default",
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
