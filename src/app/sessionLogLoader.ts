import {
  type AgentLane,
  type ArchivedSessionIndexResult,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type PromptAssembly,
  type PromptLayerType,
  type RunDataset,
  type RunStatus,
} from "../shared/domain";
import { buildLaneEventsFromEntries } from "./session-log-loader/eventBuilder";
import {
  buildEntryEventId,
  buildTimedSubagentSnapshots,
  parseRequiredTimestamp,
} from "./session-log-loader/helpers";
import {
  deriveSessionLogStatus,
  deriveSessionLogTitle,
} from "./session-log-loader/text";
import {
  parseJsonRecord,
  readAgentReference,
  readStringArray,
} from "./session-log-loader/toolPreview";
import type {
  SessionLogSnapshot,
  TimedSubagentSnapshot,
} from "./session-log-loader/types";
import { invokeTauri } from "./tauri";

export {
  deriveArchiveIndexTitle,
  deriveSessionLogStatus,
  deriveSessionLogTitle,
  sanitizeSessionText,
} from "./session-log-loader/text";
export type {
  PromptAssemblyLayerSnapshot,
  SessionEntrySnapshot,
  SessionLogSnapshot,
  SubagentSnapshot,
} from "./session-log-loader/types";
export { NEW_THREAD_TITLE } from "./session-log-loader/types";

const WEB_SESSION_SNAPSHOT_URL = "/__codex/session-snapshots.json";

interface IndexedSubagents {
  bySessionId: Map<string, TimedSubagentSnapshot>;
  byNickname: Map<string, TimedSubagentSnapshot>;
}

interface SessionLinkMaps {
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
  codexAgentIdToSessionId: Map<string, string>;
  callEventToOutputEvent: Map<string, string>;
  parentFunctionArgsByEventId: Map<string, string | null>;
}

export async function loadSessionLogDatasets(): Promise<RunDataset[] | null> {
  try {
    return normalizeSessionLogDatasets(
      await invokeTauri<SessionLogSnapshot[]>("load_recent_session_snapshots"),
    );
  } catch {
    return loadWebSessionLogDatasets();
  }
}

function normalizeSessionLogDatasets(snapshots: SessionLogSnapshot[] | null | undefined) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return null;
  }

  const datasets = snapshots
    .map((snapshot) => buildDatasetFromSessionLog(snapshot))
    .filter((dataset): dataset is RunDataset => dataset !== null);

  return datasets.length > 0 ? datasets : null;
}

async function loadWebSessionLogDatasets(): Promise<RunDataset[] | null> {
  try {
    const response = await fetch(WEB_SESSION_SNAPSHOT_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSessionLogDatasets((await response.json()) as SessionLogSnapshot[]);
  } catch {
    return null;
  }
}

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

  const hasUserEvents = parentEvents.some((e) => e.laneId === userLaneId);

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

  const runEndEvent = buildRunEndEvent(snapshot.sessionId, mainLane, updatedTs, status, resolvedModel);

  const allLanes: AgentLane[] = hasUserEvents ? [userLane, mainLane] : [mainLane];
  const allEvents: EventRecord[] = [runStartEvent, ...parentEvents, ...(runEndEvent ? [runEndEvent] : [])];
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

  for (const [sessionId, eventId] of subagentToSpawnSource) {
    const sub = indexedSubagents.bySessionId.get(sessionId);
    const event = eventsById.get(eventId);
    if (sub && event) {
      event.title = `spawn_agent (${sub.agentNickname})`;
    }
  }

  // Resolve merge edge source, ensuring it doesn't have a later timestamp
  // than the target. Fork-context entries (e.g. parent's task_complete leaking
  // into the subagent) can create events with very late timestamps that would
  // cause backward-flowing edges. Falls back to the spawned event.
  const resolveMergeSource = (sessionId: string, targetEventId: string): string | null => {
    const lastEventId = latestSubagentEventBySessionId.get(sessionId)?.eventId ?? null;
    if (!lastEventId) return null;

    const sourceTs = eventsById.get(lastEventId)?.startTs ?? 0;
    const targetTs = eventsById.get(targetEventId)?.startTs ?? 0;

    if (sourceTs <= targetTs) {
      return lastEventId;
    }

    // Source is after target — fall back to the spawned event
    const spawnedEventId = `${sessionId}:spawn`;
    if (eventsById.has(spawnedEventId)) {
      return spawnedEventId;
    }

    return lastEventId;
  };

  // Resolve codex agent_id to subagent sessionId with direct match fallback
  const resolveSessionId = (agentId: string): string | undefined =>
    codexAgentIdToSessionId.get(agentId)
    ?? (indexedSubagents.bySessionId.has(agentId) ? agentId : undefined);

  const parseParentFunctionArgs = (event: EventRecord) =>
    parseJsonRecord(parentFunctionArgsByEventId.get(event.eventId) ?? event.inputPreview);

  // Collect candidate merge edges from close_agent and wait/wait_agent events.
  // A subagent may be referenced by multiple wait calls (polling with timeouts)
  // and then a close_agent. We keep only the merge edge with the LATEST target
  // timestamp per subagent to avoid cluttering the graph with redundant arrows.
  const mergeEdgeCandidates = new Map<string, { edge: EdgeRecord; targetTs: number }>();

  const upsertMergeCandidate = (sessionId: string, edge: EdgeRecord) => {
    const targetTs = eventsById.get(edge.targetEventId)?.startTs ?? 0;
    const existing = mergeEdgeCandidates.get(sessionId);
    if (!existing || targetTs > existing.targetTs) {
      mergeEdgeCandidates.set(sessionId, { edge, targetTs });
    }
  };

  // Generate merge edges from close_agent events
  for (const evt of parentEvents) {
    if (evt.toolName !== "close_agent") continue;
    const args = parseParentFunctionArgs(evt);
    const agentId = typeof args?.id === "string" ? args.id : null;
    const sessionId = agentId ? resolveSessionId(agentId) : undefined;
    if (!sessionId) continue;
    const sub = indexedSubagents.bySessionId.get(sessionId);
    const resolvedTarget = callEventToOutputEvent.get(evt.eventId) ?? evt.eventId;
    const mergeSourceId = resolveMergeSource(sessionId, resolvedTarget);
    if (!mergeSourceId) continue;
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

  // Generate merge edges from wait/wait_agent events
  for (const evt of parentEvents) {
    if (evt.toolName !== "wait" && evt.toolName !== "wait_agent") continue;
    for (const agentId of readStringArray(parseParentFunctionArgs(evt), "ids")) {
      const sessionId = resolveSessionId(agentId);
      if (!sessionId) continue;
      const sub = indexedSubagents.bySessionId.get(sessionId);
      const resolvedTarget = callEventToOutputEvent.get(evt.eventId) ?? evt.eventId;
      const mergeSourceId = resolveMergeSource(sessionId, resolvedTarget);
      if (!mergeSourceId) continue;
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

  for (const { edge } of mergeEdgeCandidates.values()) {
    allEdges.push(edge);
  }

  // Enrich agent-interaction event titles with subagent nicknames.
  // resume_agent, send_input, close_agent, wait, wait_agent all reference
  // subagent IDs in their arguments — showing the nickname is far more readable.
  for (const evt of allEvents) {
    const args = parseParentFunctionArgs(evt);
    if (!args) continue;
    if (evt.toolName === "resume_agent" || evt.toolName === "send_input") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      if (!sessionId) continue;
      const sub = indexedSubagents.bySessionId.get(sessionId);
      if (!sub) continue;
      evt.title = evt.toolName === "resume_agent"
        ? `Resume (${sub.agentNickname})`
        : `Send to ${sub.agentNickname}`;
    } else if (evt.toolName === "close_agent") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      if (!sessionId) continue;
      const sub = indexedSubagents.bySessionId.get(sessionId);
      if (!sub) continue;
      evt.title = `Close (${sub.agentNickname})`;
      evt.outputPreview = `${sub.agentNickname} (${sub.agentRole})`;
    } else if (evt.toolName === "wait" || evt.toolName === "wait_agent") {
      const names = readStringArray(args, "ids")
        .map((id) => resolveSessionId(id))
        .filter((sid): sid is string => sid !== undefined)
        .map((sid) => indexedSubagents.bySessionId.get(sid)?.agentNickname)
        .filter((name): name is string => name !== undefined);
      if (names.length > 0) {
        evt.title = `Wait (${names.join(", ")})`;
      }
    }
  }

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
  if (!layers || layers.length === 0) return undefined;
  return {
    layers: layers.map((layer, i) => ({
      layerId: `${snapshot.sessionId}:layer:${i}`,
      layerType: layer.layerType as PromptLayerType,
      label: layer.label,
      preview: layer.preview,
      contentLength: layer.contentLength,
      rawContent: layer.rawContent,
    })),
    totalContentLength: layers.reduce((sum, l) => sum + l.contentLength, 0),
  };
}

function indexSubagents(subagents: TimedSubagentSnapshot[]): IndexedSubagents {
  return {
    bySessionId: new Map(subagents.map((subagent) => [subagent.sessionId, subagent])),
    byNickname: new Map(subagents.map((subagent) => [subagent.agentNickname, subagent])),
  };
}

function resolveLinkedSubagent(
  indexedSubagents: IndexedSubagents,
  agentId: string | null | undefined,
  nickname: string | null | undefined,
) {
  if (agentId) {
    const bySessionId = indexedSubagents.bySessionId.get(agentId);
    if (bySessionId) {
      return bySessionId;
    }
  }

  if (nickname) {
    return indexedSubagents.byNickname.get(nickname) ?? null;
  }

  return null;
}

function buildSessionLinkMaps({
  sessionId,
  entries,
  parentEvents,
  subagents,
  indexedSubagents,
}: {
  sessionId: string;
  entries: SessionLogSnapshot["entries"];
  parentEvents: EventRecord[];
  subagents: TimedSubagentSnapshot[];
  indexedSubagents: IndexedSubagents;
}): SessionLinkMaps {
  const callIdToName = new Map<string, string>();
  const spawnCallIdToEventId = new Map<string, string>();
  const callEventIdByCallId = new Map<string, string>();
  const subagentToSpawnSource = new Map<string, string>();
  const waitAgentErrors = new Map<string, string>();
  const codexAgentIdToSessionId = new Map<string, string>();
  const callEventToOutputEvent = new Map<string, string>();
  const parentFunctionArgsByEventId = new Map<string, string | null>();

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.entryType !== "function_call" || !entry.functionCallId || !entry.functionName) {
      continue;
    }

    callIdToName.set(entry.functionCallId, entry.functionName);

    if (parseRequiredTimestamp(entry.timestamp) === null) {
      continue;
    }

    const eventId = buildEntryEventId(sessionId, entry, index);
    callEventIdByCallId.set(entry.functionCallId, eventId);
    parentFunctionArgsByEventId.set(eventId, entry.functionArgumentsPreview);

    if (entry.functionName === "spawn_agent") {
      spawnCallIdToEventId.set(entry.functionCallId, eventId);
    }
  }

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.entryType !== "function_call_output" || !entry.functionCallId) {
      continue;
    }

    const toolName = callIdToName.get(entry.functionCallId);
    const outputEventId =
      parseRequiredTimestamp(entry.timestamp) === null
        ? null
        : buildEntryEventId(sessionId, entry, index);
    const pairedCallEventId = callEventIdByCallId.get(entry.functionCallId);
    if (outputEventId && pairedCallEventId) {
      callEventToOutputEvent.set(pairedCallEventId, outputEventId);
    }

    const parsedOutput = parseJsonRecord(entry.text);
    if (toolName === "spawn_agent") {
      const spawnSourceEventId = spawnCallIdToEventId.get(entry.functionCallId);
      const { agentId, nickname } = readAgentReference(parsedOutput);
      const matchedSubagent = resolveLinkedSubagent(indexedSubagents, agentId, nickname);
      if (spawnSourceEventId && matchedSubagent) {
        subagentToSpawnSource.set(matchedSubagent.sessionId, spawnSourceEventId);
      }
      if (agentId && matchedSubagent) {
        codexAgentIdToSessionId.set(agentId, matchedSubagent.sessionId);
      }
      continue;
    }

    if (toolName !== "wait" && toolName !== "wait_agent") {
      continue;
    }

    const statuses = parsedOutput?.status;
    if (!statuses || typeof statuses !== "object") {
      continue;
    }

    for (const [agentId, agentStatus] of Object.entries(statuses)) {
      if (!agentStatus || typeof agentStatus !== "object") {
        continue;
      }
      const errored = (agentStatus as Record<string, unknown>).errored;
      if (typeof errored !== "string") {
        continue;
      }

      const resolvedSessionId = codexAgentIdToSessionId.get(agentId) ?? agentId;
      if (
        indexedSubagents.bySessionId.has(resolvedSessionId) &&
        !waitAgentErrors.has(resolvedSessionId)
      ) {
        waitAgentErrors.set(resolvedSessionId, errored);
      }
    }
  }

  if (subagentToSpawnSource.size < subagents.length) {
    const spawnToolEvents = parentEvents
      .filter((event) => event.toolName === "spawn_agent")
      .sort((left, right) => left.startTs - right.startTs);
    const sortedSubagents = [...subagents].sort((left, right) => left.startedTs - right.startedTs);
    for (let index = 0; index < sortedSubagents.length; index++) {
      const subagent = sortedSubagents[index];
      if (!subagent || subagentToSpawnSource.has(subagent.sessionId) || index >= spawnToolEvents.length) {
        continue;
      }
      subagentToSpawnSource.set(subagent.sessionId, spawnToolEvents[index].eventId);
    }
  }

  return {
    subagentToSpawnSource,
    waitAgentErrors,
    codexAgentIdToSessionId,
    callEventToOutputEvent,
    parentFunctionArgsByEventId,
  };
}

function buildLatestSubagentEventBySessionId(events: EventRecord[]) {
  const latestBySessionId = new Map<string, EventRecord>();
  for (const event of events) {
    if (
      !event.laneId.endsWith(":sub") ||
      event.eventType === "run.finished" ||
      event.eventType === "run.cancelled"
    ) {
      continue;
    }

    const existing = latestBySessionId.get(event.threadId);
    if (!existing || event.startTs > existing.startTs) {
      latestBySessionId.set(event.threadId, event);
    }
  }
  return latestBySessionId;
}

function findClosestParentEvent(
  parentEvents: EventRecord[],
  targetTs: number,
): string {
  if (parentEvents.length === 0) return "";

  // Find the latest parent event at or before the subagent start time.
  // This ensures spawn edges always flow forward (downward) in the timeline.
  let best: EventRecord | null = null;
  for (const event of parentEvents) {
    if (event.startTs <= targetTs && (!best || event.startTs > best.startTs)) {
      best = event;
    }
  }

  // If no event exists before the target, fall back to the absolute closest
  if (!best) {
    best = parentEvents[0];
    let bestDelta = Math.abs(best.startTs - targetTs);
    for (const event of parentEvents) {
      const delta = Math.abs(event.startTs - targetTs);
      if (delta < bestDelta) {
        best = event;
        bestDelta = delta;
      }
    }
  }

  return best.eventId;
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

export async function loadArchivedSessionIndex(
  offset: number,
  limit: number,
  search?: string,
): Promise<ArchivedSessionIndexResult | null> {
  try {
    return await invokeTauri<ArchivedSessionIndexResult>(
      "load_archived_session_index",
      { offset, limit, search: search || null },
    );
  } catch {
    return null;
  }
}

export async function loadArchivedSessionSnapshot(
  filePath: string,
): Promise<RunDataset | null> {
  try {
    const snapshot = await invokeTauri<SessionLogSnapshot | null>(
      "load_archived_session_snapshot",
      { filePath },
    );
    if (!snapshot) return null;
    return buildDatasetFromSessionLog(snapshot);
  } catch {
    return null;
  }
}
