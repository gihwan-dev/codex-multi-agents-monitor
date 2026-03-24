import {
  type AgentLane,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type RunDataset,
} from "../../run";
import type { CombinedTimeline, ParentRunContext, SnapshotTiming } from "./datasetBuilderTypes";
import { buildPromptAssembly } from "./promptAssembly";
import {
  applySubagentToolMetadata,
  buildSubagentMergeEdges,
  labelSpawnSourceEvents,
} from "./subagentLinks";
import { buildSubagentTimeline } from "./subagentTimeline";
import type { SessionLogSnapshot } from "./types";

interface BuildSessionLogDatasetOptions {
  snapshot: SessionLogSnapshot;
  timing: SnapshotTiming;
  parentRun: ParentRunContext;
  combinedTimeline: CombinedTimeline;
}

function resolveSelectedByDefaultId(parentRun: ParentRunContext) {
  return (
    parentRun.parentEvents[parentRun.parentEvents.length - 1]?.eventId ??
    parentRun.runStartEvent.eventId
  );
}

function buildSessionLogProject(snapshot: SessionLogSnapshot) {
  return {
    projectId: snapshot.originPath,
    name: snapshot.displayName,
    repoPath: snapshot.originPath,
    badge: "Desktop",
  };
}

function buildSessionLogSession(snapshot: SessionLogSnapshot, timing: SnapshotTiming, title: string) {
  return {
    sessionId: snapshot.sessionId,
    title,
    owner: "User",
    startedAt: timing.startTs,
  };
}

function buildSessionLogRun(options: BuildSessionLogDatasetOptions) {
  const { combinedTimeline, parentRun, snapshot, timing } = options;
  const isRunning = parentRun.status === "running";
  return {
    traceId: snapshot.sessionId,
    title: parentRun.displayTitle,
    status: parentRun.status,
    startTs: timing.startTs,
    endTs: isRunning ? null : timing.updatedTs,
    durationMs: Math.max(timing.updatedTs - timing.startTs, 1_000),
    environment: "Desktop",
    liveMode: !snapshot.isArchived && isRunning ? "live" : "imported",
    summaryMetrics: buildEmptySummaryMetrics(),
    finalArtifactId: null,
    selectedByDefaultId: combinedTimeline.selectedByDefaultId,
    rawIncluded: false,
    noRawStorage: true,
    isArchived: snapshot.isArchived ?? false,
  } satisfies RunDataset["run"];
}

export function buildCombinedTimeline(
  snapshot: SessionLogSnapshot,
  parentRun: ParentRunContext,
): CombinedTimeline {
  const parentTimelineEvents = [parentRun.runStartEvent, ...parentRun.parentEvents];
  const subagentTimeline = buildSubagentTimeline({
    snapshot,
    mainLane: parentRun.mainLane,
    parentEvents: parentRun.parentEvents,
    parentTimelineEvents,
    resolvedModel: parentRun.resolvedModel,
  });
  const lanes = collectTimelineLanes(parentRun, subagentTimeline.lanes);
  const events = collectTimelineEvents(parentRun, subagentTimeline.events);
  const edges = buildTimelineEdges(parentRun, subagentTimeline, events);

  applySubagentToolMetadata(
    events,
    subagentTimeline.indexedSubagents,
    subagentTimeline.sessionLinks,
  );

  return {
    lanes,
    events,
    edges,
    selectedByDefaultId: resolveSelectedByDefaultId(parentRun),
  };
}

function collectTimelineLanes(parentRun: ParentRunContext, subagentLanes: AgentLane[]) {
  const hasUserEvents = parentRun.parentEvents.some(
    (event) => event.laneId === parentRun.userLane.laneId,
  );
  return hasUserEvents
    ? [parentRun.userLane, parentRun.mainLane, ...subagentLanes]
    : [parentRun.mainLane, ...subagentLanes];
}

function collectTimelineEvents(parentRun: ParentRunContext, subagentEvents: EventRecord[]) {
  return [
    parentRun.runStartEvent,
    ...parentRun.parentEvents,
    ...(parentRun.runEndEvent ? [parentRun.runEndEvent] : []),
    ...subagentEvents,
  ];
}

function buildTimelineEdges(
  parentRun: ParentRunContext,
  subagentTimeline: ReturnType<typeof buildSubagentTimeline>,
  events: EventRecord[],
) {
  const edges: EdgeRecord[] = [...subagentTimeline.edges];
  const eventsById = new Map(events.map((event) => [event.eventId, event]));

  labelSpawnSourceEvents(
    subagentTimeline.subagentToSpawnSource,
    subagentTimeline.indexedSubagents,
    eventsById,
  );
  edges.push(
    ...buildSubagentMergeEdges({
      parentEvents: parentRun.parentEvents,
      mainLane: parentRun.mainLane,
      indexedSubagents: subagentTimeline.indexedSubagents,
      eventsById,
      latestSubagentEventBySessionId: subagentTimeline.latestSubagentEventBySessionId,
      sessionLinks: subagentTimeline.sessionLinks,
    }),
  );

  return edges;
}

export function buildSessionLogDataset(options: BuildSessionLogDatasetOptions): RunDataset {
  const { combinedTimeline, parentRun, snapshot, timing } = options;
  return {
    project: buildSessionLogProject(snapshot),
    session: buildSessionLogSession(snapshot, timing, parentRun.displayTitle),
    run: buildSessionLogRun(options),
    lanes: combinedTimeline.lanes,
    events: combinedTimeline.events,
    edges: combinedTimeline.edges,
    artifacts: [],
    promptAssembly: buildPromptAssembly(snapshot, { includeRaw: true }),
  };
}

function buildEmptySummaryMetrics() {
  return {
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
}

export function attachSummaryMetrics(dataset: RunDataset): RunDataset {
  return {
    ...dataset,
    run: {
      ...dataset.run,
      summaryMetrics: calculateSummaryMetrics(dataset),
    },
  };
}
