import type {
  AnomalyJump,
  EventRecord,
  RunDataset,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";
import { findLastHandoff } from "./summaryMetricCalculations.js";

const BLOCKING_STATUSES = ["blocked", "waiting", "interrupted"] as const;

type LastHandoff = NonNullable<ReturnType<typeof findLastHandoff>>;
export type MaybeLastHandoff = LastHandoff | null;
type AnomalyCandidates = {
  firstError: EventRecord | undefined;
  waitingEvent: EventRecord | undefined;
  expensive: EventRecord | undefined;
};

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

function updateFirstError(
  current: EventRecord | undefined,
  event: EventRecord,
) {
  if (current) {
    return current;
  }

  if (event.status === "failed" || event.eventType === "error") {
    return event;
  }

  return current;
}

function updateLongestWaiting(
  current: EventRecord | undefined,
  event: EventRecord,
) {
  if (!isBlockingStatus(event)) {
    return current;
  }

  if (!current || event.durationMs > current.durationMs) {
    return event;
  }

  return current;
}

function updateMostExpensive(
  current: EventRecord | undefined,
  event: EventRecord,
) {
  if (!current || event.costUsd > current.costUsd) {
    return event;
  }

  return current;
}

function updateAnomalyCandidates(
  current: AnomalyCandidates,
  event: EventRecord,
): AnomalyCandidates {
  return {
    firstError: updateFirstError(current.firstError, event),
    waitingEvent: updateLongestWaiting(current.waitingEvent, event),
    expensive: updateMostExpensive(current.expensive, event),
  };
}

function collectAnomalyCandidates(
  dataset: RunDataset,
  lastHandoff?: MaybeLastHandoff,
) {
  const events = sortEvents(dataset.events);
  let candidates: AnomalyCandidates = {
    firstError: undefined,
    waitingEvent: undefined,
    expensive: undefined,
  };

  for (const event of events) {
    candidates = updateAnomalyCandidates(candidates, event);
  }

  return {
    ...candidates,
    lastHandoff: lastHandoff === undefined ? findLastHandoff(dataset, events) : lastHandoff,
    finalArtifact: dataset.artifacts.find(
      (artifact) => artifact.artifactId === dataset.run.finalArtifactId,
    ),
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
