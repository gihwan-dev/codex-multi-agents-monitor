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

type NoteMessageEventOptions = {
  context: MessageEventArgs["context"];
  title: string;
  preview: string;
  firstUserPromptSeen: boolean;
};

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

function buildSpecialMessageEvent(options: {
  context: MessageEventArgs["context"];
  previousEntry: MessageEventArgs["previousEntry"];
  isSubagent: boolean;
  firstUserPromptSeen: boolean;
  preview: string;
  messageText: string;
}) {
  const {
    context,
    previousEntry,
    isSubagent,
    firstUserPromptSeen,
    preview,
    messageText,
  } = options;
  const noteTitle = readSpecialMessageNoteTitle({
    isSubagent,
    entry: context.entry,
    messageText,
  });
  if (noteTitle) {
    return buildNoteMessageEventResult({
      context,
      title: noteTitle,
      preview,
      firstUserPromptSeen,
    });
  }
  if (shouldSkipAssistantMessage(previousEntry, context.entry)) {
    return { event: null, firstUserPromptSeen };
  }
  return null;
}

function readSpecialMessageNoteTitle(options: {
  isSubagent: boolean;
  entry: SessionEntrySnapshot;
  messageText: string;
}) {
  if (shouldBuildSystemInstructionEvent(options.isSubagent, options.messageText)) {
    return "System instruction";
  }

  return shouldBuildDelegatedPromptEvent(options.isSubagent, options.entry)
    ? "Delegated prompt"
    : null;
}

function buildNoteMessageEventResult(options: NoteMessageEventOptions): MessageEventResult {
  const eventOptions = {
    title: options.title,
    eventType: "note" as const,
    inputPreview: null,
    outputPreview: options.preview,
  };

  return {
    event: createMessageEventRecord(options.context, eventOptions),
    firstUserPromptSeen: options.firstUserPromptSeen,
  };
}

function shouldBuildSystemInstructionEvent(
  isSubagent: boolean,
  messageText: string,
) {
  return isSubagent && isImplementPlanMessage(messageText.trim());
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

function buildStandardMessageEvent(options: {
  context: MessageEventArgs["context"];
  userLane: MessageEventArgs["userLane"];
  displayTitle: string;
  preview: string;
  firstUserPromptSeen: boolean;
}): MessageEventResult {
  const { context, userLane, displayTitle, preview, firstUserPromptSeen } = options;
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
