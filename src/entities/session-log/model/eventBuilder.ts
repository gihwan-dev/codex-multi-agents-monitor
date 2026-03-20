import type { AgentLane, EventRecord, RunStatus } from "../../run";
import { parseRequiredTimestamp } from "../lib/helpers";
import { sanitizeMessagePreview } from "../lib/text";
import { applyTokenCountToLastEvent, createEntryEvent } from "./eventBuilderRecord";
import type { EntryContext } from "./eventBuilderTypes";
import { buildMessageEvent, shouldSkipMessageEntry } from "./messageEntryEvents";
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
    const entry = entries[index];
    const nextEntry = entries[index + 1];
    const startTs = parseRequiredTimestamp(entry.timestamp);
    if (startTs === null) {
      continue;
    }

    const nextTs = nextEntry ? parseRequiredTimestamp(nextEntry.timestamp) : updatedAtTs;
    const safeEndTs = nextTs !== null && nextTs > startTs ? nextTs : startTs + 1_000;
    const isLatest = index === lastValidEntryIndex;
    const context: EntryContext = {
      entry,
      lane,
      startTs,
      safeEndTs,
      isLatest,
      status,
      model,
      index,
    };

    if (entry.entryType === "message" && shouldSkipMessageEntry(entry, isSubagent)) {
      continue;
    }

    switch (entry.entryType) {
      case "message": {
        const result = buildMessageEvent({
          context,
          previousEntry: entries[index - 1],
          userLane,
          displayTitle,
          isSubagent,
          firstUserPromptSeen,
        });
        firstUserPromptSeen = result.firstUserPromptSeen;
        if (result.event) {
          events.push(result.event);
        }
        break;
      }

      case "function_call":
        events.push(buildFunctionCallEvent(context));
        break;

      case "function_call_output":
        events.push(buildFunctionCallOutputEvent(context, callIdToName));
        break;
      case "token_count":
        applyTokenCountToLastEvent(events, entry.text);
        break;

      default: {
        const event = buildSupplementalEntryEvent(context);
        if (event) {
          events.push(event);
        }
      }
    }
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

function buildSupplementalEntryEvent(context: EntryContext): EventRecord | null {
  const { entry } = context;

  switch (entry.entryType) {
    case "reasoning":
      return createEntryEvent({
        ...context,
        eventType: "llm.started",
        title: "Reasoning",
        inputPreview: null,
        outputPreview: null,
      });
    case "agent_message":
      return createTextEntryEvent(context, "note", "Commentary");
    case "agent_reasoning":
      return createTextEntryEvent(context, "note", "Agent reasoning");
    case "item_completed":
      return createTextEntryEvent(context, "note", "Plan");
    case "task_started":
      return createEntryEvent({
        ...context,
        eventType: "turn.started",
        title: "Turn started",
        inputPreview: null,
        outputPreview: null,
      });
    case "task_complete":
      return createTextEntryEvent(context, "turn.finished", "Turn finished");
    case "context_compacted":
      return createEntryEvent({
        ...context,
        eventType: "note",
        title: "Context compacted",
        inputPreview: null,
        outputPreview: "Context reduced to fit within the model window",
      });
    case "turn_aborted":
      return createErrorEntryEvent(context, "Turn aborted");
    case "thread_rolled_back":
      return createErrorEntryEvent(context, "Thread rolled back");
    default:
      return null;
  }
}

function createTextEntryEvent(
  context: EntryContext,
  eventType: EventRecord["eventType"],
  title: string,
) {
  return createEntryEvent({
    ...context,
    eventType,
    title,
    inputPreview: null,
    outputPreview: context.entry.text ? sanitizeMessagePreview(context.entry.text) : null,
  });
}

function createErrorEntryEvent(context: EntryContext, fallbackReason: string) {
  const reason = context.entry.text ?? fallbackReason;

  return createEntryEvent({
    ...context,
    eventType: "error",
    title: fallbackReason,
    inputPreview: null,
    outputPreview: reason,
    errorMessage: reason,
  });
}
