import type { AgentLane, EventRecord, RunStatus } from "../../run";
import { parseRequiredTimestamp } from "../lib/helpers";
import { applyTokenCountToLastEvent } from "./eventBuilderRecord";
import type { EntryContext } from "./eventBuilderTypes";
import { buildMessageEvent, shouldSkipMessageEntry } from "./messageEntryEvents";
import { buildSupplementalEntryEvent } from "./supplementalEntryEvents";
import { buildFunctionCallEvent, buildFunctionCallOutputEvent } from "./toolEntryEvents";
import type { SessionEntrySnapshot } from "./types";

interface BuildLaneEventsArgs {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  userLane: AgentLane | null;
  updatedAtTs: number;
  status: RunStatus;
  model: string;
  displayTitle: string;
  isSubagent?: boolean;
}

export function buildLaneEventsFromEntries({
  entries,
  lane,
  userLane,
  updatedAtTs,
  status,
  model,
  displayTitle,
  isSubagent = false,
}: BuildLaneEventsArgs): EventRecord[] {
  const events: EventRecord[] = [];
  const { callIdToName, lastValidEntryIndex } = collectEntryMetadata(entries);
  let firstUserPromptSeen = false;

  for (let index = 0; index < entries.length; index++) {
    firstUserPromptSeen = applyEntryResult(events, processEntryContext({
      entries,
      lane,
      updatedAtTs,
      status,
      model,
      displayTitle,
      userLane,
      isSubagent,
      index,
      lastValidEntryIndex,
      callIdToName,
      events,
      firstUserPromptSeen,
    }));
  }

  return events;
}

function collectEntryMetadata(entries: SessionEntrySnapshot[]) {
  const callIdToName = new Map<string, string>();
  let lastValidEntryIndex = -1;

  for (const [index, entry] of entries.entries()) {
    if (entry.entryType === "function_call" && entry.functionCallId && entry.functionName) {
      callIdToName.set(entry.functionCallId, entry.functionName);
    }
    if (parseRequiredTimestamp(entry.timestamp) !== null) {
      lastValidEntryIndex = index;
    }
  }

  return { callIdToName, lastValidEntryIndex };
}

function createEntryContext({
  entries,
  lane,
  updatedAtTs,
  status,
  model,
  index,
  lastValidEntryIndex,
}: {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  updatedAtTs: number;
  status: RunStatus;
  model: string;
  index: number;
  lastValidEntryIndex: number;
}): EntryContext | null {
  const entry = entries[index];
  const nextEntry = entries[index + 1];
  const startTs = parseRequiredTimestamp(entry.timestamp);
  if (startTs === null) {
    return null;
  }

  const nextTs = nextEntry ? parseRequiredTimestamp(nextEntry.timestamp) : updatedAtTs;
  const safeEndTs = nextTs !== null && nextTs > startTs ? nextTs : startTs + 1_000;

  return {
    entry,
    lane,
    startTs,
    safeEndTs,
    isLatest: index === lastValidEntryIndex,
    status,
    model,
    index,
  };
}

function isSkippableMessageContext(context: EntryContext, isSubagent: boolean) {
  return (
    context.entry.entryType === "message" &&
    shouldSkipMessageEntry(context.entry, isSubagent)
  );
}

function processEntryContext({
  entries,
  lane,
  userLane,
  updatedAtTs,
  status,
  model,
  displayTitle,
  isSubagent,
  index,
  lastValidEntryIndex,
  callIdToName,
  events,
  firstUserPromptSeen,
}: Omit<BuildLaneEventsArgs, "isSubagent"> & {
  isSubagent: boolean;
  index: number;
  lastValidEntryIndex: number;
  callIdToName: Map<string, string>;
  events: EventRecord[];
  firstUserPromptSeen: boolean;
}): {
  event: EventRecord | null;
  firstUserPromptSeen: boolean;
} {
  const context = createEntryContext({
    entries,
    lane,
    updatedAtTs,
    status,
    model,
    index,
    lastValidEntryIndex,
  });
  if (!context || isSkippableMessageContext(context, isSubagent)) {
    return { event: null, firstUserPromptSeen };
  }
  if (context.entry.entryType === "token_count") {
    applyTokenCountToLastEvent(events, context.entry.text);
    return { event: null, firstUserPromptSeen };
  }

  return buildEventFromEntry({
    entries,
    context,
    callIdToName,
    userLane,
    displayTitle,
    isSubagent,
    firstUserPromptSeen,
  });
}

function buildEventFromEntry({
  entries,
  context,
  callIdToName,
  userLane,
  displayTitle,
  isSubagent,
  firstUserPromptSeen,
}: {
  entries: SessionEntrySnapshot[];
  context: EntryContext;
  callIdToName: Map<string, string>;
  userLane: AgentLane | null;
  displayTitle: string;
  isSubagent: boolean;
  firstUserPromptSeen: boolean;
}) {
  switch (context.entry.entryType) {
    case "message":
      return buildMessageEvent({
        context,
        previousEntry: entries[context.index - 1],
        userLane,
        displayTitle,
        isSubagent,
        firstUserPromptSeen,
      });
    case "function_call":
      return { event: buildFunctionCallEvent(context), firstUserPromptSeen };
    case "function_call_output":
      return {
        event: buildFunctionCallOutputEvent(context, callIdToName),
        firstUserPromptSeen,
      };
    default:
      return {
        event: buildSupplementalEntryEvent(context),
        firstUserPromptSeen,
      };
  }
}

function applyEntryResult(
  events: EventRecord[],
  result: { event: EventRecord | null; firstUserPromptSeen: boolean },
) {
  if (result.event) events.push(result.event);
  return result.firstUserPromptSeen;
}
