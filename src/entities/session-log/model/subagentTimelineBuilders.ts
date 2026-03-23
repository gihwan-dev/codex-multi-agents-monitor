import type { AgentLane, EdgeRecord, EventRecord } from "../../run";
import { findClosestParentEvent } from "../lib/sessionLinks";
import { deriveSessionLogStatus } from "../lib/text";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import { buildRunEndEvent } from "./runBoundaryEvents";
import type { TimedSubagentSnapshot } from "./types";

export interface SubagentStatus {
  subError: string | null;
  subModel: string;
  subStatus: AgentLane["laneStatus"];
}

interface BuildSubagentTimelineEntryOptions {
  subagent: TimedSubagentSnapshot;
  mainLane: AgentLane;
  parentTimelineEvents: EventRecord[];
  resolvedModel: string;
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
}

export function resolveSubagentStatus(
  subagent: TimedSubagentSnapshot,
  resolvedModel: string,
  waitAgentErrors: Map<string, string>,
): SubagentStatus {
  const subModel = subagent.model ?? resolvedModel;
  const subError = subagent.error ?? waitAgentErrors.get(subagent.sessionId) ?? null;
  return {
    subError,
    subModel,
    subStatus: normalizeSubagentStatus(subagent, subError),
  };
}

export function buildSubagentLane(
  subagent: TimedSubagentSnapshot,
  subModel: string,
  subStatus: AgentLane["laneStatus"],
): AgentLane {
  return {
    laneId: `${subagent.sessionId}:sub`,
    agentId: `${subagent.sessionId}:sub`,
    threadId: subagent.sessionId,
    name: subagent.agentNickname,
    role: subagent.agentRole,
    model: subModel,
    provider: "OpenAI",
    badge: "Subagent",
    laneStatus: subStatus,
  };
}

export function buildSubagentTimelineEntry({
  subagent,
  mainLane,
  parentTimelineEvents,
  resolvedModel,
  subagentToSpawnSource,
  waitAgentErrors,
}: BuildSubagentTimelineEntryOptions) {
  const { subError, subModel, subStatus } = resolveSubagentStatus(
    subagent,
    resolvedModel,
    waitAgentErrors,
  );
  const lane = buildSubagentLane(subagent, subModel, subStatus);
  const laneEvents = buildLaneEventsFromEntries({
    entries: subagent.entries,
    lane,
    userLane: null,
    updatedAtTs: subagent.updatedTs,
    status: subStatus,
    model: subModel,
    displayTitle: subagent.agentNickname,
    isSubagent: true,
  });
  const spawnEvent = buildSubagentSpawnEvent({
    subagent,
    lane,
    subModel,
    subError,
    subFirstEventTs: laneEvents[0]?.startTs ?? subagent.startedTs,
  });

  return {
    lane,
    events: buildSubagentEventList({ subagent, lane, laneEvents, spawnEvent, subStatus, subModel }),
    edge: buildSubagentSpawnEdge({
      subagent,
      lane,
      spawnEvent,
      mainLane,
      parentTimelineEvents,
      subagentToSpawnSource,
    }),
  };
}

function normalizeSubagentStatus(
  subagent: TimedSubagentSnapshot,
  subError: string | null,
): AgentLane["laneStatus"] {
  const baseStatus = deriveSessionLogStatus(subagent.entries, true);
  if (subError && baseStatus !== "interrupted") {
    return "interrupted";
  }
  if (subagent.entries.length === 0 && !subError && baseStatus === "done") {
    return "running";
  }
  return baseStatus;
}

function buildSubagentSpawnEvent({
  subagent,
  lane,
  subModel,
  subError,
  subFirstEventTs,
}: {
  subagent: TimedSubagentSnapshot;
  lane: AgentLane;
  subModel: string;
  subError: string | null;
  subFirstEventTs: number;
}): EventRecord {
  return {
    eventId: `${subagent.sessionId}:spawn`,
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType: "agent.spawned",
    status: subError ? "failed" : "done",
    waitReason: null,
    retryCount: 0,
    startTs: subagent.startedTs,
    endTs: Math.max(subFirstEventTs, subagent.startedTs + 1_000),
    durationMs: Math.max(subFirstEventTs - subagent.startedTs, 1_000),
    title: `${subagent.agentNickname} spawned`,
    inputPreview: subagent.agentRole,
    outputPreview: null,
    artifactId: null,
    errorCode: null,
    errorMessage: subError,
    provider: "OpenAI",
    model: subModel,
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

function buildSubagentEventList({
  subagent,
  lane,
  laneEvents,
  spawnEvent,
  subStatus,
  subModel,
}: {
  subagent: TimedSubagentSnapshot;
  lane: AgentLane;
  laneEvents: EventRecord[];
  spawnEvent: EventRecord;
  subStatus: AgentLane["laneStatus"];
  subModel: string;
}) {
  const endEvent = buildRunEndEvent({
    sessionId: subagent.sessionId,
    lane,
    updatedTs: subagent.updatedTs,
    status: subStatus,
    model: subModel,
  });
  return [spawnEvent, ...laneEvents, ...(endEvent ? [endEvent] : [])];
}

function buildSubagentSpawnEdge({
  subagent,
  lane,
  spawnEvent,
  mainLane,
  parentTimelineEvents,
  subagentToSpawnSource,
}: {
  subagent: TimedSubagentSnapshot;
  lane: AgentLane;
  spawnEvent: EventRecord;
  mainLane: AgentLane;
  parentTimelineEvents: EventRecord[];
  subagentToSpawnSource: Map<string, string>;
}) {
  const sourceEventId =
    subagentToSpawnSource.get(subagent.sessionId) ??
    findClosestParentEvent(parentTimelineEvents, subagent.startedTs);
  return {
    edgeId: `spawn:${subagent.sessionId}`,
    edgeType: "spawn",
    sourceAgentId: mainLane.agentId,
    targetAgentId: lane.agentId,
    sourceEventId,
    targetEventId: spawnEvent.eventId,
    payloadPreview: `${subagent.agentNickname} (${subagent.agentRole})`,
    artifactId: null,
  } satisfies EdgeRecord;
}
