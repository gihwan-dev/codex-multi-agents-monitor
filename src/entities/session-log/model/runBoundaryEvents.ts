import type {
  AgentLane,
  EventRecord,
  RunStatus,
} from "../../run";

interface BuildRunStartEventOptions {
  sessionId: string;
  lane: AgentLane;
  startTs: number;
  firstEventTs: number;
  hasParentEvents: boolean;
  status: RunStatus;
  model: string;
}

interface BuildRunEndEventOptions {
  sessionId: string;
  lane: AgentLane;
  updatedTs: number;
  status: RunStatus;
  model: string;
}

export function buildRunStartEvent(options: BuildRunStartEventOptions): EventRecord {
  const { sessionId, lane, startTs, firstEventTs, hasParentEvents, status, model } =
    options;
  return {
    eventId: `${sessionId}:run-start`,
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType: "run.started",
    status: !hasParentEvents && status === "running" ? "running" : "done",
    waitReason: null,
    retryCount: 0,
    startTs,
    endTs: Math.max(firstEventTs, startTs + 1_000),
    durationMs: Math.max(firstEventTs - startTs, 1_000),
    title: "Session started",
    inputPreview: null,
    outputPreview: null,
    artifactId: null,
    errorCode: null,
    errorMessage: null,
    provider: lane.provider,
    model,
    toolName: null,
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

export function buildRunEndEvent(options: BuildRunEndEventOptions): EventRecord | null {
  const { sessionId, lane, updatedTs, status, model } = options;
  if (status === "running") return null;

  const { eventType, title } = resolveRunEndMetadata(status);
  return {
    eventId: `${sessionId}:run-finished`, parentId: null, linkIds: [],
    laneId: lane.laneId, agentId: lane.agentId, threadId: lane.threadId,
    eventType, status, waitReason: null, retryCount: 0, startTs: updatedTs,
    endTs: updatedTs + 1_000, durationMs: 1_000, title, inputPreview: null,
    outputPreview: null, artifactId: null, errorCode: null, errorMessage: null,
    provider: lane.provider, model, toolName: null, tokensIn: 0, tokensOut: 0,
    reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0,
    finishReason: null, rawInput: null, rawOutput: null,
  } satisfies EventRecord;
}

function resolveRunEndMetadata(status: RunStatus) {
  return status === "interrupted"
    ? { eventType: "run.cancelled" as const, title: "Session interrupted" }
    : { eventType: "run.finished" as const, title: "Session finished" };
}
