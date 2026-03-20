import {
  type AgentLane,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type PromptAssembly,
  type PromptLayerType,
  type RunDataset,
  type RunStatus,
} from "../../shared/domain";
import { buildLaneEventsFromEntries } from "./eventBuilder";
import {
  buildTimedSubagentSnapshots,
  parseRequiredTimestamp,
} from "./helpers";
import {
  buildLatestSubagentEventBySessionId,
  buildSessionLinkMaps,
  findClosestParentEvent,
  indexSubagents,
} from "./sessionLinks";
import {
  deriveSessionLogStatus,
  deriveSessionLogTitle,
} from "./text";
import {
  parseJsonRecord,
  readStringArray,
} from "./toolPreview";
import type {
  SessionLogSnapshot,
} from "./types";

type IndexedSubagentMaps = ReturnType<typeof indexSubagents>;
type SessionLinkMaps = ReturnType<typeof buildSessionLinkMaps>;

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
  const runStartEvent: EventRecord = {
    eventId: `${snapshot.sessionId}:run-start`,
    parentId: null,
    linkIds: [],
    laneId: mainLane.laneId,
    agentId: mainLane.agentId,
    threadId: mainLane.threadId,
    eventType: "run.started",
    status:
      parentEvents.length === 0 && status === "running" ? "running" : "done",
    waitReason: null,
    retryCount: 0,
    startTs,
    endTs: Math.max(firstEventTs, startTs + 1_000),
    durationMs: Math.max(firstEventTs - startTs, 1_000),
    title: "Session started",
    inputPreview: null,
    outputPreview: null,
    artifactId: null,
    errorCode: null,
    errorMessage: null,
    provider: "OpenAI",
    model: resolvedModel,
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
    promptAssembly: buildPromptAssembly(snapshot),
  };

  return {
    ...dataset,
    run: {
      ...dataset.run,
      summaryMetrics: calculateSummaryMetrics(dataset),
    },
  };
}

function buildPromptAssembly(snapshot: SessionLogSnapshot): PromptAssembly | undefined {
  const layers = snapshot.promptAssembly;
  if (!layers || layers.length === 0) {
    return undefined;
  }
  return {
    layers: layers.map((layer, index) => ({
      layerId: `${snapshot.sessionId}:layer:${index}`,
      layerType: layer.layerType as PromptLayerType,
      label: layer.label,
      preview: layer.preview,
      contentLength: layer.contentLength,
      rawContent: layer.rawContent,
    })),
    totalContentLength: layers.reduce((sum, layer) => sum + layer.contentLength, 0),
  };
}

function buildRunEndEvent(
  sessionId: string,
  lane: AgentLane,
  updatedTs: number,
  status: RunStatus,
  model: string,
) {
  if (status === "running") {
    return null;
  }

  const finishedEventType = status === "interrupted" ? "run.cancelled" : "run.finished";
  return {
    eventId: `${sessionId}:run-finished`,
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType: finishedEventType,
    status,
    waitReason: null,
    retryCount: 0,
    startTs: updatedTs,
    endTs: updatedTs + 1_000,
    durationMs: 1_000,
    title: status === "interrupted" ? "Session interrupted" : "Session finished",
    inputPreview: null,
    outputPreview: null,
    artifactId: null,
    errorCode: null,
    errorMessage: null,
    provider: "OpenAI",
    model,
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
  } satisfies EventRecord;
}

function labelSpawnSourceEvents(
  subagentToSpawnSource: SessionLinkMaps["subagentToSpawnSource"],
  indexedSubagents: IndexedSubagentMaps,
  eventsById: Map<string, EventRecord>,
) {
  for (const [sessionId, eventId] of subagentToSpawnSource) {
    const sub = indexedSubagents.bySessionId.get(sessionId);
    const event = eventsById.get(eventId);
    if (sub && event) {
      event.title = `spawn_agent (${sub.agentNickname})`;
    }
  }
}

function buildSubagentMergeEdges({
  parentEvents,
  mainLane,
  indexedSubagents,
  eventsById,
  latestSubagentEventBySessionId,
  sessionLinks,
}: {
  parentEvents: EventRecord[];
  mainLane: AgentLane;
  indexedSubagents: IndexedSubagentMaps;
  eventsById: Map<string, EventRecord>;
  latestSubagentEventBySessionId: Map<string, EventRecord>;
  sessionLinks: Pick<
    SessionLinkMaps,
    "callEventToOutputEvent" | "codexAgentIdToSessionId" | "parentFunctionArgsByEventId"
  >;
}) {
  const { callEventToOutputEvent, codexAgentIdToSessionId, parentFunctionArgsByEventId } =
    sessionLinks;
  const mergeEdgeCandidates = new Map<string, { edge: EdgeRecord; targetTs: number }>();

  const resolveSessionId = (agentId: string): string | undefined =>
    codexAgentIdToSessionId.get(agentId)
    ?? (indexedSubagents.bySessionId.has(agentId) ? agentId : undefined);

  const resolveMergeSource = (sessionId: string, targetEventId: string): string | null => {
    const lastEventId = latestSubagentEventBySessionId.get(sessionId)?.eventId ?? null;
    if (!lastEventId) {
      return null;
    }

    const sourceTs = eventsById.get(lastEventId)?.startTs ?? 0;
    const targetTs = eventsById.get(targetEventId)?.startTs ?? 0;
    if (sourceTs <= targetTs) {
      return lastEventId;
    }

    const spawnedEventId = `${sessionId}:spawn`;
    return eventsById.has(spawnedEventId) ? spawnedEventId : lastEventId;
  };

  const parseParentFunctionArgs = (event: EventRecord) =>
    parseJsonRecord(parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview);

  const upsertMergeCandidate = (sessionId: string, edge: EdgeRecord) => {
    const targetTs = eventsById.get(edge.targetEventId)?.startTs ?? 0;
    const existing = mergeEdgeCandidates.get(sessionId);
    if (!existing || targetTs > existing.targetTs) {
      mergeEdgeCandidates.set(sessionId, { edge, targetTs });
    }
  };

  for (const event of parentEvents) {
    if (event.toolName !== "close_agent") {
      continue;
    }

    const args = parseParentFunctionArgs(event);
    const agentId = typeof args?.id === "string" ? args.id : null;
    const sessionId = agentId ? resolveSessionId(agentId) : undefined;
    if (!sessionId) {
      continue;
    }

    const sub = indexedSubagents.bySessionId.get(sessionId);
    const resolvedTarget = callEventToOutputEvent.get(event.eventId) ?? event.eventId;
    const mergeSourceId = resolveMergeSource(sessionId, resolvedTarget);
    if (!mergeSourceId) {
      continue;
    }

    upsertMergeCandidate(sessionId, {
      edgeId: `merge:close:${sessionId}`,
      edgeType: "merge",
      sourceAgentId: `${sessionId}:sub`,
      targetAgentId: mainLane.agentId,
      sourceEventId: mergeSourceId,
      targetEventId: resolvedTarget,
      payloadPreview: `${sub?.agentNickname ?? "Agent"} result`,
      artifactId: null,
    });
  }

  for (const event of parentEvents) {
    if (event.toolName !== "wait" && event.toolName !== "wait_agent") {
      continue;
    }

    const args = parseParentFunctionArgs(event);
    const resolvedTarget = callEventToOutputEvent.get(event.eventId) ?? event.eventId;
    for (const agentId of readStringArray(args, "ids")) {
      const sessionId = resolveSessionId(agentId);
      if (!sessionId) {
        continue;
      }

      const sub = indexedSubagents.bySessionId.get(sessionId);
      const mergeSourceId = resolveMergeSource(sessionId, resolvedTarget);
      if (!mergeSourceId) {
        continue;
      }

      upsertMergeCandidate(sessionId, {
        edgeId: `merge:wait:${sessionId}`,
        edgeType: "merge",
        sourceAgentId: `${sessionId}:sub`,
        targetAgentId: mainLane.agentId,
        sourceEventId: mergeSourceId,
        targetEventId: resolvedTarget,
        payloadPreview: `${sub?.agentNickname ?? "Agent"} joined`,
        artifactId: null,
      });
    }
  }

  return [...mergeEdgeCandidates.values()].map(({ edge }) => edge);
}

function applySubagentToolMetadata(
  events: EventRecord[],
  indexedSubagents: IndexedSubagentMaps,
  sessionLinks: Pick<SessionLinkMaps, "codexAgentIdToSessionId" | "parentFunctionArgsByEventId">,
) {
  const { codexAgentIdToSessionId, parentFunctionArgsByEventId } = sessionLinks;
  const resolveSessionId = (agentId: string): string | undefined =>
    codexAgentIdToSessionId.get(agentId)
    ?? (indexedSubagents.bySessionId.has(agentId) ? agentId : undefined);

  for (const event of events) {
    if (!event.toolName) {
      continue;
    }

    const args = parseJsonRecord(parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview);
    if (!args) {
      continue;
    }

    if (event.toolName === "resume_agent" || event.toolName === "send_input") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      const sub = sessionId ? indexedSubagents.bySessionId.get(sessionId) : undefined;
      if (!sub) {
        continue;
      }

      event.title = event.toolName === "resume_agent"
        ? `Resume (${sub.agentNickname})`
        : `Send to ${sub.agentNickname}`;
      continue;
    }

    if (event.toolName === "close_agent") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      const sub = sessionId ? indexedSubagents.bySessionId.get(sessionId) : undefined;
      if (!sub) {
        continue;
      }

      event.title = `Close (${sub.agentNickname})`;
      event.outputPreview = `${sub.agentNickname} (${sub.agentRole})`;
      continue;
    }

    if (event.toolName !== "wait" && event.toolName !== "wait_agent") {
      continue;
    }

    const names = readStringArray(args, "ids")
      .map((id) => resolveSessionId(id))
      .filter((sessionId): sessionId is string => sessionId !== undefined)
      .map((sessionId) => indexedSubagents.bySessionId.get(sessionId)?.agentNickname)
      .filter((name): name is string => name !== undefined);
    if (names.length > 0) {
      event.title = `Wait (${names.join(", ")})`;
    }
  }
}
