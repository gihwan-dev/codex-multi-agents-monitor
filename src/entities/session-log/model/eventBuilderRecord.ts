import type { EventRecord } from "../../run";
import { buildEntryEventId } from "../lib/helpers";
import type { EntryContext, EntryEventOptions } from "./eventBuilderTypes";
import { normalizeEntryTokenMetrics } from "./eventTokenMetrics";

const DEFAULT_EVENT_METRICS = {
  tokensIn: 0,
  tokensOut: 0,
  reasoningTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  measuredContextWindowTokens: null,
  measuredCumulativeTokens: null,
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
  | "measuredContextWindowTokens"
  | "measuredCumulativeTokens"
  | "costUsd"
  | "finishReason"
  | "rawInput"
  | "rawOutput"
>;

export function applyTokenCountToLastEvent(
  events: EventRecord[],
  rawTokenCount: string | null,
) {
  const lastEvent = events[events.length - 1];
  const tokens = normalizeEntryTokenMetrics(rawTokenCount);
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
  return {
    ...buildEntryEventIdentity(lane, entry, index),
    ...buildEntryEventLifecycle(
      { eventType, startTs, safeEndTs, isLatest, status, waitReason },
    ),
    ...buildEntryEventPresentation({
      provider: lane.provider,
      title,
      inputPreview,
      outputPreview,
      errorMessage,
      model,
      toolName,
    }),
    ...DEFAULT_EVENT_METRICS,
  };
}

function buildEntryEventIdentity(
  lane: EntryContext["lane"],
  entry: EntryContext["entry"],
  index: number,
) {
  return {
    eventId: buildEntryEventId(lane.threadId, entry, index),
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
  } satisfies Pick<
    EventRecord,
    "eventId" | "parentId" | "linkIds" | "laneId" | "agentId" | "threadId"
  >;
}

function buildEntryEventLifecycle({
  eventType,
  startTs,
  safeEndTs,
  isLatest,
  status,
  waitReason,
}: {
  eventType: EventRecord["eventType"];
  startTs: number;
  safeEndTs: number;
  isLatest: boolean;
  status: EventRecord["status"];
  waitReason: EventRecord["waitReason"] | undefined;
}) {
  return {
    eventType,
    status: resolveEventStatus(isLatest, status),
    waitReason: waitReason ?? null,
    retryCount: 0,
    startTs,
    endTs: safeEndTs,
    durationMs: Math.max(safeEndTs - startTs, 1_000),
  } satisfies Pick<
    EventRecord,
    | "eventType"
    | "status"
    | "waitReason"
    | "retryCount"
    | "startTs"
    | "endTs"
    | "durationMs"
  >;
}

interface EntryEventPresentationOptions {
  provider: EventRecord["provider"];
  title: string;
  inputPreview: string | null;
  outputPreview: string | null;
  errorMessage: string | undefined;
  model: string | null;
  toolName: string | undefined;
}

function buildEntryEventPresentation(options: EntryEventPresentationOptions) {
  const {
    provider,
    title,
    inputPreview,
    outputPreview,
    errorMessage,
    model,
    toolName,
  } = options;
  return {
    title,
    inputPreview,
    outputPreview,
    artifactId: null,
    errorCode: null,
    errorMessage: errorMessage ?? null,
    provider,
    model,
    toolName: toolName ?? null,
  } satisfies Pick<
    EventRecord,
    | "title"
    | "inputPreview"
    | "outputPreview"
    | "artifactId"
    | "errorCode"
    | "errorMessage"
    | "provider"
    | "model"
    | "toolName"
  >;
}

function resolveEventStatus(
  isLatest: boolean,
  status: EventRecord["status"],
): EventRecord["status"] {
  return isLatest ? status : "done";
}
