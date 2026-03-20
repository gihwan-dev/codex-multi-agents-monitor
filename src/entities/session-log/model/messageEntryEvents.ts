import {
  isImplementPlanMessage,
  isSystemBoilerplate,
  sanitizeMessagePreview,
} from "../lib/text";
import { createEntryEvent } from "./eventBuilderRecord";
import type { MessageEventArgs, MessageEventResult } from "./eventBuilderTypes";
import type { SessionEntrySnapshot } from "./types";

export function shouldSkipMessageEntry(
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

export function buildMessageEvent({
  context,
  previousEntry,
  userLane,
  displayTitle,
  isSubagent,
  firstUserPromptSeen,
}: MessageEventArgs): MessageEventResult {
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
