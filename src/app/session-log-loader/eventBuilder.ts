import type { AgentLane, EventRecord, EventType, RunStatus } from "../../shared/domain";
import { buildEntryEventId, parseRequiredTimestamp } from "./helpers";
import {
  isImplementPlanMessage,
  isSystemBoilerplate,
  sanitizeMessagePreview,
} from "./text";
import {
  detectCodexToolFailure,
  extractToolInputPreview,
  extractToolOutputPreview,
} from "./toolPreview";
import type { SessionEntrySnapshot } from "./types";

interface BuildLaneEventsArgs {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  userLane: AgentLane | null;
  updatedAtTs: number;
  status: RunStatus;
  model: string;
  displayTitle: string;
  isSubagent?: boolean;
}

interface EntryContext {
  entry: SessionEntrySnapshot;
  lane: AgentLane;
  startTs: number;
  safeEndTs: number;
  isLatest: boolean;
  status: RunStatus;
  model: string;
  index: number;
}

export function buildLaneEventsFromEntries({
  entries,
  lane,
  userLane,
  updatedAtTs,
  status,
  model,
  displayTitle,
  isSubagent = false,
}: BuildLaneEventsArgs): EventRecord[] {
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
    const context: EntryContext = {
      entry,
      lane,
      startTs,
      safeEndTs,
      isLatest,
      status,
      model,
      index,
    };

    if (entry.entryType === "message" && shouldSkipMessageEntry(entry, isSubagent)) {
      continue;
    }

    switch (entry.entryType) {
      case "message": {
        const result = buildMessageEvent({
          context,
          previousEntry: entries[index - 1],
          userLane,
          displayTitle,
          isSubagent,
          firstUserPromptSeen,
        });
        firstUserPromptSeen = result.firstUserPromptSeen;
        if (result.event) {
          events.push(result.event);
        }
        break;
      }

      case "function_call":
        events.push(buildFunctionCallEvent(context));
        break;

      case "function_call_output":
        events.push(buildFunctionCallOutputEvent(context, callIdToName));
        break;

      case "reasoning":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "llm.started",
            title: "Reasoning",
            inputPreview: null,
            outputPreview: null,
          }),
        );
        break;

      case "agent_message":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "note",
            title: "Commentary",
            inputPreview: null,
            outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
          }),
        );
        break;

      case "agent_reasoning":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "note",
            title: "Agent reasoning",
            inputPreview: null,
            outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
          }),
        );
        break;

      case "item_completed":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "note",
            title: "Plan",
            inputPreview: null,
            outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
          }),
        );
        break;

      case "task_started":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "turn.started",
            title: "Turn started",
            inputPreview: null,
            outputPreview: null,
          }),
        );
        break;

      case "task_complete":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "turn.finished",
            title: "Turn finished",
            inputPreview: null,
            outputPreview: entry.text ? sanitizeMessagePreview(entry.text) : null,
          }),
        );
        break;

      case "context_compacted":
        events.push(
          createEntryEvent({
            ...context,
            eventType: "note",
            title: "Context compacted",
            inputPreview: null,
            outputPreview: "Context reduced to fit within the model window",
          }),
        );
        break;

      case "turn_aborted": {
        const reason = entry.text ?? "Turn aborted";
        events.push(
          createEntryEvent({
            ...context,
            eventType: "error",
            title: "Turn aborted",
            inputPreview: null,
            outputPreview: reason,
            errorMessage: reason,
          }),
        );
        break;
      }

      case "thread_rolled_back": {
        const reason = entry.text ?? "Thread rolled back";
        events.push(
          createEntryEvent({
            ...context,
            eventType: "error",
            title: "Thread rolled back",
            inputPreview: null,
            outputPreview: reason,
            errorMessage: reason,
          }),
        );
        break;
      }

      case "token_count":
        applyTokenCountToLastEvent(events, entry.text);
        break;
    }
  }

  return events;
}

function shouldSkipMessageEntry(
  entry: SessionEntrySnapshot,
  isSubagent: boolean,
) {
  if (!entry.text) {
    return false;
  }

  const trimmedText = entry.text.trim();
  return !(isSubagent && isImplementPlanMessage(trimmedText))
    && isSystemBoilerplate(trimmedText, isSubagent);
}

function buildMessageEvent({
  context,
  previousEntry,
  userLane,
  displayTitle,
  isSubagent,
  firstUserPromptSeen,
}: {
  context: EntryContext;
  previousEntry: SessionEntrySnapshot | undefined;
  userLane: AgentLane | null;
  displayTitle: string;
  isSubagent: boolean;
  firstUserPromptSeen: boolean;
}) {
  const { entry, lane, startTs, safeEndTs, isLatest, status, model, index } = context;
  if (!entry.text) {
    return { event: null, firstUserPromptSeen };
  }

  const trimmedText = entry.text.trim();
  if (isSubagent && isImplementPlanMessage(trimmedText)) {
    return {
      event: createEntryEvent({
        entry,
        lane,
        startTs,
        safeEndTs,
        isLatest,
        status,
        model,
        index,
        eventType: "note",
        title: "System instruction",
        inputPreview: null,
        outputPreview: sanitizeMessagePreview(entry.text),
      }),
      firstUserPromptSeen,
    };
  }

  const isUser = entry.role === "user";
  if (
    !isUser &&
    previousEntry?.entryType === "agent_message" &&
    previousEntry.timestamp === entry.timestamp
  ) {
    return { event: null, firstUserPromptSeen };
  }

  const preview = sanitizeMessagePreview(entry.text);
  if (isSubagent && isUser) {
    return {
      event: createEntryEvent({
        entry,
        lane,
        startTs,
        safeEndTs,
        isLatest,
        status,
        model,
        index,
        eventType: "note",
        title: "Delegated prompt",
        inputPreview: null,
        outputPreview: preview,
      }),
      firstUserPromptSeen,
    };
  }

  const targetLane = isUser && userLane ? userLane : lane;
  let inputPreview: string | null = null;
  let nextFirstUserPromptSeen = firstUserPromptSeen;
  if (isUser) {
    inputPreview = firstUserPromptSeen ? preview : displayTitle;
    nextFirstUserPromptSeen = true;
  }

  return {
    event: createEntryEvent({
      entry,
      lane: targetLane,
      startTs,
      safeEndTs,
      isLatest,
      status,
      model,
      index,
      eventType: isUser ? "user.prompt" : "note",
      title: isUser ? "User prompt" : "Assistant",
      inputPreview: isUser ? inputPreview : null,
      outputPreview: isUser ? null : preview,
    }),
    firstUserPromptSeen: nextFirstUserPromptSeen,
  };
}

function buildFunctionCallEvent(context: EntryContext): EventRecord {
  const { entry } = context;
  const functionName = entry.functionName ?? "unknown";

  if (functionName === "spawn_agent") {
    return createEntryEvent({
      ...context,
      eventType: "tool.started",
      title: "spawn_agent",
      inputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
      outputPreview: null,
      toolName: functionName,
    });
  }

  if (functionName === "close_agent") {
    return createEntryEvent({
      ...context,
      eventType: "agent.finished",
      title: "Agent closed",
      inputPreview: entry.functionArgumentsPreview,
      outputPreview: null,
      toolName: functionName,
    });
  }

  if (functionName === "update_plan") {
    return createEntryEvent({
      ...context,
      eventType: "note",
      title: "Plan updated",
      inputPreview: null,
      outputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
      toolName: functionName,
    });
  }

  if (functionName === "request_user_input") {
    return createEntryEvent({
      ...context,
      eventType: "tool.started",
      title: "User input requested",
      inputPreview: entry.functionArgumentsPreview,
      outputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
      waitReason: "awaiting user",
      toolName: functionName,
    });
  }

  if (functionName === "wait" || functionName === "wait_agent") {
    return createEntryEvent({
      ...context,
      eventType: "tool.started",
      title: "Waiting for agents",
      inputPreview: entry.functionArgumentsPreview,
      outputPreview: null,
      waitReason: "awaiting agents",
      toolName: functionName,
    });
  }

  return createEntryEvent({
    ...context,
    eventType: "tool.started",
    title: functionName,
    inputPreview: extractToolInputPreview(functionName, entry.functionArgumentsPreview),
    outputPreview: null,
    toolName: functionName,
  });
}

function buildFunctionCallOutputEvent(
  context: EntryContext,
  callIdToName: Map<string, string>,
): EventRecord {
  const { entry } = context;
  const toolName = entry.functionCallId
    ? callIdToName.get(entry.functionCallId) ?? "unknown"
    : "unknown";
  const outputText = entry.text
    ? sanitizeMessagePreview(extractToolOutputPreview(toolName, entry.text))
    : null;

  const exitCodeMatch = entry.text?.match(/Process exited with code (\d+)/);
  const failedExitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 0;
  const isExecFailed =
    failedExitCode !== 0 || (entry.text?.startsWith("exec_command failed") ?? false);
  const isToolOutputFailed = !isExecFailed && detectCodexToolFailure(entry.text);
  const errorMessage =
    failedExitCode !== 0
      ? `Exit code ${failedExitCode}`
      : isExecFailed
        ? "Command rejected"
        : isToolOutputFailed
          ? "Tool failed"
          : undefined;

  const event = createEntryEvent({
    ...context,
    eventType: "tool.finished",
    title: toolName === "request_user_input" ? "User responded" : `${toolName} result`,
    inputPreview: null,
    outputPreview: outputText,
    toolName,
    errorMessage,
  });

  if (isExecFailed || isToolOutputFailed) {
    event.status = "failed";
  }

  return event;
}

function applyTokenCountToLastEvent(
  events: EventRecord[],
  rawTokenCount: string | null,
) {
  if (!rawTokenCount) {
    return;
  }

  const lastEvent = events[events.length - 1];
  if (!lastEvent) {
    return;
  }

  try {
    const tokens = JSON.parse(rawTokenCount) as {
      in?: number;
      cached?: number;
      out?: number;
      reasoning?: number;
    };
    lastEvent.tokensIn = tokens.in ?? 0;
    lastEvent.tokensOut = tokens.out ?? 0;
    lastEvent.reasoningTokens = tokens.reasoning ?? 0;
    lastEvent.cacheReadTokens = tokens.cached ?? 0;
  } catch {
    // Ignore malformed token payloads.
  }
}

function createEntryEvent({
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
}: EntryContext & {
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
