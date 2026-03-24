import type { AgentLane, EventRecord } from "../../run";
import { buildRunEndEvent } from "./runBoundaryEvents";
import type { TimedSubagentSnapshot } from "./types";

interface BuildSubagentLaneOptions {
  subagent: TimedSubagentSnapshot;
  subModel: string;
  subStatus: AgentLane["laneStatus"];
}

interface BuildSubagentSpawnEventOptions {
  subagent: TimedSubagentSnapshot;
  lane: AgentLane;
  subModel: string;
  subError: string | null;
  subFirstEventTs: number;
}

interface BuildSubagentEventListOptions {
  subagent: TimedSubagentSnapshot;
  lane: AgentLane;
  laneEvents: EventRecord[];
  spawnEvent: EventRecord;
  subStatus: AgentLane["laneStatus"];
  subModel: string;
}

export function buildSubagentLane(
  options: BuildSubagentLaneOptions,
): AgentLane {
  return {
    laneId: `${options.subagent.sessionId}:sub`,
    agentId: `${options.subagent.sessionId}:sub`,
    threadId: options.subagent.sessionId,
    name: options.subagent.agentNickname,
    role: options.subagent.agentRole,
    model: options.subModel,
    provider: "OpenAI",
    badge: "Subagent",
    laneStatus: options.subStatus,
  };
}

export function buildSubagentSpawnEvent(
  options: BuildSubagentSpawnEventOptions,
): EventRecord {
  return {
    eventId: `${options.subagent.sessionId}:spawn`,
    parentId: null,
    linkIds: [],
    laneId: options.lane.laneId,
    agentId: options.lane.agentId,
    threadId: options.lane.threadId,
    eventType: "agent.spawned",
    status: options.subError ? "failed" : "done",
    waitReason: null,
    retryCount: 0,
    startTs: options.subagent.startedTs,
    endTs: Math.max(options.subFirstEventTs, options.subagent.startedTs + 1_000),
    durationMs: Math.max(options.subFirstEventTs - options.subagent.startedTs, 1_000),
    title: `${options.subagent.agentNickname} spawned`,
    inputPreview: options.subagent.agentRole,
    outputPreview: null,
    artifactId: null,
    errorCode: null,
    errorMessage: options.subError,
    provider: "OpenAI",
    model: options.subModel,
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

export function buildSubagentEventList(
  options: BuildSubagentEventListOptions,
): EventRecord[] {
  const endEvent = buildRunEndEvent({
    sessionId: options.subagent.sessionId,
    lane: options.lane,
    updatedTs: options.subagent.updatedTs,
    status: options.subStatus,
    model: options.subModel,
  });

  return [options.spawnEvent, ...options.laneEvents, ...(endEvent ? [endEvent] : [])];
}
