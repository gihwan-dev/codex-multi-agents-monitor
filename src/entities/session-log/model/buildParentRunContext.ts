import type { AgentLane } from "../../run";
import { deriveSessionLogStatus, deriveSessionLogTitle } from "../lib/text";
import type { ParentRunContext, SnapshotTiming } from "./datasetBuilderTypes";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import { buildRunEndEvent, buildRunStartEvent } from "./runBoundaryEvents";
import type { SessionLogSnapshot } from "./types";

interface BuildParentRunEventsOptions {
  snapshot: SessionLogSnapshot;
  timing: SnapshotTiming;
  displayTitle: string;
  resolvedModel: string;
  status: ParentRunContext["status"];
  userLane: AgentLane;
  mainLane: AgentLane;
}

interface BuildParentBoundaryEventsOptions {
  snapshot: SessionLogSnapshot;
  timing: SnapshotTiming;
  mainLane: AgentLane;
  status: ParentRunContext["status"];
  resolvedModel: string;
  firstEventTs: number;
  hasParentEvents: boolean;
}

function buildParentLanes(options: {
  snapshot: SessionLogSnapshot;
  resolvedModel: string;
  status: ParentRunContext["status"];
}) {
  const userLaneId = `${options.snapshot.sessionId}:user`;
  const mainLaneId = `${options.snapshot.sessionId}:main`;

  return {
    userLane: {
      laneId: userLaneId,
      agentId: userLaneId,
      threadId: options.snapshot.sessionId,
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
      threadId: options.snapshot.sessionId,
      name: "Main thread",
      role: "session",
      model: options.resolvedModel,
      provider: options.snapshot.provider,
      badge: "Desktop",
      laneStatus: options.status,
    } satisfies AgentLane,
  };
}

function buildParentBoundaryEvents(options: BuildParentBoundaryEventsOptions) {
  const runStartEvent = buildRunStartEvent({
    sessionId: options.snapshot.sessionId,
    lane: options.mainLane,
    startTs: options.timing.startTs,
    firstEventTs: options.firstEventTs,
    hasParentEvents: options.hasParentEvents,
    status: options.status,
    model: options.resolvedModel,
  });
  const runEndEvent = buildRunEndEvent({
    sessionId: options.snapshot.sessionId,
    lane: options.mainLane,
    updatedTs: options.timing.updatedTs,
    status: options.status,
    model: options.resolvedModel,
  });

  return { runStartEvent, runEndEvent };
}

function buildParentRunEvents(options: BuildParentRunEventsOptions) {
  const parentEvents = buildLaneEventsFromEntries({
    entries: options.snapshot.entries,
    lane: options.mainLane,
    userLane: options.userLane,
    updatedAtTs: options.timing.updatedTs,
    status: options.status,
    model: options.resolvedModel,
    displayTitle: options.displayTitle,
  });
  const boundaryEvents = buildParentBoundaryEvents({
    snapshot: options.snapshot,
    timing: options.timing,
    mainLane: options.mainLane,
    status: options.status,
    resolvedModel: options.resolvedModel,
    firstEventTs: parentEvents[0]?.startTs ?? options.timing.updatedTs,
    hasParentEvents: parentEvents.length > 0,
  });

  return {
    parentEvents,
    ...boundaryEvents,
  };
}

export function buildParentRunContext(
  snapshot: SessionLogSnapshot,
  timing: SnapshotTiming,
): ParentRunContext {
  const displayTitle = deriveSessionLogTitle(snapshot.entries);
  const status = deriveSessionLogStatus(snapshot.entries);
  const resolvedModel = snapshot.model ?? "unknown";
  const { userLane, mainLane } = buildParentLanes({
    snapshot,
    resolvedModel,
    status,
  });
  const parentRunEvents = buildParentRunEvents({
    snapshot,
    timing,
    displayTitle,
    resolvedModel,
    status,
    userLane,
    mainLane,
  });

  return {
    displayTitle,
    status,
    resolvedModel,
    userLane,
    mainLane,
    ...parentRunEvents,
  };
}
