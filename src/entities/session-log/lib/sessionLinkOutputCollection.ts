import type { EventRecord } from "../../run";
import type { SessionLogSnapshot, TimedSubagentSnapshot } from "../model/types";
import { buildEntryEventId, parseRequiredTimestamp } from "./helpers";
import type { CallMaps } from "./sessionLinkCallMaps";
import {
  collectSpawnAgentLinks,
  collectWaitAgentErrors,
} from "./sessionLinkSubagentSignals";
import type {
  IndexedSubagents,
  SessionLinkMaps,
} from "./sessionLinkTypes";

interface OutputCollectionOptions {
  sessionId: string;
  entries: SessionLogSnapshot["entries"];
  indexedSubagents: IndexedSubagents;
  callMaps: CallMaps;
  sessionLinks: SessionLinkMaps;
}

interface FillMissingSpawnSourceEventsOptions {
  parentEvents: EventRecord[];
  subagents: TimedSubagentSnapshot[];
  subagentToSpawnSource: Map<string, string>;
}

interface ParentFunctionArgsOptions {
  entries: SessionLogSnapshot["entries"];
  callMaps: CallMaps;
  sessionLinks: SessionLinkMaps;
}

interface LinkOutputEventOptions {
  entry: SessionLogSnapshot["entries"][number];
  index: number;
  sessionId: string;
  callMaps: CallMaps;
  sessionLinks: SessionLinkMaps;
}

interface LinkFallbackSpawnSourceOptions {
  subagent: TimedSubagentSnapshot;
  index: number;
  spawnToolEvents: EventRecord[];
  subagentToSpawnSource: Map<string, string>;
}

export function collectOutputLinks(options: OutputCollectionOptions) {
  collectParentFunctionArgs(options);
  collectFunctionCallOutputs(options);
}

export function fillMissingSpawnSourceEvents(
  options: FillMissingSpawnSourceEventsOptions,
) {
  const { parentEvents, subagents, subagentToSpawnSource } = options;
  if (subagentToSpawnSource.size >= subagents.length) {
    return;
  }

  const spawnToolEvents = [...parentEvents]
    .filter((event) => event.toolName === "spawn_agent")
    .sort((left, right) => left.startTs - right.startTs);
  const sortedSubagents = [...subagents].sort((left, right) => left.startedTs - right.startedTs);
  for (const [index, subagent] of sortedSubagents.entries()) {
    linkFallbackSpawnSource({ subagent, index, spawnToolEvents, subagentToSpawnSource });
  }
}

function collectParentFunctionArgs(options: ParentFunctionArgsOptions) {
  const { entries, callMaps, sessionLinks } = options;
  for (const entry of entries) {
    if (!isFunctionCallEntry(entry)) {
      continue;
    }

    const eventId = callMaps.callEventIdByCallId.get(entry.functionCallId);
    if (eventId) {
      sessionLinks.parentFunctionArgsByEventId.set(
        eventId,
        entry.functionArgumentsPreview,
      );
    }
  }
}

function collectFunctionCallOutputs(options: OutputCollectionOptions) {
  for (const [index, entry] of options.entries.entries()) {
    if (!isFunctionCallOutputEntry(entry)) {
      continue;
    }

    linkOutputEvent({ entry, index, ...options });
    collectSpawnAgentLinks({ entry, ...options });
    collectWaitAgentErrors({ entry, ...options });
  }
}

function linkOutputEvent(options: LinkOutputEventOptions) {
  const { entry, index, sessionId, callMaps, sessionLinks } = options;
  const outputEventId = buildOutputEventId(sessionId, entry, index);
  const pairedCallEventId = callMaps.callEventIdByCallId.get(entry.functionCallId ?? "");
  if (outputEventId && pairedCallEventId) {
    sessionLinks.callEventToOutputEvent.set(pairedCallEventId, outputEventId);
  }
}

function buildOutputEventId(
  sessionId: string,
  entry: SessionLogSnapshot["entries"][number],
  index: number,
) {
  if (parseRequiredTimestamp(entry.timestamp) === null || !entry.functionCallId) {
    return null;
  }

  return buildEntryEventId(sessionId, entry, index);
}

function linkFallbackSpawnSource(options: LinkFallbackSpawnSourceOptions) {
  const { subagent, index, spawnToolEvents, subagentToSpawnSource } = options;
  if (
    subagentToSpawnSource.has(subagent.sessionId) ||
    index >= spawnToolEvents.length
  ) {
    return;
  }

  subagentToSpawnSource.set(subagent.sessionId, spawnToolEvents[index].eventId);
}

function isFunctionCallEntry(
  entry: SessionLogSnapshot["entries"][number],
): entry is SessionLogSnapshot["entries"][number] & {
  functionCallId: string;
  functionName: string;
} {
  return (
    entry.entryType === "function_call" &&
    Boolean(entry.functionCallId) &&
    Boolean(entry.functionName)
  );
}

function isFunctionCallOutputEntry(
  entry: SessionLogSnapshot["entries"][number],
): entry is SessionLogSnapshot["entries"][number] & {
  functionCallId: string;
} {
  return entry.entryType === "function_call_output" && Boolean(entry.functionCallId);
}
