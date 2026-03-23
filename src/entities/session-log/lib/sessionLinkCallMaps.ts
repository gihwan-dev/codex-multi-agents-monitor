import type { SessionLogSnapshot } from "../model/types";
import { buildEntryEventId, parseRequiredTimestamp } from "./helpers";

export interface CallMaps {
  callIdToName: Map<string, string>;
  spawnCallIdToEventId: Map<string, string>;
  callEventIdByCallId: Map<string, string>;
}

export function buildCallMaps({
  sessionId,
  entries,
}: {
  sessionId: string;
  entries: SessionLogSnapshot["entries"];
}): CallMaps {
  const callMaps = createEmptyCallMaps();
  for (const [index, entry] of entries.entries()) {
    registerFunctionCall({ entry, index, sessionId, callMaps });
  }
  return callMaps;
}

function createEmptyCallMaps(): CallMaps {
  return {
    callIdToName: new Map(),
    spawnCallIdToEventId: new Map(),
    callEventIdByCallId: new Map(),
  };
}

function registerFunctionCall({
  entry,
  index,
  sessionId,
  callMaps,
}: {
  entry: SessionLogSnapshot["entries"][number];
  index: number;
  sessionId: string;
  callMaps: CallMaps;
}) {
  if (!isFunctionCallEntry(entry)) {
    return;
  }

  callMaps.callIdToName.set(entry.functionCallId, entry.functionName);
  registerFunctionCallEventId({ entry, index, sessionId, callMaps });
}

function registerFunctionCallEventId({
  entry,
  index,
  sessionId,
  callMaps,
}: {
  entry: SessionLogSnapshot["entries"][number] & {
    functionCallId: string;
    functionName: string;
  };
  index: number;
  sessionId: string;
  callMaps: CallMaps;
}) {
  if (parseRequiredTimestamp(entry.timestamp) === null) {
    return;
  }

  const eventId = buildEntryEventId(sessionId, entry, index);
  callMaps.callEventIdByCallId.set(entry.functionCallId, eventId);
  if (entry.functionName === "spawn_agent") {
    callMaps.spawnCallIdToEventId.set(entry.functionCallId, eventId);
  }
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
