import { createEntryEvent } from "./eventBuilderRecord";
import type { MessageEventArgs } from "./eventBuilderTypes";

export function createMessageEventRecord(
  context: MessageEventArgs["context"],
  {
    lane = context.lane,
    title,
    eventType,
    inputPreview,
    outputPreview,
  }: {
    lane?: MessageEventArgs["context"]["lane"];
    title: string;
    eventType: "note" | "user.prompt";
    inputPreview: string | null;
    outputPreview: string | null;
  },
) {
  return createEntryEvent({
    ...context,
    lane,
    title,
    eventType,
    inputPreview,
    outputPreview,
  });
}

export function resolveStandardMessageEventOptions({
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
}): {
  lane: MessageEventArgs["context"]["lane"];
  title: string;
  eventType: "note" | "user.prompt";
  inputPreview: string | null;
  outputPreview: string | null;
  firstUserPromptSeen: boolean;
} {
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

function resolveUserInputPreview({
  isUser,
  firstUserPromptSeen,
  preview,
  displayTitle,
}: {
  isUser: boolean;
  firstUserPromptSeen: boolean;
  preview: string;
  displayTitle: string;
}) {
  if (!isUser) {
    return null;
  }

  return firstUserPromptSeen ? preview : displayTitle;
}
