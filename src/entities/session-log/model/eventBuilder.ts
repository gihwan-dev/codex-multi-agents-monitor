import type { EventRecord } from "../../run";
import { parseRequiredTimestamp } from "../lib/helpers";
import type {
  BuildLaneEventLoopOptions,
  BuildLaneEventsArgs,
  CreateEntryContextOptions,
  ProcessEntryContextOptions,
  ProcessedEntryContextOptions,
  SafeEndTimestampOptions,
} from "./eventBuilderInternalTypes";
import { buildLaneEventLoop } from "./eventBuilderLoop";
import { applyTokenCountToLastEvent } from "./eventBuilderRecord";
import type { EntryContext } from "./eventBuilderTypes";
import { buildMessageEvent, shouldSkipMessageEntry } from "./messageEntryEvents";
import { buildSupplementalEntryEvent } from "./supplementalEntryEvents";
import { buildFunctionCallEvent, buildFunctionCallOutputEvent } from "./toolEntryEvents";
import type { SessionEntrySnapshot } from "./types";

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

function buildLaneEvents(options: BuildLaneEventLoopOptions): EventRecord[] {
  return buildLaneEventLoop({
    entryCount: options.entries.length,
    buildEntryResult: (index, events, firstUserPromptSeen) =>
      processEntryContext({
        ...options,
        index,
        events,
        firstUserPromptSeen,
      }),
  });
}

function createEntryContext(options: CreateEntryContextOptions): EntryContext | null {
  const timedEntry = readTimedEntryContext(options.entries, options.index);
  return timedEntry ? buildEntryContext(options, timedEntry) : null;
}

function readTimedEntryContext(entries: SessionEntrySnapshot[], index: number) {
  const entry = entries[index];
  if (!entry) {
    return null;
  }

  const startTs = parseRequiredTimestamp(entry.timestamp);
  return startTs === null ? null : { entry, startTs };
}

function buildEntryContext(
  options: CreateEntryContextOptions,
  timedEntry: { entry: SessionEntrySnapshot; startTs: number },
): EntryContext {
  const { entries, lane, updatedAtTs, status, model, index, lastValidEntryIndex } =
    options;
  const safeEndTs = resolveSafeEndTimestamp({
    entries,
    index,
    updatedAtTs,
    startTs: timedEntry.startTs,
  });

  return {
    entry: timedEntry.entry,
    lane,
    startTs: timedEntry.startTs,
    safeEndTs,
    isLatest: index === lastValidEntryIndex,
    status,
    model,
    index,
  };
}

function resolveSafeEndTimestamp(options: SafeEndTimestampOptions) {
  const { entries, index, updatedAtTs, startTs } = options;
  const nextEntry = entries[index + 1];
  const nextTs = nextEntry ? parseRequiredTimestamp(nextEntry.timestamp) : updatedAtTs;
  return nextTs !== null && nextTs > startTs ? nextTs : startTs + 1_000;
}

function isSkippableMessageContext(context: EntryContext, isSubagent: boolean) {
  return (
    context.entry.entryType === "message" &&
    shouldSkipMessageEntry(context.entry, isSubagent)
  );
}

function processEntryContext(options: ProcessEntryContextOptions): {
  event: EventRecord | null;
  firstUserPromptSeen: boolean;
} {
  const processedContext = resolveProcessableEntryContext(options);
  if (!processedContext) {
    return { event: null, firstUserPromptSeen: options.firstUserPromptSeen };
  }

  return processBuiltEntryContext(processedContext);
}

function resolveProcessableEntryContext(
  options: ProcessEntryContextOptions,
): ProcessedEntryContextOptions | null {
  const context = createEntryContextFromProcessOptions(options);
  if (!context || isSkippableMessageContext(context, options.isSubagent)) {
    return null;
  }

  return buildProcessedEntryContext(options, context);
}

function createEntryContextFromProcessOptions(
  options: ProcessEntryContextOptions,
) {
  return createEntryContext({
    entries: options.entries,
    lane: options.lane,
    updatedAtTs: options.updatedAtTs,
    status: options.status,
    model: options.model,
    index: options.index,
    lastValidEntryIndex: options.lastValidEntryIndex,
  });
}

function buildProcessedEntryContext(
  options: ProcessEntryContextOptions,
  context: EntryContext,
): ProcessedEntryContextOptions {
  return {
    entries: options.entries,
    context,
    callIdToName: options.callIdToName,
    userLane: options.userLane,
    displayTitle: options.displayTitle,
    isSubagent: options.isSubagent,
    events: options.events,
    firstUserPromptSeen: options.firstUserPromptSeen,
  };
}

function processBuiltEntryContext(
  options: ProcessedEntryContextOptions,
): {
  event: EventRecord | null;
  firstUserPromptSeen: boolean;
} {
  const { context, events, firstUserPromptSeen } = options;
  if (context.entry.entryType === "token_count") {
    applyTokenCountToLastEvent(events, context.entry.text);
    return { event: null, firstUserPromptSeen };
  }

  return buildEventFromEntry(options);
}

function buildEventFromEntry(options: Omit<ProcessedEntryContextOptions, "events">) {
  const {
    entries,
    context,
    callIdToName,
    userLane,
    displayTitle,
    isSubagent,
    firstUserPromptSeen,
  } = options;
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

export function buildLaneEventsFromEntries(options: BuildLaneEventsArgs): EventRecord[] {
  const { callIdToName, lastValidEntryIndex } = collectEntryMetadata(options.entries);
  return buildLaneEvents({
    entries: options.entries,
    lane: options.lane,
    userLane: options.userLane,
    updatedAtTs: options.updatedAtTs,
    status: options.status,
    model: options.model,
    displayTitle: options.displayTitle,
    isSubagent: options.isSubagent ?? false,
    callIdToName,
    lastValidEntryIndex,
  });
}
