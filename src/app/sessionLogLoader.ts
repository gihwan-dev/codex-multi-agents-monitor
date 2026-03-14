import { type AgentLane, calculateSummaryMetrics, type EventRecord, type RunDataset, type RunStatus } from "../shared/domain";
import { invokeTauri } from "./tauri";

export interface SessionLogSnapshotMessage {
  timestamp: string;
  role: "user" | "assistant";
  text: string;
}

export interface SessionLogSnapshot {
  sessionId: string;
  workspacePath: string;
  originPath: string;
  displayName: string;
  startedAt: string;
  updatedAt: string;
  model: string | null;
  messages: SessionLogSnapshotMessage[];
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

export function deriveSessionLogTitle(messages: SessionLogSnapshotMessage[]) {
  const firstMeaningfulUserMessage = messages.find(
    (message) => message.role === "user" && isMeaningfulTitleMessage(message.text),
  );

  if (!firstMeaningfulUserMessage) {
    return NEW_THREAD_TITLE;
  }

  const sanitizedTitle = sanitizeSessionText(firstMeaningfulUserMessage.text);
  return sanitizedTitle.length > 0 ? sanitizedTitle : NEW_THREAD_TITLE;
}

export function deriveSessionLogStatus(messages: SessionLogSnapshotMessage[]): RunStatus {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => !isAgentsInstruction(message.text));

  if (!latestMessage) {
    return "done";
  }

  if (latestMessage.text.includes("<turn_aborted>")) {
    return "interrupted";
  }

  return latestMessage.role === "user" ? "running" : "done";
}

export function buildDatasetFromSessionLog(snapshot: SessionLogSnapshot): RunDataset | null {
  const startTs = parseTimestamp(snapshot.startedAt);
  const updatedTs = Math.max(parseTimestamp(snapshot.updatedAt), startTs);
  if (!Number.isFinite(startTs) || !Number.isFinite(updatedTs)) {
    return null;
  }

  const displayTitle = deriveSessionLogTitle(snapshot.messages);
  const status = deriveSessionLogStatus(snapshot.messages);
  const laneId = `${snapshot.sessionId}:main`;
  const resolvedModel = snapshot.model ?? "unknown";
  const lane: AgentLane = {
    laneId,
    agentId: laneId,
    threadId: snapshot.sessionId,
    name: "Main thread",
    role: "session",
    model: resolvedModel,
    provider: "OpenAI",
    badge: "Desktop",
    laneStatus: status,
  };

  const timelineMessages = snapshot.messages.filter(
    (message) => !isAgentsInstruction(message.text),
  );
  const firstUserMessageIndex = timelineMessages.findIndex((message) => message.role === "user");
  const messageEvents = timelineMessages.map((message, index) =>
    buildMessageEvent({
      displayTitle,
      message,
      lane,
      nextTimestamp: timelineMessages[index + 1]?.timestamp ?? snapshot.updatedAt,
      useDisplayTitle: index === firstUserMessageIndex,
      isLatest: index === timelineMessages.length - 1,
      runStatus: status,
      model: resolvedModel,
    }),
  );

  const firstEventTs = messageEvents[0]?.startTs ?? updatedTs;
  const runStartEvent: EventRecord = {
    eventId: `${snapshot.sessionId}:run-start`,
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType: "run.started",
    status: timelineMessages.length === 0 && status === "running" ? "running" : "done",
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

  const runEndEvent = buildRunEndEvent(snapshot.sessionId, lane, updatedTs, status, resolvedModel);
  const events = [runStartEvent, ...messageEvents, ...(runEndEvent ? [runEndEvent] : [])];
  const selectedByDefaultId =
    messageEvents[messageEvents.length - 1]?.eventId ?? runStartEvent.eventId;

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
    },
    lanes: [lane],
    events,
    edges: [],
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

function buildMessageEvent({
  displayTitle,
  message,
  lane,
  nextTimestamp,
  useDisplayTitle,
  isLatest,
  runStatus,
  model,
}: {
  displayTitle: string;
  message: SessionLogSnapshotMessage;
  lane: AgentLane;
  nextTimestamp: string;
  useDisplayTitle: boolean;
  isLatest: boolean;
  runStatus: RunStatus;
  model: string;
}): EventRecord {
  const startTs = parseTimestamp(message.timestamp);
  const nextTs = parseTimestamp(nextTimestamp);
  const safeEndTs = Number.isFinite(nextTs) && nextTs > startTs ? nextTs : startTs + 1_000;
  const preview = sanitizeMessagePreview(message.text);
  const isUserMessage = message.role === "user";

  return {
    eventId: `${lane.threadId}:${message.timestamp}:${message.role}`,
    parentId: null,
    linkIds: [],
    laneId: lane.laneId,
    agentId: lane.agentId,
    threadId: lane.threadId,
    eventType: "note",
    status: isLatest ? runStatus : "done",
    waitReason: null,
    retryCount: 0,
    startTs,
    endTs: safeEndTs,
    durationMs: Math.max(safeEndTs - startTs, 1_000),
    title: isUserMessage ? "User prompt" : "Assistant update",
    inputPreview: isUserMessage ? (useDisplayTitle ? displayTitle : preview) : null,
    outputPreview: isUserMessage ? null : preview,
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
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    finishReason: null,
    rawInput: null,
    rawOutput: null,
  } satisfies EventRecord;
}

function isMeaningfulTitleMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return false;
  }

  return !(
    isAgentsInstruction(trimmed) ||
    isAutomationEnvelope(trimmed) ||
    trimmed.startsWith("<skill>") ||
    trimmed.startsWith("<subagent_notification>") ||
    trimmed.startsWith("<turn_aborted>") ||
    IMPLEMENT_PLAN_PATTERN.test(trimmed)
  );
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

function sanitizeSessionText(value: string) {
  return value
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(/\$([A-Za-z0-9-]+)/g, "$1")
    .replace(IMAGE_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
