import type { AgentLane, EdgeRecord, EventRecord } from "../../run";
import { buildTimedSubagentSnapshots } from "../lib/helpers";
import {
  buildLatestSubagentEventBySessionId,
  buildSessionLinkMaps,
  findClosestParentEvent,
  indexSubagents,
} from "../lib/sessionLinks";
import { deriveSessionLogStatus } from "../lib/text";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import { buildRunEndEvent } from "./runBoundaryEvents";
import type { SessionLogSnapshot, TimedSubagentSnapshot } from "./types";

interface SessionLinkContext {
  callEventToOutputEvent: Map<string, string>;
  codexAgentIdToSessionId: Map<string, string>;
  parentFunctionArgsByEventId: Map<string, string | null>;
}

interface BuildSubagentTimelineOptions {
  snapshot: SessionLogSnapshot;
  mainLane: AgentLane;
  parentEvents: EventRecord[];
  parentTimelineEvents: EventRecord[];
  resolvedModel: string;
}

interface BuildSubagentTimelineResult {
  lanes: AgentLane[];
  events: EventRecord[];
  edges: EdgeRecord[];
  indexedSubagents: ReturnType<typeof indexSubagents>;
  subagentToSpawnSource: Map<string, string>;
  latestSubagentEventBySessionId: Map<string, EventRecord>;
  sessionLinks: SessionLinkContext;
}

interface SubagentStatus {
  subError: string | null;
  subModel: string;
  subStatus: AgentLane["laneStatus"];
}

function resolveSubagentStatus(
  subagent: TimedSubagentSnapshot,
  resolvedModel: string,
  waitAgentErrors: Map<string, string>,
): SubagentStatus {
  const subModel = subagent.model ?? resolvedModel;
  let subStatus = deriveSessionLogStatus(subagent.entries, true);

  const subError = subagent.error ?? waitAgentErrors.get(subagent.sessionId) ?? null;
  if (subError && subStatus !== "interrupted") {
    subStatus = "interrupted";
  }
  if (subagent.entries.length === 0 && !subError && subStatus === "done") {
    subStatus = "running";
  }

  return {
    subError,
    subModel,
    subStatus,
  };
}

function buildSubagentLane(
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

function buildSubagentSpawnEvent(
  subagent: TimedSubagentSnapshot,
  lane: AgentLane,
  subModel: string,
  subError: string | null,
  subFirstEventTs: number,
): EventRecord {
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

export function buildSubagentTimeline({
  snapshot,
  mainLane,
  parentEvents,
  parentTimelineEvents,
  resolvedModel,
}: BuildSubagentTimelineOptions): BuildSubagentTimelineResult {
  const subagents = buildTimedSubagentSnapshots(snapshot.subagents ?? []);
  const indexedSubagents = indexSubagents(subagents);
  const {
    subagentToSpawnSource,
    waitAgentErrors,
    codexAgentIdToSessionId,
    callEventToOutputEvent,
    parentFunctionArgsByEventId,
  } = buildSessionLinkMaps({
    sessionId: snapshot.sessionId,
    entries: snapshot.entries,
    parentEvents,
    subagents,
    indexedSubagents,
  });

  const lanes: AgentLane[] = [];
  const events: EventRecord[] = [];
  const edges: EdgeRecord[] = [];

  for (const subagent of subagents) {
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
    const subFirstEventTs = laneEvents[0]?.startTs ?? subagent.startedTs;
    const spawnEvent = buildSubagentSpawnEvent(
      subagent,
      lane,
      subModel,
      subError,
      subFirstEventTs,
    );
    const endEvent = buildRunEndEvent(
      subagent.sessionId,
      lane,
      subagent.updatedTs,
      subStatus,
      subModel,
    );

    lanes.push(lane);
    events.push(spawnEvent, ...laneEvents, ...(endEvent ? [endEvent] : []));

    const sourceEventId =
      subagentToSpawnSource.get(subagent.sessionId) ??
      findClosestParentEvent(parentTimelineEvents, subagent.startedTs);
    edges.push({
      edgeId: `spawn:${subagent.sessionId}`,
      edgeType: "spawn",
      sourceAgentId: mainLane.agentId,
      targetAgentId: lane.agentId,
      sourceEventId,
      targetEventId: spawnEvent.eventId,
      payloadPreview: `${subagent.agentNickname} (${subagent.agentRole})`,
      artifactId: null,
    });
  }

  return {
    lanes,
    events,
    edges,
    indexedSubagents,
    subagentToSpawnSource,
    latestSubagentEventBySessionId: buildLatestSubagentEventBySessionId(events),
    sessionLinks: {
      callEventToOutputEvent,
      codexAgentIdToSessionId,
      parentFunctionArgsByEventId,
    },
  };
}
