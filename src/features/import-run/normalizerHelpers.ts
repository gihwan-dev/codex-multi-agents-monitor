import type { RawImportPayload, RunDataset, SummaryMetrics } from "../../entities/run";
import type { RedactionOptions } from "./redactor.js";
import { redactEvent } from "./redactor.js";

const EMPTY_SUMMARY_METRICS: SummaryMetrics = {
  totalDurationMs: 0,
  activeTimeMs: 0,
  idleTimeMs: 0,
  longestGapMs: 0,
  agentCount: 0,
  peakParallelism: 0,
  llmCalls: 0,
  toolCalls: 0,
  tokens: 0,
  costUsd: 0,
  errorCount: 0,
};

export function normalizeImportEvents(
  events: RawImportPayload["events"],
  options: RedactionOptions,
): RunDataset["events"] {
  return events.map((item) => normalizeImportEvent(item, options));
}

export function resolveImportDurationMs(
  run: RawImportPayload["run"],
  events: RunDataset["events"],
) {
  const latestObservedTs = events.reduce(
    (latestTs, event) => Math.max(latestTs, event.endTs ?? event.startTs),
    run.endTs ?? run.startTs,
  );

  return run.durationMs ?? Math.max(latestObservedTs - run.startTs, 0);
}

export function buildNormalizedImportRun(
  run: RawImportPayload["run"],
  durationMs: number,
  options: RedactionOptions,
): RunDataset["run"] {
  return {
    ...run,
    durationMs,
    summaryMetrics: EMPTY_SUMMARY_METRICS,
    rawIncluded: options.allowRaw && !options.noRawStorage,
    noRawStorage: options.noRawStorage,
    isArchived: false,
  };
}

export function normalizeImportArtifacts(
  artifacts: RawImportPayload["artifacts"],
  options: RedactionOptions,
): RunDataset["artifacts"] {
  return artifacts.map((item) => ({
    ...item,
    rawContent: options.allowRaw && !options.noRawStorage ? item.rawContent : null,
  }));
}

function normalizeImportEvent(
  item: RawImportPayload["events"][number],
  options: RedactionOptions,
) {
  return redactEvent(buildNormalizedImportEventRecord(item), options);
}

function buildNormalizedImportEventRecord(
  item: RawImportPayload["events"][number],
) {
  const endTs = resolveImportEventEndTs(item);
  return {
    ...buildNormalizedImportEventIdentity(item),
    ...buildNormalizedImportEventTiming(item, endTs),
    ...buildNormalizedImportEventPreview(item),
    ...buildNormalizedImportEventUsage(item),
    ...buildNormalizedImportEventMetadata(item),
  };
}

function buildNormalizedImportEventIdentity(
  item: RawImportPayload["events"][number],
) {
  return {
    eventId: item.event_id,
    laneId: item.lane_id,
    agentId: item.agent_id,
    threadId: item.thread_id,
    parentId: readNullable(item.parent_id),
    linkIds: [],
    eventType: item.event_type,
    status: item.status,
    title: item.title,
  };
}

function buildNormalizedImportEventTiming(
  item: RawImportPayload["events"][number],
  endTs: number,
) {
  return {
    startTs: item.start_ts,
    endTs,
    durationMs: endTs - item.start_ts,
    retryCount: readNumber(item.retry_count),
    waitReason: readNullable(item.wait_reason),
  };
}

function buildNormalizedImportEventPreview(
  item: RawImportPayload["events"][number],
) {
  return {
    inputPreview: readNullable(item.input_preview),
    outputPreview: readNullable(item.output_preview),
    rawInput: readNullable(item.input_raw),
    rawOutput: readNullable(item.output_raw),
  };
}

function buildNormalizedImportEventUsage(
  item: RawImportPayload["events"][number],
) {
  return {
    tokensIn: readNumber(item.tokens_in),
    tokensOut: readNumber(item.tokens_out),
    reasoningTokens: readNumber(item.reasoning_tokens),
    cacheReadTokens: readNumber(item.cache_read_tokens),
    cacheWriteTokens: readNumber(item.cache_write_tokens),
    costUsd: readNumber(item.cost_usd),
  };
}

function buildNormalizedImportEventMetadata(
  item: RawImportPayload["events"][number],
) {
  return {
    artifactId: readNullable(item.artifact_id),
    errorCode: readNullable(item.error_code),
    errorMessage: readNullable(item.error_message),
    provider: readWithDefault(item.provider, "OpenAI"),
    model: readWithDefault(item.model, "gpt-5"),
    toolName: readNullable(item.tool_name),
    finishReason: readNullable(item.finish_reason),
  };
}

function resolveImportEventEndTs(item: RawImportPayload["events"][number]) {
  return readWithDefault(item.end_ts, item.start_ts);
}

function readNullable<T>(value: T | null | undefined) {
  return value ?? null;
}

function readNumber(value: number | null | undefined) {
  return value ?? 0;
}

function readWithDefault<T>(value: T | null | undefined, fallback: T) {
  return value ?? fallback;
}
