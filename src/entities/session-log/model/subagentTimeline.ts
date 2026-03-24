import type { AgentLane, EdgeRecord, EventRecord } from "../../run";
import { buildTimedSubagentSnapshots } from "../lib/helpers";
import {
  buildLatestSubagentEventBySessionId,
  buildSessionLinkMaps,
  indexSubagents,
} from "../lib/sessionLinks";
import type { SessionLinkContext } from "./subagentLinkTypes";
import { buildSubagentTimelineEntry } from "./subagentTimelineBuilders";
import type { SessionLogSnapshot, TimedSubagentSnapshot } from "./types";

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

interface SubagentTimelineContext {
  subagents: TimedSubagentSnapshot[];
  indexedSubagents: ReturnType<typeof indexSubagents>;
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
  sessionLinks: SessionLinkContext;
}

interface SubagentTimelineBuffers {
  lanes: AgentLane[];
  events: EventRecord[];
  edges: EdgeRecord[];
}

export function buildSubagentTimeline(
  options: BuildSubagentTimelineOptions,
): BuildSubagentTimelineResult {
  const { snapshot, mainLane, parentEvents, parentTimelineEvents, resolvedModel } = options;
  const timelineContext = createSubagentTimelineContext(snapshot, parentEvents);
  const buffers = createSubagentTimelineBuffers();

  for (const subagent of timelineContext.subagents) {
    appendSubagentTimelineEntry(
      buffers,
      buildSubagentTimelineEntry({
        subagent,
        mainLane,
        parentTimelineEvents,
        resolvedModel,
        subagentToSpawnSource: timelineContext.subagentToSpawnSource,
        waitAgentErrors: timelineContext.waitAgentErrors,
      }),
    );
  }

  return {
    ...buffers,
    indexedSubagents: timelineContext.indexedSubagents,
    subagentToSpawnSource: timelineContext.subagentToSpawnSource,
    latestSubagentEventBySessionId: buildLatestSubagentEventBySessionId(buffers.events),
    sessionLinks: timelineContext.sessionLinks,
  };
}

function createSubagentTimelineContext(
  snapshot: SessionLogSnapshot,
  parentEvents: EventRecord[],
): SubagentTimelineContext {
  const subagents = buildTimedSubagentSnapshots(snapshot.subagents ?? []);
  const indexedSubagents = indexSubagents(subagents);
  const sessionLinkMaps = buildSessionLinkMaps({
    sessionId: snapshot.sessionId,
    entries: snapshot.entries,
    parentEvents,
    subagents,
    indexedSubagents,
  });

  return {
    subagents,
    indexedSubagents,
    subagentToSpawnSource: sessionLinkMaps.subagentToSpawnSource,
    waitAgentErrors: sessionLinkMaps.waitAgentErrors,
    sessionLinks: {
      callEventToOutputEvent: sessionLinkMaps.callEventToOutputEvent,
      codexAgentIdToSessionId: sessionLinkMaps.codexAgentIdToSessionId,
      parentFunctionArgsByEventId: sessionLinkMaps.parentFunctionArgsByEventId,
    },
  };
}

function createSubagentTimelineBuffers(): SubagentTimelineBuffers {
  return {
    lanes: [],
    events: [],
    edges: [],
  };
}

function appendSubagentTimelineEntry(
  buffers: SubagentTimelineBuffers,
  entry: {
    lane: AgentLane;
    events: EventRecord[];
    edge: EdgeRecord;
  },
) {
  buffers.lanes.push(entry.lane);
  buffers.events.push(...entry.events);
  buffers.edges.push(entry.edge);
}
