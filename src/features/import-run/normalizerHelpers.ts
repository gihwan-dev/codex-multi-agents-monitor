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
  return events.map((item) =>
    redactEvent(
      {
        eventId: item.event_id,
        laneId: item.lane_id,
        agentId: item.agent_id,
        threadId: item.thread_id,
        parentId: item.parent_id ?? null,
        linkIds: [],
        eventType: item.event_type,
        status: item.status,
        waitReason: item.wait_reason ?? null,
        retryCount: item.retry_count ?? 0,
        startTs: item.start_ts,
        endTs: item.end_ts ?? item.start_ts,
        durationMs: (item.end_ts ?? item.start_ts) - item.start_ts,
        title: item.title,
        inputPreview: item.input_preview ?? null,
        outputPreview: item.output_preview ?? null,
        artifactId: item.artifact_id ?? null,
        errorCode: item.error_code ?? null,
        errorMessage: item.error_message ?? null,
        provider: item.provider ?? "OpenAI",
        model: item.model ?? "gpt-5",
        toolName: item.tool_name ?? null,
        tokensIn: item.tokens_in ?? 0,
        tokensOut: item.tokens_out ?? 0,
        reasoningTokens: item.reasoning_tokens ?? 0,
        cacheReadTokens: item.cache_read_tokens ?? 0,
        cacheWriteTokens: item.cache_write_tokens ?? 0,
        costUsd: item.cost_usd ?? 0,
        finishReason: item.finish_reason ?? null,
        rawInput: item.input_raw ?? null,
        rawOutput: item.output_raw ?? null,
      },
      options,
    ),
  );
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
