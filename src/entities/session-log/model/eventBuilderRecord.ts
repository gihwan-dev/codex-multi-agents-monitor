import type { EventRecord } from "../../run";
import { buildEntryEventId } from "../lib/helpers";
import type { EntryContext, EntryEventOptions } from "./eventBuilderTypes";

export function applyTokenCountToLastEvent(
  events: EventRecord[],
  rawTokenCount: string | null,
) {
  const lastEvent = events[events.length - 1];
  const tokens = parseTokenPayload(rawTokenCount);
  if (!lastEvent || !tokens) {
    return;
  }

  lastEvent.tokensIn = tokens.in ?? 0;
  lastEvent.tokensOut = tokens.out ?? 0;
  lastEvent.reasoningTokens = tokens.reasoning ?? 0;
  lastEvent.cacheReadTokens = tokens.cached ?? 0;
}

export function createEntryEvent({
  entry,
  lane,
  startTs,
  safeEndTs,
  isLatest,
  status,
  model,
  index,
  eventType,
  title,
  inputPreview,
  outputPreview,
  toolName,
  waitReason,
  errorMessage,
}: EntryContext & EntryEventOptions): EventRecord {
  return {
    eventId: buildEntryEventId(lane.threadId, entry, index),
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType,
    status: isLatest ? status : "done",
    waitReason: waitReason ?? null,
    retryCount: 0,
    startTs,
    endTs: safeEndTs,
    durationMs: Math.max(safeEndTs - startTs, 1_000),
    title,
    inputPreview,
    outputPreview,
    artifactId: null,
    errorCode: null,
    errorMessage: errorMessage ?? null,
    provider: "OpenAI",
    model,
    toolName: toolName ?? null,
    tokensIn: 0,
    tokensOut: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    finishReason: null,
    rawInput: null,
    rawOutput: null,
  };
}

function parseTokenPayload(rawTokenCount: string | null) {
  if (!rawTokenCount) {
    return null;
  }

  try {
    return JSON.parse(rawTokenCount) as {
      in?: number;
      cached?: number;
      out?: number;
      reasoning?: number;
    };
  } catch {
    return null;
  }
}
