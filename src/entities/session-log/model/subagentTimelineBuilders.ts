import type { AgentLane, EdgeRecord, EventRecord } from "../../run";
import { findClosestParentEvent } from "../lib/sessionLinks";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import {
  buildSubagentEventList,
  buildSubagentLane,
  buildSubagentSpawnEvent,
} from "./subagentEventBuilders";
import { resolveSubagentStatus } from "./subagentStatus";
import type { TimedSubagentSnapshot } from "./types";

interface BuildSubagentTimelineEntryOptions {
  subagent: TimedSubagentSnapshot;
  mainLane: AgentLane;
  parentTimelineEvents: EventRecord[];
  resolvedModel: string;
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
}

interface BuildSubagentTimelineResult {
  lane: AgentLane;
  events: EventRecord[];
  edge: EdgeRecord;
}

function buildSubagentTimelineEventBundle(options: {
  subagent: TimedSubagentSnapshot;
  lane: AgentLane;
  subModel: string;
  subStatus: AgentLane["laneStatus"];
  subError: string | null;
}) {
  const laneEvents = buildLaneEventsFromEntries({
    entries: options.subagent.entries,
    lane: options.lane,
    userLane: null,
    updatedAtTs: options.subagent.updatedTs,
    status: options.subStatus,
    model: options.subModel,
    displayTitle: options.subagent.agentNickname,
    isSubagent: true,
  });
  const spawnEvent = buildSubagentSpawnEvent({
    subagent: options.subagent,
    lane: options.lane,
    subModel: options.subModel,
    subError: options.subError,
    subFirstEventTs: laneEvents[0]?.startTs ?? options.subagent.startedTs,
  });
  const events = buildSubagentEventList({
    subagent: options.subagent,
    lane: options.lane,
    laneEvents,
    spawnEvent,
    subStatus: options.subStatus,
    subModel: options.subModel,
  });

  return {
    events,
    spawnEvent,
  };
}

function buildSubagentTimelineEdge(options: {
  subagent: TimedSubagentSnapshot;
  mainLane: AgentLane;
  lane: AgentLane;
  parentTimelineEvents: EventRecord[];
  subagentToSpawnSource: Map<string, string>;
  spawnEvent: EventRecord;
}): EdgeRecord {
  const sourceEventId =
    options.subagentToSpawnSource.get(options.subagent.sessionId) ??
    findClosestParentEvent({
      parentEvents: options.parentTimelineEvents,
      targetTs: options.subagent.startedTs,
    });

  return {
    edgeId: `spawn:${options.subagent.sessionId}`,
    edgeType: "spawn",
    sourceAgentId: options.mainLane.agentId,
    targetAgentId: options.lane.agentId,
    sourceEventId,
    targetEventId: options.spawnEvent.eventId,
    payloadPreview: `${options.subagent.agentNickname} (${options.subagent.agentRole})`,
    artifactId: null,
  };
}

export function buildSubagentTimelineEntry(
  options: BuildSubagentTimelineEntryOptions,
): BuildSubagentTimelineResult {
  const {
    subagent,
    mainLane,
    parentTimelineEvents,
    resolvedModel,
    subagentToSpawnSource,
    waitAgentErrors,
  } = options;
  const { subError, subModel, subStatus } = resolveSubagentStatus({
    subagent,
    resolvedModel,
    waitAgentErrors,
  });
  const lane = buildSubagentLane({ subagent, subModel, subStatus });
  const { events, spawnEvent } = buildSubagentTimelineEventBundle({
    subagent,
    lane,
    subModel,
    subStatus,
    subError,
  });
  const edge = buildSubagentTimelineEdge({
    subagent,
    mainLane,
    lane,
    parentTimelineEvents,
    subagentToSpawnSource,
    spawnEvent,
  });

  return {
    lane,
    events,
    edge,
  };
}
