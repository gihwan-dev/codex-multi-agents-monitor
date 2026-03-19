import type { EventRecord } from "../../shared/domain";
import { buildEntryEventId, parseRequiredTimestamp } from "./helpers";
import { parseJsonRecord, readAgentReference } from "./toolPreview";
import type { SessionLogSnapshot, TimedSubagentSnapshot } from "./types";

interface IndexedSubagents {
  bySessionId: Map<string, TimedSubagentSnapshot>;
  byNickname: Map<string, TimedSubagentSnapshot>;
}

interface SessionLinkMaps {
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
  codexAgentIdToSessionId: Map<string, string>;
  callEventToOutputEvent: Map<string, string>;
  parentFunctionArgsByEventId: Map<string, string | null>;
}

export function indexSubagents(
  subagents: TimedSubagentSnapshot[],
): IndexedSubagents {
  return {
    bySessionId: new Map(subagents.map((subagent) => [subagent.sessionId, subagent])),
    byNickname: new Map(subagents.map((subagent) => [subagent.agentNickname, subagent])),
  };
}

export function buildSessionLinkMaps({
  sessionId,
  entries,
  parentEvents,
  subagents,
  indexedSubagents,
}: {
  sessionId: string;
  entries: SessionLogSnapshot["entries"];
  parentEvents: EventRecord[];
  subagents: TimedSubagentSnapshot[];
  indexedSubagents: IndexedSubagents;
}): SessionLinkMaps {
  const callIdToName = new Map<string, string>();
  const spawnCallIdToEventId = new Map<string, string>();
  const callEventIdByCallId = new Map<string, string>();
  const subagentToSpawnSource = new Map<string, string>();
  const waitAgentErrors = new Map<string, string>();
  const codexAgentIdToSessionId = new Map<string, string>();
  const callEventToOutputEvent = new Map<string, string>();
  const parentFunctionArgsByEventId = new Map<string, string | null>();

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.entryType !== "function_call" || !entry.functionCallId || !entry.functionName) {
      continue;
    }

    callIdToName.set(entry.functionCallId, entry.functionName);

    if (parseRequiredTimestamp(entry.timestamp) === null) {
      continue;
    }

    const eventId = buildEntryEventId(sessionId, entry, index);
    callEventIdByCallId.set(entry.functionCallId, eventId);
    parentFunctionArgsByEventId.set(eventId, entry.functionArgumentsPreview);

    if (entry.functionName === "spawn_agent") {
      spawnCallIdToEventId.set(entry.functionCallId, eventId);
    }
  }

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.entryType !== "function_call_output" || !entry.functionCallId) {
      continue;
    }

    const toolName = callIdToName.get(entry.functionCallId);
    const outputEventId =
      parseRequiredTimestamp(entry.timestamp) === null
        ? null
        : buildEntryEventId(sessionId, entry, index);
    const pairedCallEventId = callEventIdByCallId.get(entry.functionCallId);
    if (outputEventId && pairedCallEventId) {
      callEventToOutputEvent.set(pairedCallEventId, outputEventId);
    }

    const parsedOutput = parseJsonRecord(entry.text);
    if (toolName === "spawn_agent") {
      const spawnSourceEventId = spawnCallIdToEventId.get(entry.functionCallId);
      const { agentId, nickname } = readAgentReference(parsedOutput);
      const matchedSubagent = resolveLinkedSubagent(indexedSubagents, agentId, nickname);
      if (spawnSourceEventId && matchedSubagent) {
        subagentToSpawnSource.set(matchedSubagent.sessionId, spawnSourceEventId);
      }
      if (agentId && matchedSubagent) {
        codexAgentIdToSessionId.set(agentId, matchedSubagent.sessionId);
      }
      continue;
    }

    if (toolName !== "wait" && toolName !== "wait_agent") {
      continue;
    }

    const statuses = parsedOutput?.status;
    if (!statuses || typeof statuses !== "object") {
      continue;
    }

    for (const [agentId, agentStatus] of Object.entries(statuses)) {
      if (!agentStatus || typeof agentStatus !== "object") {
        continue;
      }
      const errored = (agentStatus as Record<string, unknown>).errored;
      if (typeof errored !== "string") {
        continue;
      }

      const resolvedSessionId = codexAgentIdToSessionId.get(agentId) ?? agentId;
      if (
        indexedSubagents.bySessionId.has(resolvedSessionId) &&
        !waitAgentErrors.has(resolvedSessionId)
      ) {
        waitAgentErrors.set(resolvedSessionId, errored);
      }
    }
  }

  if (subagentToSpawnSource.size < subagents.length) {
    const spawnToolEvents = parentEvents
      .filter((event) => event.toolName === "spawn_agent")
      .sort((left, right) => left.startTs - right.startTs);
    const sortedSubagents = [...subagents].sort((left, right) => left.startedTs - right.startedTs);
    for (let index = 0; index < sortedSubagents.length; index++) {
      const subagent = sortedSubagents[index];
      if (
        !subagent ||
        subagentToSpawnSource.has(subagent.sessionId) ||
        index >= spawnToolEvents.length
      ) {
        continue;
      }
      subagentToSpawnSource.set(subagent.sessionId, spawnToolEvents[index].eventId);
    }
  }

  return {
    subagentToSpawnSource,
    waitAgentErrors,
    codexAgentIdToSessionId,
    callEventToOutputEvent,
    parentFunctionArgsByEventId,
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
  if (parentEvents.length === 0) {
    return "";
  }

  let best: EventRecord | null = null;
  for (const event of parentEvents) {
    if (event.startTs <= targetTs && (!best || event.startTs > best.startTs)) {
      best = event;
    }
  }

  if (!best) {
    best = parentEvents[0];
    let bestDelta = Math.abs(best.startTs - targetTs);
    for (const event of parentEvents) {
      const delta = Math.abs(event.startTs - targetTs);
      if (delta < bestDelta) {
        best = event;
        bestDelta = delta;
      }
    }
  }

  return best.eventId;
}

function resolveLinkedSubagent(
  indexedSubagents: IndexedSubagents,
  agentId: string | null | undefined,
  nickname: string | null | undefined,
) {
  if (agentId) {
    const bySessionId = indexedSubagents.bySessionId.get(agentId);
    if (bySessionId) {
      return bySessionId;
    }
  }

  if (nickname) {
    return indexedSubagents.byNickname.get(nickname) ?? null;
  }

  return null;
}
