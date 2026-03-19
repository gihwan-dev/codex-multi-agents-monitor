import {
  type AgentLane,
  type ArchivedSessionIndexResult,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type EventType,
  type PromptAssembly,
  type PromptLayerType,
  type RunDataset,
  type RunStatus,
} from "../shared/domain";
import { invokeTauri } from "./tauri";

export interface SessionEntrySnapshot {
  timestamp: string;
  entryType: string;
  role: string | null;
  text: string | null;
  functionName: string | null;
  functionCallId: string | null;
  functionArgumentsPreview: string | null;
}

export interface SubagentSnapshot {
  sessionId: string;
  parentThreadId: string;
  depth: number;
  agentNickname: string;
  agentRole: string;
  model: string | null;
  startedAt: string;
  updatedAt: string;
  entries: SessionEntrySnapshot[];
  error?: string | null;
}

export interface PromptAssemblyLayerSnapshot {
  layerType: string;
  label: string;
  contentLength: number;
  preview: string;
  rawContent: string;
}

export interface SessionLogSnapshot {
  sessionId: string;
  workspacePath: string;
  originPath: string;
  displayName: string;
  startedAt: string;
  updatedAt: string;
  model: string | null;
  entries: SessionEntrySnapshot[];
  subagents?: SubagentSnapshot[];
  isArchived?: boolean;
  promptAssembly?: PromptAssemblyLayerSnapshot[];
}

interface TimedSubagentSnapshot extends SubagentSnapshot {
  startedTs: number;
  updatedTs: number;
}

export const NEW_THREAD_TITLE = "새 스레드";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const IMAGE_TAG_PATTERN = /<\/?image>/gi;
const IMPLEMENT_PLAN_PATTERN = /^PLEASE IMPLEMENT THIS PLAN:/i;
const WEB_SESSION_SNAPSHOT_URL = "/__codex/session-snapshots.json";

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

export function deriveSessionLogTitle(entries: SessionEntrySnapshot[]) {
  const firstMeaningfulUserMessage = entries.find(
    (entry) =>
      entry.entryType === "message" &&
      entry.role === "user" &&
      entry.text != null &&
      isMeaningfulTitleMessage(entry.text),
  );

  if (!firstMeaningfulUserMessage?.text) {
    return NEW_THREAD_TITLE;
  }

  const sanitizedTitle = sanitizeSessionText(firstMeaningfulUserMessage.text);
  if (sanitizedTitle.length === 0) return NEW_THREAD_TITLE;
  return sanitizedTitle.length > 120 ? `${sanitizedTitle.slice(0, 117)}...` : sanitizedTitle;
}

export function deriveSessionLogStatus(
  entries: SessionEntrySnapshot[],
  skipImplementPlan = false,
): RunStatus {
  const hasAbort = entries.some(isAbortEntry);
  const latestMessage = findLatestMeaningfulMessage(entries, skipImplementPlan);

  if (!latestMessage) {
    return hasAbort ? "interrupted" : "done";
  }

  if (latestMessage.text?.includes("<turn_aborted>")) {
    return "interrupted";
  }

  if (hasAbort && wasInterruptedAfterMessage(entries, latestMessage)) {
    return "interrupted";
  }

  if (latestMessage.role === "user") {
    // If a task_complete follows the last user message, the turn already finished
    // (e.g. subagent received a delegated prompt and completed without a response).
    const msgTs = parseRequiredTimestamp(latestMessage.timestamp);
    if (msgTs === null) {
      return "running";
    }
    return hasCompletionAfter(entries, msgTs) ? "done" : "running";
  }

  return "done";
}

function isAbortEntry(entry: SessionEntrySnapshot) {
  return entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back";
}

function findLatestMeaningfulMessage(
  entries: SessionEntrySnapshot[],
  skipImplementPlan: boolean,
) {
  return [...entries].reverse().find((entry) => {
    if (entry.entryType !== "message" || entry.text == null) {
      return false;
    }

    const trimmed = entry.text.trim();
    return trimmed.startsWith("<turn_aborted>") || !isSystemBoilerplate(trimmed, skipImplementPlan);
  });
}

function wasInterruptedAfterMessage(
  entries: SessionEntrySnapshot[],
  latestMessage: SessionEntrySnapshot,
) {
  const lastAbortEntry = [...entries].reverse().find(isAbortEntry);
  if (!lastAbortEntry) {
    return false;
  }

  const abortTs = parseRequiredTimestamp(lastAbortEntry.timestamp);
  const msgTs = parseRequiredTimestamp(latestMessage.timestamp);
  return abortTs !== null && msgTs !== null && abortTs >= msgTs;
}

function hasCompletionAfter(entries: SessionEntrySnapshot[], messageTs: number) {
  return entries.some((entry) => {
    if (entry.entryType !== "task_complete") {
      return false;
    }

    const entryTs = parseRequiredTimestamp(entry.timestamp);
    return entryTs !== null && entryTs >= messageTs;
  });
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

  // Build call_id → eventId map for spawn_agent function_call entries
  const spawnCallIdToEventId = new Map<string, string>();
  for (let i = 0; i < snapshot.entries.length; i++) {
    const entry = snapshot.entries[i];
    if (
      entry.entryType === "function_call" &&
      entry.functionName === "spawn_agent" &&
      entry.functionCallId &&
      parseRequiredTimestamp(entry.timestamp) !== null
    ) {
      const eventId = buildEntryEventId(snapshot.sessionId, entry, i);
      spawnCallIdToEventId.set(entry.functionCallId, eventId);
    }
  }

  // Build call_id pairing: spawn_agent output → sessionId, then map to spawn event
  const subagentToSpawnSource = new Map<string, string>();
  for (const entry of snapshot.entries) {
    if (entry.entryType !== "function_call_output" || !entry.functionCallId) continue;
    const spawnEventId = spawnCallIdToEventId.get(entry.functionCallId);
    if (!spawnEventId) continue;
    const { agentId, nickname } = readAgentReference(parseJsonRecord(entry.text));
    if (agentId) {
      // Direct match: agent_id = sessionId (Codex)
      const directMatch = subagents.find((subagent) => subagent.sessionId === agentId);
      if (directMatch) {
        subagentToSpawnSource.set(directMatch.sessionId, spawnEventId);
        continue;
      }
      // Fallback: nickname match
      if (nickname) {
        const nicknameMatch = subagents.find(
          (subagent) => subagent.agentNickname === nickname,
        );
        if (nicknameMatch) {
          subagentToSpawnSource.set(nicknameMatch.sessionId, spawnEventId);
        }
      }
    }
  }

  // Fallback: chronological ordering for subagents without call_id mapping
  if (subagentToSpawnSource.size < subagents.length) {
    const spawnToolEvents = parentEvents
      .filter((e) => e.toolName === "spawn_agent")
      .sort((a, b) => a.startTs - b.startTs);
    const sortedSubagents = [...subagents].sort((a, b) => a.startedTs - b.startedTs);
    for (let i = 0; i < sortedSubagents.length; i++) {
      if (!subagentToSpawnSource.has(sortedSubagents[i].sessionId) && i < spawnToolEvents.length) {
        subagentToSpawnSource.set(sortedSubagents[i].sessionId, spawnToolEvents[i].eventId);
      }
    }
  }

  // Extract error status from wait_agent outputs in parent entries.
  // Some subagent errors (e.g. usage limits) are only reported back to the
  // parent via wait_agent, not recorded in the subagent's own JSONL.
  const waitAgentErrors = new Map<string, string>();
  {
    const callNames = new Map<string, string>();
    for (const entry of snapshot.entries) {
      if (entry.entryType === "function_call" && entry.functionCallId && entry.functionName) {
        callNames.set(entry.functionCallId, entry.functionName);
      }
    }
    for (const entry of snapshot.entries) {
      if (entry.entryType !== "function_call_output" || !entry.functionCallId) continue;
      const name = callNames.get(entry.functionCallId);
      if (name !== "wait_agent" && name !== "wait") continue;
      const parsed = parseJsonRecord(entry.text);
      const statuses = parsed?.status;
      if (statuses && typeof statuses === "object") {
        for (const [agentId, agentStatus] of Object.entries(statuses)) {
          if (!agentStatus || typeof agentStatus !== "object") {
            continue;
          }
          const errored = (agentStatus as Record<string, unknown>).errored;
          if (typeof errored === "string") {
            const matched = subagents.find((subagent) => subagent.sessionId === agentId);
            if (matched && !waitAgentErrors.has(matched.sessionId)) {
              waitAgentErrors.set(matched.sessionId, errored);
            }
          }
        }
      }
    }
  }

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
      findClosestParentEvent([runStartEvent, ...parentEvents], sub.startedTs);
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

  // 매칭된 spawn_agent 이벤트 제목에 서브에이전트 닉네임 보강
  for (const [sessionId, eventId] of subagentToSpawnSource) {
    const sub = subagents.find((s) => s.sessionId === sessionId);
    const evt = allEvents.find((e) => e.eventId === eventId);
    if (sub && evt) {
      evt.title = `spawn_agent (${sub.agentNickname})`;
    }
  }

  // Build codex agent_id → subagent sessionId mapping from spawn_agent outputs
  // (declared early so resume_agent/send_input enrichment can use it below)
  const parentCallIdToName = new Map<string, string>();
  for (const entry of snapshot.entries) {
    if (entry.entryType === "function_call" && entry.functionCallId && entry.functionName) {
      parentCallIdToName.set(entry.functionCallId, entry.functionName);
    }
  }

  const codexAgentIdToSessionId = new Map<string, string>();
  for (const entry of snapshot.entries) {
    if (entry.entryType !== "function_call_output" || !entry.functionCallId) continue;
    const pairedName = parentCallIdToName.get(entry.functionCallId);
    if (pairedName !== "spawn_agent") continue;
    const { agentId, nickname } = readAgentReference(parseJsonRecord(entry.text));
    if (agentId) {
      // Direct match: Codex uses agent_id = sessionId
      const directMatch = subagents.find((subagent) => subagent.sessionId === agentId);
      if (directMatch) {
        codexAgentIdToSessionId.set(agentId, directMatch.sessionId);
      } else if (nickname) {
        // Fallback: match by nickname
        const matchingSub = subagents.find(
          (subagent) => subagent.agentNickname === nickname,
        );
        if (matchingSub) {
          codexAgentIdToSessionId.set(agentId, matchingSub.sessionId);
        }
      }
    }
  }

  // Find the last event in a subagent lane.
  // Excludes lifecycle bookend events (run.finished, run.cancelled) to avoid
  // selecting events whose timestamp comes from updatedAt rather than real work.
  const findLastSubagentEventId = (sessionId: string): string | null => {
    const subLaneId = `${sessionId}:sub`;
    const subLaneEvents = allEvents
      .filter((e) => e.laneId === subLaneId
        && e.eventType !== "run.finished"
        && e.eventType !== "run.cancelled")
      .sort((a, b) => b.startTs - a.startTs);
    return subLaneEvents[0]?.eventId ?? null;
  };

  // Resolve merge edge source, ensuring it doesn't have a later timestamp
  // than the target. Fork-context entries (e.g. parent's task_complete leaking
  // into the subagent) can create events with very late timestamps that would
  // cause backward-flowing edges. Falls back to the spawned event.
  const resolveMergeSource = (sessionId: string, targetEventId: string): string | null => {
    const lastEventId = findLastSubagentEventId(sessionId);
    if (!lastEventId) return null;

    const sourceTs = allEvents.find((e) => e.eventId === lastEventId)?.startTs ?? 0;
    const targetTs = allEvents.find((e) => e.eventId === targetEventId)?.startTs ?? 0;

    if (sourceTs <= targetTs) {
      return lastEventId;
    }

    // Source is after target — fall back to the spawned event
    const spawnedEventId = `${sessionId}:spawn`;
    if (allEvents.some((e) => e.eventId === spawnedEventId)) {
      return spawnedEventId;
    }

    return lastEventId;
  };

  // Resolve codex agent_id to subagent sessionId with direct match fallback
  const resolveSessionId = (agentId: string): string | undefined =>
    codexAgentIdToSessionId.get(agentId)
    ?? (subagents.some((s) => s.sessionId === agentId) ? agentId : undefined);

  // Build function_call eventId → function_call_output eventId mapping.
  // Merge edges target the output event (later timestamp) to prevent
  // backward-flowing arrows when the parent initiates wait/close before
  // the subagent actually finishes.
  const callEventToOutputEvent = new Map<string, string>();
  {
    const tempCallIdToEventId = new Map<string, string>();
    for (let i = 0; i < snapshot.entries.length; i++) {
      const entry = snapshot.entries[i];
      if (parseRequiredTimestamp(entry.timestamp) === null) {
        continue;
      }
      const eventId = buildEntryEventId(snapshot.sessionId, entry, i);
      if (entry.entryType === "function_call" && entry.functionCallId) {
        tempCallIdToEventId.set(entry.functionCallId, eventId);
      } else if (entry.entryType === "function_call_output" && entry.functionCallId) {
        const callEventId = tempCallIdToEventId.get(entry.functionCallId);
        if (callEventId) {
          callEventToOutputEvent.set(callEventId, eventId);
        }
      }
    }
  }

  // Collect candidate merge edges from close_agent and wait/wait_agent events.
  // A subagent may be referenced by multiple wait calls (polling with timeouts)
  // and then a close_agent. We keep only the merge edge with the LATEST target
  // timestamp per subagent to avoid cluttering the graph with redundant arrows.
  const mergeEdgeCandidates = new Map<string, { edge: EdgeRecord; targetTs: number }>();

  const upsertMergeCandidate = (sessionId: string, edge: EdgeRecord) => {
    const targetTs = allEvents.find((e) => e.eventId === edge.targetEventId)?.startTs ?? 0;
    const existing = mergeEdgeCandidates.get(sessionId);
    if (!existing || targetTs > existing.targetTs) {
      mergeEdgeCandidates.set(sessionId, { edge, targetTs });
    }
  };

  // Generate merge edges from close_agent events
  for (const evt of parentEvents) {
    if (evt.toolName !== "close_agent") continue;
    const args = parseJsonRecord(evt.inputPreview);
    const agentId = typeof args?.id === "string" ? args.id : null;
    const sessionId = agentId ? resolveSessionId(agentId) : undefined;
    if (!sessionId) continue;
    const sub = subagents.find((subagent) => subagent.sessionId === sessionId);
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
    for (const agentId of readStringArray(parseJsonRecord(evt.inputPreview), "ids")) {
      const sessionId = resolveSessionId(agentId);
      if (!sessionId) continue;
      const sub = subagents.find((subagent) => subagent.sessionId === sessionId);
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
    const args = parseJsonRecord(evt.inputPreview);
    if (!args) continue;
    if (evt.toolName === "resume_agent" || evt.toolName === "send_input") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      if (!sessionId) continue;
      const sub = subagents.find((subagent) => subagent.sessionId === sessionId);
      if (!sub) continue;
      evt.title = evt.toolName === "resume_agent"
        ? `Resume (${sub.agentNickname})`
        : `Send to ${sub.agentNickname}`;
    } else if (evt.toolName === "close_agent") {
      const sessionId = typeof args.id === "string" ? resolveSessionId(args.id) : undefined;
      if (!sessionId) continue;
      const sub = subagents.find((subagent) => subagent.sessionId === sessionId);
      if (!sub) continue;
      evt.title = `Close (${sub.agentNickname})`;
      evt.outputPreview = `${sub.agentNickname} (${sub.agentRole})`;
    } else if (evt.toolName === "wait" || evt.toolName === "wait_agent") {
      const names = readStringArray(args, "ids")
        .map((id) => resolveSessionId(id))
        .filter((sid): sid is string => sid !== undefined)
        .map((sid) => subagents.find((subagent) => subagent.sessionId === sid)?.agentNickname)
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

function buildLaneEventsFromEntries({
  entries,
  lane,
  userLane,
  updatedAtTs,
  status,
  model,
  displayTitle,
  isSubagent,
}: {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  userLane: AgentLane | null;
  updatedAtTs: number;
  status: RunStatus;
  model: string;
  displayTitle: string;
  isSubagent?: boolean;
}): EventRecord[] {
  const events: EventRecord[] = [];
  let lastValidEntryIndex = -1;

  const callIdToName = new Map<string, string>();
  for (const [index, entry] of entries.entries()) {
    if (entry.entryType === "function_call" && entry.functionCallId && entry.functionName) {
      callIdToName.set(entry.functionCallId, entry.functionName);
    }
    if (parseRequiredTimestamp(entry.timestamp) !== null) {
      lastValidEntryIndex = index;
    }
  }

  let firstUserPromptSeen = false;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const nextEntry = entries[index + 1];
    const startTs = parseRequiredTimestamp(entry.timestamp);
    if (startTs === null) {
      continue;
    }
    const nextTs = nextEntry ? parseRequiredTimestamp(nextEntry.timestamp) : updatedAtTs;
    const safeEndTs = nextTs !== null && nextTs > startTs ? nextTs : startTs + 1_000;
    const isLatest = index === lastValidEntryIndex;

    if (entry.entryType === "message" && entry.text) {
      const trimmedText = entry.text.trim();

      if (isSubagent && IMPLEMENT_PLAN_PATTERN.test(trimmedText)) {
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "note",
          title: "System instruction",
          inputPreview: null,
          outputPreview: sanitizeMessagePreview(entry.text),
        }));
        continue;
      }

      if (isSystemBoilerplate(trimmedText, isSubagent)) {
        continue;
      }
    }

    switch (entry.entryType) {
      case "message": {
        if (!entry.text) continue;
        const isUser = entry.role === "user";

        // assistant message가 바로 앞의 agent_message와 동일 타임스탬프면 중복 → 건너뜀
        if (!isUser) {
          const prevEntry = entries[index - 1];
          if (prevEntry?.entryType === "agent_message" && prevEntry.timestamp === entry.timestamp) {
            break;
          }
        }

        const preview = sanitizeMessagePreview(entry.text);

        // 서브에이전트의 role:"user" 메시지는 위임된 컨텍스트 (직접적인 사용자 입력 아님)
        if (isSubagent && isUser) {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "note",
            title: "Delegated prompt",
            inputPreview: null,
            outputPreview: preview,
          }));
          break;
        }

        const targetLane = isUser && userLane ? userLane : lane;

        let inputPreview: string | null = null;
        if (isUser) {
          if (!firstUserPromptSeen) {
            inputPreview = displayTitle;
            firstUserPromptSeen = true;
          } else {
            inputPreview = preview;
          }
        }

        events.push(buildEntryEvent({
          entry,
          lane: targetLane,
          startTs, safeEndTs, isLatest, status, model, index,
          eventType: isUser ? "user.prompt" : "note",
          title: isUser ? "User prompt" : "Assistant",
          inputPreview: isUser ? inputPreview : null,
          outputPreview: isUser ? null : preview,
        }));
        break;
      }

      case "function_call": {
        const functionName = entry.functionName ?? "unknown";

        if (functionName === "spawn_agent") {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "tool.started",
            title: "spawn_agent",
            inputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
            outputPreview: null,
            toolName: functionName,
          }));
        } else if (functionName === "close_agent") {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "agent.finished",
            title: "Agent closed",
            inputPreview: entry.functionArgumentsPreview,
            outputPreview: null,
            toolName: functionName,
          }));
        } else if (functionName === "update_plan") {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "note",
            title: "Plan updated",
            inputPreview: null,
            outputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
            toolName: functionName,
          }));
        } else if (functionName === "request_user_input") {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "tool.started",
            title: "User input requested",
            inputPreview: entry.functionArgumentsPreview,
            outputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
            waitReason: "awaiting user",
            toolName: functionName,
          }));
        } else if (functionName === "wait" || functionName === "wait_agent") {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "tool.started",
            title: "Waiting for agents",
            inputPreview: entry.functionArgumentsPreview,
            outputPreview: null,
            waitReason: "awaiting agents",
            toolName: functionName,
          }));
        } else {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "tool.started",
            title: functionName,
            inputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
            outputPreview: null,
            toolName: functionName,
          }));
        }
        break;
      }

      case "function_call_output": {
        const pairedName = entry.functionCallId ? callIdToName.get(entry.functionCallId) : null;
        const toolName = pairedName ?? "unknown";
        const outputText = entry.text
          ? sanitizeMessagePreview(extractToolOutputPreview(toolName, entry.text))
          : null;

        // Detect failed tool outputs from various patterns
        const exitCodeMatch = entry.text?.match(/Process exited with code (\d+)/);
        const failedExitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 0;
        const isExecFailed = failedExitCode !== 0 || (entry.text?.startsWith("exec_command failed") ?? false);
        const isToolOutputFailed = !isExecFailed && detectCodexToolFailure(entry.text);
        const errorMsg = failedExitCode !== 0
          ? `Exit code ${failedExitCode}`
          : isExecFailed ? "Command rejected"
          : isToolOutputFailed ? "Tool failed" : undefined;

        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "tool.finished",
          title: toolName === "request_user_input" ? "User responded" : `${toolName} result`,
          inputPreview: null,
          outputPreview: outputText,
          toolName,
          errorMessage: errorMsg,
        }));

        // Override status for failed tool outputs so they render with failed visual
        if (isExecFailed || isToolOutputFailed) {
          events[events.length - 1].status = "failed";
        }
        break;
      }

      case "reasoning":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "llm.started",
          title: "Reasoning",
          inputPreview: null,
          outputPreview: null,
        }));
        break;

      case "agent_message":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "note",
          title: "Commentary",
          inputPreview: null,
          outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
        }));
        break;

      case "agent_reasoning":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "note",
          title: "Agent reasoning",
          inputPreview: null,
          outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
        }));
        break;

      case "item_completed":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "note",
          title: "Plan",
          inputPreview: null,
          outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
        }));
        break;

      case "task_started":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "turn.started",
          title: "Turn started",
          inputPreview: null,
          outputPreview: null,
        }));
        break;

      case "task_complete":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "turn.finished",
          title: "Turn finished",
          inputPreview: null,
          outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
        }));
        break;

      case "context_compacted":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "note",
          title: "Context compacted",
          inputPreview: null,
          outputPreview: "Context reduced to fit within the model window",
        }));
        break;

      case "turn_aborted": {
        const reason = entry.text ?? "Turn aborted";
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "error",
          title: "Turn aborted",
          inputPreview: null,
          outputPreview: reason,
          errorMessage: reason,
        }));
        break;
      }

      case "thread_rolled_back": {
        const reason = entry.text ?? "Thread rolled back";
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "error",
          title: "Thread rolled back",
          inputPreview: null,
          outputPreview: reason,
          errorMessage: reason,
        }));
        break;
      }

      case "token_count": {
        if (!entry.text) break;
        const lastEvent = events[events.length - 1];
        if (!lastEvent) break;
        try {
          const tokens = JSON.parse(entry.text) as { in?: number; cached?: number; out?: number; reasoning?: number };
          lastEvent.tokensIn = tokens.in ?? 0;
          lastEvent.tokensOut = tokens.out ?? 0;
          lastEvent.reasoningTokens = tokens.reasoning ?? 0;
          lastEvent.cacheReadTokens = tokens.cached ?? 0;
        } catch {
          // Malformed token JSON, skip
        }
        break;
      }
    }
  }

  return events;
}

function buildEntryEvent({
  entry,
  lane,
  startTs,
  safeEndTs,
  isLatest,
  status,
  model,
  index,
  eventType,
  title,
  inputPreview,
  outputPreview,
  toolName,
  waitReason,
  errorMessage,
}: {
  entry: SessionEntrySnapshot;
  lane: AgentLane;
  startTs: number;
  safeEndTs: number;
  isLatest: boolean;
  status: RunStatus;
  model: string;
  index: number;
  eventType: EventType;
  title: string;
  inputPreview: string | null;
  outputPreview: string | null;
  toolName?: string;
  waitReason?: string;
  errorMessage?: string;
}): EventRecord {
  return {
    eventId: buildEntryEventId(lane.threadId, entry, index),
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType,
    status: isLatest ? status : "done",
    waitReason: waitReason ?? null,
    retryCount: 0,
    startTs,
    endTs: safeEndTs,
    durationMs: Math.max(safeEndTs - startTs, 1_000),
    title,
    inputPreview,
    outputPreview,
    artifactId: null,
    errorCode: null,
    errorMessage: errorMessage ?? null,
    provider: "OpenAI",
    model,
    toolName: toolName ?? null,
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

function isSystemBoilerplate(value: string, skipImplementPlan = false): boolean {
  const trimmed = value.trim();
  return (
    isAgentsInstruction(trimmed) ||
    isAutomationEnvelope(trimmed) ||
    trimmed.startsWith("<skill>") ||
    trimmed.startsWith("<subagent_notification>") ||
    trimmed.startsWith("<permissions") ||
    trimmed.startsWith("<turn_aborted>") ||
    (!skipImplementPlan && IMPLEMENT_PLAN_PATTERN.test(trimmed))
  );
}

function isMeaningfulTitleMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return false;
  }
  return !isSystemBoilerplate(trimmed);
}

function isAgentsInstruction(value: string) {
  return /^#\s*AGENTS\.md instructions\b/i.test(value.trim());
}

function isAutomationEnvelope(value: string) {
  return /^Automation:/i.test(value.trim());
}

function extractToolInputPreview(toolName: string, rawPreview: string | null): string | null {
  if (!rawPreview) return null;
  try {
    const args = JSON.parse(rawPreview);
    if (toolName === "exec_command" && typeof args.cmd === "string") return args.cmd;
    if (toolName === "apply_patch" && typeof args.path === "string") return args.path;
    if (toolName === "send_input" && typeof args.message === "string") {
      const prefix = args.interrupt ? "[interrupt] " : "";
      return `${prefix}${args.message}`;
    }
    if (toolName === "spawn_agent" && typeof args.message === "string") {
      const agentType = args.type ?? args.agent_type;
      const prefix = typeof agentType === "string" ? `[${agentType}] ` : "";
      return `${prefix}${args.message}`;
    }
    if (toolName === "update_plan" && typeof args.explanation === "string") return args.explanation;
    if (toolName === "request_user_input" && Array.isArray(args.questions) && args.questions[0]) {
      const q = args.questions[0];
      return typeof q.question === "string" ? q.question : null;
    }
    if (toolName === "view_image" && typeof args.path === "string") return args.path;
    if (toolName === "write_stdin") {
      if (typeof args.input === "string") return args.input;
      // Codex format: chars field contains the actual stdin content
      if (typeof args.chars === "string" && args.chars.length > 0) return args.chars;
      return null;
    }
    if (toolName === "search_tool_bm25" && typeof args.query === "string") return args.query;
    if (toolName === "read_mcp_resource") {
      const parts = [args.server, args.uri].filter(Boolean);
      if (parts.length > 0) return parts.join(":");
    }
    if (toolName === "list_mcp_resources" || toolName === "list_mcp_resource_templates" || toolName === "read_thread_terminal") {
      return null;
    }
  } catch { /* not JSON, fall through */ }

  // apply_patch from custom_tool_call: extract file paths from raw patch text
  if (toolName === "apply_patch") {
    const fileMatch = rawPreview.match(/\*\*\* (?:Add|Update|Delete) File: (.+)/);
    if (fileMatch) return fileMatch[1].trim();
  }

  return rawPreview;
}

function extractToolOutputPreview(toolName: string, rawOutput: string): string {
  if (toolName === "exec_command" || toolName === "write_stdin") {
    const outputMarker = rawOutput.indexOf("Output:\n");
    if (outputMarker !== -1) {
      const content = rawOutput.slice(outputMarker + "Output:\n".length).trim();
      return content || "(no output)";
    }
  }

  try {
    const parsed = JSON.parse(rawOutput);

    if (toolName === "wait" || toolName === "wait_agent") {
      if (parsed.timed_out) return "Timed out (polling)";
      const statuses = parsed.status;
      if (statuses && typeof statuses === "object") {
        const entries = Object.values(statuses);
        if (entries.length === 0) return "No agent status";
        const summaries = entries.map((s: unknown) => {
          if (s && typeof s === "object") {
            if ("completed" in s) return "completed";
            if ("errored" in s) return `errored: ${(s as Record<string, string>).errored}`;
          }
          return "unknown";
        });
        return summaries.join(", ");
      }
    }

    if (toolName === "spawn_agent") {
      const nickname = parsed.nickname ?? parsed.agent_nickname;
      if (typeof nickname === "string") return `Spawned: ${nickname}`;
    }

    if (toolName === "send_input") {
      return "Input delivered";
    }

    if (toolName === "request_user_input" && parsed.answers && typeof parsed.answers === "object") {
      const firstAnswer = Object.values(parsed.answers)[0];
      if (firstAnswer && typeof firstAnswer === "object" && Array.isArray((firstAnswer as Record<string, unknown>).answers)) {
        const text = ((firstAnswer as Record<string, unknown>).answers as string[])[0];
        if (typeof text === "string") return text;
      }
    }

    if (toolName === "resume_agent" || toolName === "close_agent") {
      const status = parsed.status;
      if (status && typeof status === "object") {
        if ("completed" in status) return typeof status.completed === "string"
          ? status.completed
          : "Agent completed";
        if ("errored" in status) return `Agent errored: ${status.errored}`;
      }
    }

    // Generic Codex-style tool output: {"output": "...", "metadata": {...}}
    // Handles apply_patch and other custom tools that wrap results in this structure
    if (typeof parsed.output === "string") {
      return parsed.output;
    }
  } catch { /* not JSON, fall through */ }

  return rawOutput;
}

/** Detect Codex-style tool failures from JSON output with metadata.exit_code or error text */
function detectCodexToolFailure(rawOutput: string | null | undefined): boolean {
  if (!rawOutput) return false;
  try {
    const parsed = JSON.parse(rawOutput);
    if (parsed.metadata?.exit_code && parsed.metadata.exit_code !== 0) return true;
    if (typeof parsed.output === "string") {
      return parsed.output.includes("verification failed") || parsed.output.includes("apply_patch failed");
    }
  } catch { /* not JSON */ }
  return false;
}

function sanitizeMessagePreview(value: string) {
  const normalized = sanitizeSessionText(value);
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
}

export function sanitizeSessionText(value: string) {
  return value
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(/\$([A-Za-z0-9-]+)/g, "$1")
    .replace(IMAGE_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveArchiveIndexTitle(firstUserMessage: string | null): string | null {
  if (!firstUserMessage) return null;
  const sanitized = sanitizeSessionText(firstUserMessage);
  if (sanitized.length === 0) return null;
  return sanitized.length > 120 ? `${sanitized.slice(0, 117)}...` : sanitized;
}

function parseRequiredTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildTimedSubagentSnapshots(
  subagents: SubagentSnapshot[],
): TimedSubagentSnapshot[] {
  return subagents.flatMap((subagent) => {
    const startedTs = parseRequiredTimestamp(subagent.startedAt);
    const updatedAtTs = parseRequiredTimestamp(subagent.updatedAt);
    if (startedTs === null || updatedAtTs === null) {
      return [];
    }

    return [
      {
        ...subagent,
        startedTs,
        updatedTs: Math.max(updatedAtTs, startedTs),
      },
    ];
  });
}

function buildEntryEventId(
  threadId: string,
  entry: Pick<SessionEntrySnapshot, "timestamp" | "entryType">,
  index: number,
) {
  return `${threadId}:${entry.timestamp}:${entry.entryType}:${index}`;
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readAgentReference(record: Record<string, unknown> | null) {
  return {
    agentId:
      typeof record?.agent_id === "string"
        ? record.agent_id
        : typeof record?.agentId === "string"
          ? record.agentId
          : null,
    nickname:
      typeof record?.nickname === "string"
        ? record.nickname
        : typeof record?.agent_nickname === "string"
          ? record.agent_nickname
          : null,
  };
}

function readStringArray(record: Record<string, unknown> | null, key: string): string[] {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
