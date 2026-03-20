import type { RawImportEvent, RawImportPayload, RunDataset } from "../../entities/run/index.js";

export function buildExportPayload(dataset: RunDataset, includeRaw: boolean): string {
  const payload: RawImportPayload = {
    project: dataset.project,
    session: dataset.session,
    run: {
      ...dataset.run,
      rawIncluded: includeRaw && dataset.run.rawIncluded,
      noRawStorage: !includeRaw,
      summaryMetrics: dataset.run.summaryMetrics,
    },
    lanes: dataset.lanes,
    events: dataset.events.map((event) => serializeExportEvent(event, includeRaw)),
    edges: dataset.edges,
    artifacts: dataset.artifacts.map((artifact) => ({
      ...artifact,
      rawContent: includeRaw ? artifact.rawContent : null,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

function serializeExportEvent(event: RunDataset["events"][number], includeRaw: boolean): RawImportEvent {
  return {
    event_id: event.eventId,
    lane_id: event.laneId,
    agent_id: event.agentId,
    thread_id: event.threadId,
    parent_id: event.parentId,
    event_type: event.eventType,
    status: event.status,
    wait_reason: event.waitReason,
    retry_count: event.retryCount,
    start_ts: event.startTs,
    end_ts: event.endTs,
    title: event.title,
    input_preview: event.inputPreview,
    output_preview: event.outputPreview,
    input_raw: includeRaw ? event.rawInput : null,
    output_raw: includeRaw ? event.rawOutput : null,
    artifact_id: event.artifactId,
    error_code: event.errorCode,
    error_message: event.errorMessage,
    provider: event.provider,
    model: event.model,
    tool_name: event.toolName,
    tokens_in: event.tokensIn,
    tokens_out: event.tokensOut,
    reasoning_tokens: event.reasoningTokens,
    cache_read_tokens: event.cacheReadTokens,
    cache_write_tokens: event.cacheWriteTokens,
    cost_usd: event.costUsd,
    finish_reason: event.finishReason,
  };
}
