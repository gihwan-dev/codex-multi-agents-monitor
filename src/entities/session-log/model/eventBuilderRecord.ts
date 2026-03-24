import type { EventRecord } from "../../run";
import { buildEntryEventId } from "../lib/helpers";
import type { EntryContext, EntryEventOptions } from "./eventBuilderTypes";

export function applyTokenCountToLastEvent(
  events: EventRecord[],
  rawTokenCount: string | null,
) {
  const lastEvent = events[events.length - 1];
  const tokens = normalizeTokenCounts(parseTokenPayload(rawTokenCount));
  if (!lastEvent || !tokens) {
    return;
  }

  Object.assign(lastEvent, tokens);
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
  const defaultMetrics = buildDefaultEventMetrics();
  return {
    eventId: resolveEntryEventId(lane.threadId, entry, index),
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
    ...defaultMetrics,
  };
}

function resolveEntryEventId(
  threadId: string,
  entry: EntryContext["entry"],
  index: number,
) {
  return buildEntryEventId(threadId, entry, index);
}

function buildDefaultEventMetrics() {
  return {
    tokensIn: 0,
    tokensOut: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    finishReason: null,
    rawInput: null,
    rawOutput: null,
  } satisfies Pick<
    EventRecord,
    | "tokensIn"
    | "tokensOut"
    | "reasoningTokens"
    | "cacheReadTokens"
    | "cacheWriteTokens"
    | "costUsd"
    | "finishReason"
    | "rawInput"
    | "rawOutput"
  >;
}

function normalizeTokenCounts(
  tokens: ReturnType<typeof parseTokenPayload>,
) {
  if (!tokens) {
    return null;
  }

  return {
    tokensIn: resolveTokenCount(tokens.in),
    tokensOut: resolveTokenCount(tokens.out),
    reasoningTokens: resolveTokenCount(tokens.reasoning),
    cacheReadTokens: resolveTokenCount(tokens.cached),
  } satisfies Pick<
    EventRecord,
    "tokensIn" | "tokensOut" | "reasoningTokens" | "cacheReadTokens"
  >;
}

function resolveTokenCount(value: number | undefined) {
  return typeof value === "number" ? value : 0;
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
