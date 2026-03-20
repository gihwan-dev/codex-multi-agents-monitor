import {
  type AgentLane,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type RunDataset,
} from "../../run";
import {
  buildTimedSubagentSnapshots,
  parseRequiredTimestamp,
} from "../lib/helpers";
import {
  buildLatestSubagentEventBySessionId,
  buildSessionLinkMaps,
  findClosestParentEvent,
  indexSubagents,
} from "../lib/sessionLinks";
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
  const allEdges: EdgeRecord[] = [];

  const subagents = buildTimedSubagentSnapshots(snapshot.subagents ?? []);
  const indexedSubagents = indexSubagents(subagents);
  const parentTimelineEvents = [runStartEvent, ...parentEvents];
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

  for (const sub of subagents) {
    const subLaneId = `${sub.sessionId}:sub`;
    const subModel = sub.model ?? resolvedModel;
    let subStatus = deriveSessionLogStatus(sub.entries, true);

    const subError = sub.error ?? waitAgentErrors.get(sub.sessionId) ?? null;
    if (subError && subStatus !== "interrupted") {
      subStatus = "interrupted";
    }
    if (sub.entries.length === 0 && !subError && subStatus === "done") {
      subStatus = "running";
    }

    const subLane: AgentLane = {
      laneId: subLaneId,
      agentId: subLaneId,
      threadId: sub.sessionId,
      name: sub.agentNickname,
      role: sub.agentRole,
      model: subModel,
      provider: "OpenAI",
      badge: "Subagent",
      laneStatus: subStatus,
    };
    allLanes.push(subLane);

    const subEvents = buildLaneEventsFromEntries({
      entries: sub.entries,
      lane: subLane,
      userLane: null,
      updatedAtTs: sub.updatedTs,
      status: subStatus,
      model: subModel,
      displayTitle: sub.agentNickname,
      isSubagent: true,
    });

    const subFirstEventTs = subEvents[0]?.startTs ?? sub.startedTs;
    const spawnEvent: EventRecord = {
      eventId: `${sub.sessionId}:spawn`,
      parentId: null,
      linkIds: [],
      laneId: subLane.laneId,
      agentId: subLane.agentId,
      threadId: subLane.threadId,
      eventType: "agent.spawned",
      status: subError ? "failed" : "done",
      waitReason: null,
      retryCount: 0,
      startTs: sub.startedTs,
      endTs: Math.max(subFirstEventTs, sub.startedTs + 1_000),
      durationMs: Math.max(subFirstEventTs - sub.startedTs, 1_000),
      title: `${sub.agentNickname} spawned`,
      inputPreview: sub.agentRole,
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

    const subEndEvent = buildRunEndEvent(
      sub.sessionId,
      subLane,
      sub.updatedTs,
      subStatus,
      subModel,
    );

    allEvents.push(spawnEvent, ...subEvents, ...(subEndEvent ? [subEndEvent] : []));

    const sourceEventId =
      subagentToSpawnSource.get(sub.sessionId) ??
      findClosestParentEvent(parentTimelineEvents, sub.startedTs);
    allEdges.push({
      edgeId: `spawn:${sub.sessionId}`,
      edgeType: "spawn",
      sourceAgentId: mainLane.agentId,
      targetAgentId: subLane.agentId,
      sourceEventId,
      targetEventId: spawnEvent.eventId,
      payloadPreview: `${sub.agentNickname} (${sub.agentRole})`,
      artifactId: null,
    });
  }

  const eventsById = new Map(allEvents.map((event) => [event.eventId, event]));
  const latestSubagentEventBySessionId = buildLatestSubagentEventBySessionId(allEvents);

  labelSpawnSourceEvents(subagentToSpawnSource, indexedSubagents, eventsById);
  allEdges.push(
    ...buildSubagentMergeEdges({
      parentEvents,
      mainLane,
      indexedSubagents,
      eventsById,
      latestSubagentEventBySessionId,
      sessionLinks: {
        callEventToOutputEvent,
        codexAgentIdToSessionId,
        parentFunctionArgsByEventId,
      },
    }),
  );
  applySubagentToolMetadata(allEvents, indexedSubagents, {
    codexAgentIdToSessionId,
    parentFunctionArgsByEventId,
  });

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
