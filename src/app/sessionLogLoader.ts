import {
  type AgentLane,
  type ArchivedSessionIndexResult,
  calculateSummaryMetrics,
  type EdgeRecord,
  type EventRecord,
  type EventType,
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
  const hasAbort = entries.some(
    (entry) => entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back",
  );

  const messageEntries = entries.filter(
    (entry) => entry.entryType === "message" && entry.text != null,
  );

  const latestMessage = [...messageEntries].reverse().find((entry) => {
    const trimmed = entry.text?.trim() ?? "";
    return trimmed.startsWith("<turn_aborted>") || !isSystemBoilerplate(trimmed, skipImplementPlan);
  });

  if (!latestMessage) {
    if (hasAbort) return "interrupted";
    return "done";
  }

  if (latestMessage.text?.includes("<turn_aborted>")) {
    return "interrupted";
  }

  if (hasAbort) {
    const lastAbortEntry = [...entries].reverse().find(
      (entry) => entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back",
    );
    if (lastAbortEntry) {
      const abortTs = parseTimestamp(lastAbortEntry.timestamp);
      const msgTs = parseTimestamp(latestMessage.timestamp);
      if (abortTs >= msgTs) return "interrupted";
    }
  }

  return latestMessage.role === "user" ? "running" : "done";
}

export function buildDatasetFromSessionLog(snapshot: SessionLogSnapshot): RunDataset | null {
  const startTs = parseTimestamp(snapshot.startedAt);
  const updatedTs = Math.max(parseTimestamp(snapshot.updatedAt), startTs);
  if (!Number.isFinite(startTs) || !Number.isFinite(updatedTs)) {
    return null;
  }

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
    updatedAt: snapshot.updatedAt,
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

  const subagents = snapshot.subagents ?? [];
  for (const sub of subagents) {
    const subLaneId = `${sub.sessionId}:sub`;
    const subModel = sub.model ?? resolvedModel;
    let subStatus = deriveSessionLogStatus(sub.entries, true);

    if (sub.error && subStatus === "done") {
      subStatus = "interrupted";
    }
    if (sub.entries.length === 0 && !sub.error && subStatus === "done") {
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
      updatedAt: sub.updatedAt,
      status: subStatus,
      model: subModel,
      displayTitle: sub.agentNickname,
      isSubagent: true,
    });

    const subStartTs = parseTimestamp(sub.startedAt);
    const subFirstEventTs = subEvents[0]?.startTs ?? subStartTs;
    const spawnEvent: EventRecord = {
      eventId: `${sub.sessionId}:spawn`,
      parentId: null,
      linkIds: [],
      laneId: subLane.laneId,
      agentId: subLane.agentId,
      threadId: subLane.threadId,
      eventType: "agent.spawned",
      status: sub.error ? "failed" : "done",
      waitReason: null,
      retryCount: 0,
      startTs: subStartTs,
      endTs: Math.max(subFirstEventTs, subStartTs + 1_000),
      durationMs: Math.max(subFirstEventTs - subStartTs, 1_000),
      title: `${sub.agentNickname} spawned`,
      inputPreview: sub.agentRole,
      outputPreview: null,
      artifactId: null,
      errorCode: null,
      errorMessage: sub.error ?? null,
      provider: "OpenAI",
      model: subModel,
      toolName: null,
      tokensIn: 0,
      tokensOut: 0,
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
      parseTimestamp(sub.updatedAt),
      subStatus,
      subModel,
    );

    allEvents.push(spawnEvent, ...subEvents, ...(subEndEvent ? [subEndEvent] : []));

    const sourceEventId = findClosestParentEvent(
      [runStartEvent, ...parentEvents],
      subStartTs,
    );
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
  };

  return {
    ...dataset,
    run: {
      ...dataset.run,
      summaryMetrics: calculateSummaryMetrics(dataset),
    },
  };
}

function buildLaneEventsFromEntries({
  entries,
  lane,
  userLane,
  updatedAt,
  status,
  model,
  displayTitle,
  isSubagent,
}: {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  userLane: AgentLane | null;
  updatedAt: string;
  status: RunStatus;
  model: string;
  displayTitle: string;
  isSubagent?: boolean;
}): EventRecord[] {
  const events: EventRecord[] = [];

  const callIdToName = new Map<string, string>();
  for (const entry of entries) {
    if (entry.entryType === "function_call" && entry.functionCallId && entry.functionName) {
      callIdToName.set(entry.functionCallId, entry.functionName);
    }
  }

  let firstUserPromptSeen = false;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const nextEntry = entries[index + 1];
    const startTs = parseTimestamp(entry.timestamp);
    const nextTs = nextEntry ? parseTimestamp(nextEntry.timestamp) : parseTimestamp(updatedAt);
    const safeEndTs = Number.isFinite(nextTs) && nextTs > startTs ? nextTs : startTs + 1_000;
    const isLatest = index === entries.length - 1;

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
            eventType: "agent.spawned",
            title: "Agent spawned",
            inputPreview: entry.functionArgumentsPreview,
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
            outputPreview: entry.functionArgumentsPreview,
            toolName: functionName,
          }));
        } else if (functionName === "request_user_input") {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "tool.started",
            title: "User input requested",
            inputPreview: entry.functionArgumentsPreview,
            outputPreview: null,
            waitReason: "awaiting user",
            toolName: functionName,
          }));
        } else {
          events.push(buildEntryEvent({
            entry, lane, startTs, safeEndTs, isLatest, status, model, index,
            eventType: "tool.started",
            title: functionName,
            inputPreview: entry.functionArgumentsPreview,
            outputPreview: null,
            toolName: functionName,
          }));
        }
        break;
      }

      case "function_call_output": {
        const pairedName = entry.functionCallId ? callIdToName.get(entry.functionCallId) : null;
        const toolName = pairedName ?? "unknown";

        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "tool.finished",
          title: toolName === "request_user_input" ? "User responded" : `${toolName} result`,
          inputPreview: null,
          outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
          toolName,
        }));
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
          outputPreview: null,
        }));
        break;

      case "context_compacted":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "note",
          title: "Context compacted",
          inputPreview: null,
          outputPreview: null,
        }));
        break;

      case "turn_aborted":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "error",
          title: "Turn aborted",
          inputPreview: null,
          outputPreview: null,
          errorMessage: entry.text ?? "Turn aborted",
        }));
        break;

      case "thread_rolled_back":
        events.push(buildEntryEvent({
          entry, lane, startTs, safeEndTs, isLatest, status, model, index,
          eventType: "error",
          title: "Thread rolled back",
          inputPreview: null,
          outputPreview: null,
          errorMessage: entry.text ?? "Thread rolled back",
        }));
        break;
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
    eventId: `${lane.threadId}:${entry.timestamp}:${entry.entryType}:${index}`,
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
  let best = parentEvents[0];
  let bestDelta = Math.abs(best.startTs - targetTs);
  for (const event of parentEvents) {
    const delta = Math.abs(event.startTs - targetTs);
    if (delta < bestDelta) {
      best = event;
      bestDelta = delta;
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

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
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
