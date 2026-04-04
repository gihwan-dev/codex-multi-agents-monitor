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
type LastHandoff = NonNullable<ReturnType<typeof findLastHandoff>>;
type MaybeLastHandoff = LastHandoff | null;

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

function createAnomalyJump(
  label: string,
  selection: AnomalyJump["selection"],
  emphasis: AnomalyJump["emphasis"],
) {
  return { label, selection, emphasis } satisfies AnomalyJump;
}

function appendAnomalyJump(
  jumps: AnomalyJump[],
  jump: AnomalyJump | null,
) {
  if (jump) {
    jumps.push(jump);
  }
}

function resolveWaitingEventJump(waitingEvent: EventRecord | undefined) {
  return waitingEvent
    ? createAnomalyJump("Longest wait", { kind: "event", id: waitingEvent.eventId }, "warning")
    : null;
}

function resolveFirstErrorJump(firstError: EventRecord | undefined) {
  return firstError
    ? createAnomalyJump("First error", { kind: "event", id: firstError.eventId }, "danger")
    : null;
}

function resolveExpensiveJump(expensive: EventRecord | undefined) {
  return expensive
    ? createAnomalyJump("Most expensive", { kind: "event", id: expensive.eventId }, "accent")
    : null;
}

function resolveLastHandoffJump(lastHandoff: MaybeLastHandoff) {
  return lastHandoff
    ? createAnomalyJump("Last handoff", { kind: "edge", id: lastHandoff.edgeId }, "accent")
    : null;
}

function resolveFinalArtifactJump(finalArtifact: RunDataset["artifacts"][number] | undefined) {
  return finalArtifact
    ? createAnomalyJump(
        "Final artifact",
        { kind: "artifact", id: finalArtifact.artifactId },
        "default",
      )
    : null;
}

function isBlockingStatus(event: EventRecord) {
  return BLOCKING_STATUSES.includes(event.status as (typeof BLOCKING_STATUSES)[number]);
}

function collectAnomalyCandidates(
  dataset: RunDataset,
  lastHandoff?: MaybeLastHandoff,
) {
  const events = sortEvents(dataset.events);
  let firstError: EventRecord | undefined;
  let waitingEvent: EventRecord | undefined;
  let expensive: EventRecord | undefined;

  for (const event of events) {
    if (!firstError && (event.status === "failed" || event.eventType === "error")) {
      firstError = event;
    }

    if (isBlockingStatus(event) && (!waitingEvent || event.durationMs > waitingEvent.durationMs)) {
      waitingEvent = event;
    }

    if (!expensive || event.costUsd > expensive.costUsd) {
      expensive = event;
    }
  }

  return {
    firstError,
    waitingEvent,
    lastHandoff: lastHandoff === undefined ? findLastHandoff(dataset, events) : lastHandoff,
    finalArtifact: dataset.artifacts.find(
      (artifact) => artifact.artifactId === dataset.run.finalArtifactId,
    ),
    expensive,
  };
}

export function buildAnomalyJumps(
  dataset: RunDataset,
  lastHandoff?: MaybeLastHandoff,
): AnomalyJump[] {
  const { firstError, waitingEvent, lastHandoff: resolvedLastHandoff, finalArtifact, expensive } =
    collectAnomalyCandidates(dataset, lastHandoff);
  const jumps: AnomalyJump[] = [];

  appendAnomalyJump(jumps, resolveWaitingEventJump(waitingEvent));
  appendAnomalyJump(jumps, resolveFirstErrorJump(firstError));
  appendAnomalyJump(jumps, resolveExpensiveJump(expensive));
  appendAnomalyJump(jumps, resolveLastHandoffJump(resolvedLastHandoff));
  appendAnomalyJump(jumps, resolveFinalArtifactJump(finalArtifact));

  return jumps;
}

export function buildSummaryFacts(
  dataset: RunDataset,
  selectionPath: SelectionPath,
  lastHandoff?: MaybeLastHandoff,
): SummaryFact[] {
  const orderedEvents = sortEvents(dataset.events);
  const blockerEvent = findBlockerEvent(orderedEvents);
  const affectedLaneIds = buildAffectedLaneIds(orderedEvents, selectionPath, blockerEvent);
  const resolvedLastHandoff =
    lastHandoff === undefined ? findLastHandoff(dataset, orderedEvents) : lastHandoff;
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
