import { createEntryEvent } from "./eventBuilderRecord";
import type { MessageEventArgs } from "./eventBuilderTypes";

interface CreateMessageEventRecordOptions {
  lane?: MessageEventArgs["context"]["lane"];
  title: string;
  eventType: "note" | "user.prompt";
  inputPreview: string | null;
  outputPreview: string | null;
}

export function createMessageEventRecord(
  context: MessageEventArgs["context"],
  options: CreateMessageEventRecordOptions,
) {
  const {
    lane = context.lane,
    title,
    eventType,
    inputPreview,
    outputPreview,
  } = options;

  return createEntryEvent({ ...context, lane, title, eventType, inputPreview, outputPreview });
}

export function resolveStandardMessageEventOptions(options: {
  context: MessageEventArgs["context"];
  userLane: MessageEventArgs["userLane"];
  displayTitle: string;
  preview: string;
  firstUserPromptSeen: boolean;
}): {
  lane: MessageEventArgs["context"]["lane"];
  title: string;
  eventType: "note" | "user.prompt";
  inputPreview: string | null;
  outputPreview: string | null;
  firstUserPromptSeen: boolean;
} {
  const { context, userLane, displayTitle, preview, firstUserPromptSeen } = options;
  const isUser = context.entry.role === "user";
  return {
    lane: isUser && userLane ? userLane : context.lane,
    title: isUser ? "User prompt" : "Assistant",
    eventType: isUser ? "user.prompt" : "note",
    inputPreview: resolveUserInputPreview({
      isUser,
      firstUserPromptSeen,
      preview,
      displayTitle,
    }),
    outputPreview: isUser ? null : preview,
    firstUserPromptSeen: isUser || firstUserPromptSeen,
  };
}

function resolveUserInputPreview(options: {
  isUser: boolean;
  firstUserPromptSeen: boolean;
  preview: string;
  displayTitle: string;
}) {
  const { isUser, firstUserPromptSeen, preview, displayTitle } = options;
  if (!isUser) {
    return null;
  }

  return firstUserPromptSeen ? preview : displayTitle;
}
