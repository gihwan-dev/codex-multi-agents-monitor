import type { EventRecord } from "../../run";
import type { TimedSubagentSnapshot } from "../model/types";

export { buildSessionLinkMaps } from "./sessionLinkMapBuilder";
export type { IndexedSubagents, SessionLinkMaps } from "./sessionLinkTypes";

export function indexSubagents(
  subagents: TimedSubagentSnapshot[],
): import("./sessionLinkTypes").IndexedSubagents {
  return {
    bySessionId: new Map(subagents.map((subagent) => [subagent.sessionId, subagent])),
    byNickname: new Map(subagents.map((subagent) => [subagent.agentNickname, subagent])),
  };
}

export function buildLatestSubagentEventBySessionId(events: EventRecord[]) {
  const latestBySessionId = new Map<string, EventRecord>();
  for (const event of events) {
    if (
      !event.laneId.endsWith(":sub") ||
      event.eventType === "run.finished" ||
      event.eventType === "run.cancelled"
    ) {
      continue;
    }

    const existing = latestBySessionId.get(event.threadId);
    if (!existing || event.startTs > existing.startTs) {
      latestBySessionId.set(event.threadId, event);
    }
  }
  return latestBySessionId;
}

export function findClosestParentEvent(
  parentEvents: EventRecord[],
  targetTs: number,
): string {
  const closestEvent =
    findLatestParentBeforeTarget(parentEvents, targetTs) ??
    findNearestParentByTimestamp(parentEvents, targetTs);
  return closestEvent?.eventId ?? "";
}

function findLatestParentBeforeTarget(
  parentEvents: EventRecord[],
  targetTs: number,
) {
  let latestParent: EventRecord | null = null;
  for (const event of parentEvents) {
    if (event.startTs > targetTs) {
      continue;
    }

    if (!latestParent || event.startTs > latestParent.startTs) {
      latestParent = event;
    }
  }

  return latestParent;
}

function findNearestParentByTimestamp(
  parentEvents: EventRecord[],
  targetTs: number,
) {
  let closestEvent: EventRecord | null = null;
  let closestDelta = Number.POSITIVE_INFINITY;

  for (const event of parentEvents) {
    const delta = Math.abs(event.startTs - targetTs);
    if (isCloserParentEvent(delta, closestDelta)) {
      closestEvent = event;
      closestDelta = delta;
    }
  }

  return closestEvent;
}

function isCloserParentEvent(delta: number, closestDelta: number) {
  return delta < closestDelta;
}
