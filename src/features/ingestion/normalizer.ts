import { calculateSummaryMetrics, type RawImportPayload, type RunDataset } from "../../shared/domain/index.js";
import { type RedactionOptions, redactEvent } from "./redactor.js";

export function normalizeImportPayload(
  payload: RawImportPayload,
  options: RedactionOptions,
): RunDataset {
  const events = payload.events.map((item) =>
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

  const durationMs =
    payload.run.durationMs ??
    Math.max(...events.map((item) => item.endTs ?? item.startTs)) - payload.run.startTs;

  const normalized: RunDataset = {
    project: payload.project,
    session: payload.session,
    run: {
      ...payload.run,
      durationMs,
      summaryMetrics: {
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
      },
      rawIncluded: options.allowRaw && !options.noRawStorage,
      noRawStorage: options.noRawStorage,
      isArchived: false,
    },
    lanes: payload.lanes,
    events,
    edges: payload.edges,
    artifacts: payload.artifacts.map((item) => ({
      ...item,
      rawContent: options.allowRaw && !options.noRawStorage ? item.rawContent : null,
    })),
  };

  return {
    ...normalized,
    run: {
      ...normalized.run,
      summaryMetrics: calculateSummaryMetrics(normalized),
    },
  };
}
