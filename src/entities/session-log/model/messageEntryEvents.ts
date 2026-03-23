import {
  isImplementPlanMessage,
  isSystemBoilerplate,
} from "../lib/systemBoilerplate";
import { sanitizeMessagePreview } from "../lib/text";
import type { MessageEventArgs, MessageEventResult } from "./eventBuilderTypes";
import {
  createMessageEventRecord,
  resolveStandardMessageEventOptions,
} from "./messageEventRecord";
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
  const messagePreview = readMessagePreview(context.entry.text);
  if (!messagePreview) {
    return { event: null, firstUserPromptSeen };
  }

  const specialCase = buildSpecialMessageEvent({
    context,
    previousEntry,
    isSubagent,
    firstUserPromptSeen,
    preview: messagePreview.preview,
    messageText: messagePreview.messageText,
  });
  if (specialCase) {
    return specialCase;
  }

  return buildStandardMessageEvent({
    context,
    userLane,
    displayTitle,
    preview: messagePreview.preview,
    firstUserPromptSeen,
  });
}

function readMessagePreview(messageText: string | null) {
  return messageText
    ? {
        messageText,
        preview: sanitizeMessagePreview(messageText),
      }
    : null;
}

function buildSpecialMessageEvent({
  context,
  previousEntry,
  isSubagent,
  firstUserPromptSeen,
  preview,
  messageText,
}: {
  context: MessageEventArgs["context"];
  previousEntry: MessageEventArgs["previousEntry"];
  isSubagent: boolean;
  firstUserPromptSeen: boolean;
  preview: string;
  messageText: string;
}) {
  if (shouldBuildSystemInstructionEvent(isSubagent, messageText)) {
    return buildSystemInstructionEvent(context, preview, firstUserPromptSeen);
  }
  if (shouldSkipAssistantMessage(previousEntry, context.entry)) {
    return { event: null, firstUserPromptSeen };
  }
  return shouldBuildDelegatedPromptEvent(isSubagent, context.entry)
    ? buildDelegatedPromptEvent(context, preview, firstUserPromptSeen)
    : null;
}

function shouldBuildSystemInstructionEvent(
  isSubagent: boolean,
  messageText: string,
) {
  return isSubagent && isImplementPlanMessage(messageText.trim());
}

function buildSystemInstructionEvent(
  context: MessageEventArgs["context"],
  preview: string,
  firstUserPromptSeen: boolean,
): MessageEventResult {
  return {
    event: createMessageEventRecord(context, {
      title: "System instruction",
      eventType: "note",
      inputPreview: null,
      outputPreview: preview,
    }),
    firstUserPromptSeen,
  };
}

function shouldSkipAssistantMessage(
  previousEntry: SessionEntrySnapshot | undefined,
  entry: SessionEntrySnapshot,
) {
  return (
    entry.role !== "user" &&
    previousEntry?.entryType === "agent_message" &&
    previousEntry.timestamp === entry.timestamp
  );
}

function shouldBuildDelegatedPromptEvent(
  isSubagent: boolean,
  entry: SessionEntrySnapshot,
) {
  return isSubagent && entry.role === "user";
}

function buildDelegatedPromptEvent(
  context: MessageEventArgs["context"],
  preview: string,
  firstUserPromptSeen: boolean,
): MessageEventResult {
  return {
    event: createMessageEventRecord(context, {
      title: "Delegated prompt",
      eventType: "note",
      inputPreview: null,
      outputPreview: preview,
    }),
    firstUserPromptSeen,
  };
}

function buildStandardMessageEvent({
  context,
  userLane,
  displayTitle,
  preview,
  firstUserPromptSeen,
}: {
  context: MessageEventArgs["context"];
  userLane: MessageEventArgs["userLane"];
  displayTitle: string;
  preview: string;
  firstUserPromptSeen: boolean;
}): MessageEventResult {
  const standardOptions = resolveStandardMessageEventOptions({
    context,
    userLane,
    displayTitle,
    preview,
    firstUserPromptSeen,
  });
  return {
    event: createMessageEventRecord(context, standardOptions),
    firstUserPromptSeen: standardOptions.firstUserPromptSeen,
  };
}
