import {
  type AgentLane,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type RunDataset,
} from "../../run";
import {
  parseRequiredTimestamp,
} from "../lib/helpers";
import {
  deriveSessionLogStatus,
  deriveSessionLogTitle,
} from "../lib/text";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import { buildPromptAssembly } from "./promptAssembly";
import {
  buildRunEndEvent,
  buildRunStartEvent,
} from "./runBoundaryEvents";
import {
  applySubagentToolMetadata,
  buildSubagentMergeEdges,
  labelSpawnSourceEvents,
} from "./subagentLinks";
import { buildSubagentTimeline } from "./subagentTimeline";
import type {
  SessionLogSnapshot,
} from "./types";

export function buildDatasetFromSessionLog(snapshot: SessionLogSnapshot): RunDataset | null {
  const startTs = parseRequiredTimestamp(snapshot.startedAt);
  const updatedAtTs = parseRequiredTimestamp(snapshot.updatedAt);
  if (startTs === null || updatedAtTs === null) {
    return null;
  }
  const updatedTs = Math.max(updatedAtTs, startTs);

  const displayTitle = deriveSessionLogTitle(snapshot.entries);
  const status = deriveSessionLogStatus(snapshot.entries);
  const mainLaneId = `${snapshot.sessionId}:main`;
  const userLaneId = `${snapshot.sessionId}:user`;
  const resolvedModel = snapshot.model ?? "unknown";

  const userLane: AgentLane = {
    laneId: userLaneId,
    agentId: userLaneId,
    threadId: snapshot.sessionId,
    name: "User",
    role: "user",
    model: "human",
    provider: "Human",
    badge: "User",
    laneStatus: "done",
  };

  const mainLane: AgentLane = {
    laneId: mainLaneId,
    agentId: mainLaneId,
    threadId: snapshot.sessionId,
    name: "Main thread",
    role: "session",
    model: resolvedModel,
    provider: "OpenAI",
    badge: "Desktop",
    laneStatus: status,
  };

  const parentEvents = buildLaneEventsFromEntries({
    entries: snapshot.entries,
    lane: mainLane,
    userLane,
    updatedAtTs: updatedTs,
    status,
    model: resolvedModel,
    displayTitle,
  });

  const hasUserEvents = parentEvents.some((event) => event.laneId === userLaneId);

  const firstEventTs = parentEvents[0]?.startTs ?? updatedTs;
  const runStartEvent = buildRunStartEvent({
    sessionId: snapshot.sessionId,
    lane: mainLane,
    startTs,
    firstEventTs,
    hasParentEvents: parentEvents.length > 0,
    status,
    model: resolvedModel,
  });

  const runEndEvent = buildRunEndEvent(
    snapshot.sessionId,
    mainLane,
    updatedTs,
    status,
    resolvedModel,
  );

  const allLanes: AgentLane[] = hasUserEvents ? [userLane, mainLane] : [mainLane];
  const allEvents: EventRecord[] = [
    runStartEvent,
    ...parentEvents,
    ...(runEndEvent ? [runEndEvent] : []),
  ];
  const parentTimelineEvents = [runStartEvent, ...parentEvents];
  const subagentTimeline = buildSubagentTimeline({
    snapshot,
    mainLane,
    parentEvents,
    parentTimelineEvents,
    resolvedModel,
  });
  allLanes.push(...subagentTimeline.lanes);
  allEvents.push(...subagentTimeline.events);
  const allEdges: EdgeRecord[] = [...subagentTimeline.edges];

  const eventsById = new Map(allEvents.map((event) => [event.eventId, event]));

  labelSpawnSourceEvents(
    subagentTimeline.subagentToSpawnSource,
    subagentTimeline.indexedSubagents,
    eventsById,
  );
  allEdges.push(
    ...buildSubagentMergeEdges({
      parentEvents,
      mainLane,
      indexedSubagents: subagentTimeline.indexedSubagents,
      eventsById,
      latestSubagentEventBySessionId: subagentTimeline.latestSubagentEventBySessionId,
      sessionLinks: subagentTimeline.sessionLinks,
    }),
  );
  applySubagentToolMetadata(
    allEvents,
    subagentTimeline.indexedSubagents,
    subagentTimeline.sessionLinks,
  );

  const selectedByDefaultId =
    parentEvents[parentEvents.length - 1]?.eventId ?? runStartEvent.eventId;

  const dataset: RunDataset = {
    project: {
      projectId: snapshot.originPath,
      name: snapshot.displayName,
      repoPath: snapshot.originPath,
      badge: "Desktop",
    },
    session: {
      sessionId: snapshot.sessionId,
      title: displayTitle,
      owner: "User",
      startedAt: startTs,
    },
    run: {
      traceId: snapshot.sessionId,
      title: displayTitle,
      status,
      startTs,
      endTs: status === "running" ? null : updatedTs,
      durationMs: Math.max(updatedTs - startTs, 1_000),
      environment: "Desktop",
      liveMode: "imported",
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
      finalArtifactId: null,
      selectedByDefaultId,
      rawIncluded: false,
      noRawStorage: true,
      isArchived: snapshot.isArchived ?? false,
    },
    lanes: allLanes,
    events: allEvents,
    edges: allEdges,
    artifacts: [],
    promptAssembly: buildPromptAssembly(snapshot, { includeRaw: false }),
  };

  return {
    ...dataset,
    run: {
      ...dataset.run,
      summaryMetrics: calculateSummaryMetrics(dataset),
    },
  };
}
