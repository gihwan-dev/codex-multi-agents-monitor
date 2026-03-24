import type { AgentLane, EventRecord, RunDataset } from "../../run";
import { parseRequiredTimestamp } from "../lib/helpers";
import { deriveSessionLogStatus, deriveSessionLogTitle } from "../lib/text";
import {
  attachSummaryMetrics,
  buildCombinedTimeline,
  buildSessionLogDataset,
} from "./datasetBuilderTimeline";
import type { ParentRunContext, SnapshotTiming } from "./datasetBuilderTypes";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import { buildRunEndEvent, buildRunStartEvent } from "./runBoundaryEvents";
import type { SessionLogSnapshot } from "./types";

interface BuildRunBoundaryContextOptions {
  snapshot: SessionLogSnapshot;
  timing: SnapshotTiming;
  mainLane: AgentLane;
  parentEvents: EventRecord[];
  status: RunDataset["run"]["status"];
  resolvedModel: string;
}

interface BuildParentRunEndEventOptions {
  snapshot: SessionLogSnapshot;
  timing: SnapshotTiming;
  mainLane: AgentLane;
  status: RunDataset["run"]["status"];
  resolvedModel: string;
}

export function buildDatasetFromSessionLog(snapshot: SessionLogSnapshot): RunDataset | null {
  const timing = resolveSnapshotTiming(snapshot);
  if (!timing) {
    return null;
  }

  const parentRun = buildParentRunContext(snapshot, timing);
  const combinedTimeline = buildCombinedTimeline(snapshot, parentRun);
  const dataset = buildSessionLogDataset({ snapshot, timing, parentRun, combinedTimeline });
  return attachSummaryMetrics(dataset);
}

function resolveSnapshotTiming(snapshot: SessionLogSnapshot): SnapshotTiming | null {
  const startTs = parseRequiredTimestamp(snapshot.startedAt);
  const updatedAtTs = parseRequiredTimestamp(snapshot.updatedAt);
  if (startTs === null || updatedAtTs === null) {
    return null;
  }

  return {
    startTs,
    updatedTs: Math.max(updatedAtTs, startTs),
  };
}

function buildParentRunContext(
  snapshot: SessionLogSnapshot,
  timing: SnapshotTiming,
): ParentRunContext {
  const displayTitle = deriveSessionLogTitle(snapshot.entries);
  const status = deriveSessionLogStatus(snapshot.entries);
  const resolvedModel = snapshot.model ?? "unknown";
  const { userLane, mainLane } = buildParentLanes(snapshot, resolvedModel, status);
  const parentEvents = buildLaneEventsFromEntries({
    entries: snapshot.entries,
    lane: mainLane,
    userLane,
    updatedAtTs: timing.updatedTs,
    status,
    model: resolvedModel,
    displayTitle,
  });

  return {
    displayTitle,
    status,
    resolvedModel,
    userLane,
    mainLane,
    parentEvents,
    ...buildRunBoundaryContext({
      snapshot,
      timing,
      mainLane,
      parentEvents,
      status,
      resolvedModel,
    }),
  };
}

function buildParentLanes(
  snapshot: SessionLogSnapshot,
  resolvedModel: string,
  status: RunDataset["run"]["status"],
) {
  const userLaneId = `${snapshot.sessionId}:user`;
  const mainLaneId = `${snapshot.sessionId}:main`;

  return {
    userLane: {
      laneId: userLaneId,
      agentId: userLaneId,
      threadId: snapshot.sessionId,
      name: "User",
      role: "user",
      model: "human",
      provider: "Human",
      badge: "User",
      laneStatus: "done",
    } satisfies AgentLane,
    mainLane: {
      laneId: mainLaneId,
      agentId: mainLaneId,
      threadId: snapshot.sessionId,
      name: "Main thread",
      role: "session",
      model: resolvedModel,
      provider: "OpenAI",
      badge: "Desktop",
      laneStatus: status,
    } satisfies AgentLane,
  };
}

function buildRunBoundaryContext(options: BuildRunBoundaryContextOptions) {
  const { mainLane, resolvedModel, snapshot, status, timing } = options;
  const runStartEvent = buildParentRunStartEvent(options);
  const runEndEvent = buildParentRunEndEvent({ snapshot, timing, mainLane, status, resolvedModel });

  return {
    runStartEvent,
    runEndEvent,
  };
}

function buildParentRunStartEvent(options: BuildRunBoundaryContextOptions) {
  const { mainLane, parentEvents, resolvedModel, snapshot, status, timing } = options;
  return buildRunStartEvent({
    sessionId: snapshot.sessionId,
    lane: mainLane,
    startTs: timing.startTs,
    firstEventTs: parentEvents[0]?.startTs ?? timing.updatedTs,
    hasParentEvents: parentEvents.length > 0,
    status,
    model: resolvedModel,
  });
}

function buildParentRunEndEvent(options: BuildParentRunEndEventOptions) {
  const { snapshot, timing, mainLane, status, resolvedModel } = options;
  return buildRunEndEvent({
    sessionId: snapshot.sessionId,
    lane: mainLane,
    updatedTs: timing.updatedTs,
    status,
    model: resolvedModel,
  });
}
