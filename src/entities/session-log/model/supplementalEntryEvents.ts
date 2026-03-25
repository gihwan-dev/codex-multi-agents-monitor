import type { EventRecord } from "../../run";
import { sanitizeMessagePreview } from "../lib/text";
import { createEntryEvent } from "./eventBuilderRecord";
import type { EntryContext } from "./eventBuilderTypes";

const SUPPLEMENTAL_TEXT_EVENT_CONFIG: Partial<
  Record<string, { eventType: EventRecord["eventType"]; title: string }>
> = {
  agent_message: { eventType: "note", title: "Commentary" },
  agent_reasoning: { eventType: "note", title: "Agent reasoning" },
  item_completed: { eventType: "note", title: "Plan" },
  task_complete: { eventType: "turn.finished", title: "Turn finished" },
};

export function buildSupplementalEntryEvent(
  context: EntryContext,
): EventRecord | null {
  switch (context.entry.entryType) {
    case "reasoning":
      return buildReasoningEvent(context);
    case "task_started":
      return buildTaskStartedEvent(context);
    case "context_compacted":
      return buildContextCompactedEvent(context);
    case "turn_aborted":
      return createErrorEntryEvent(context, "Turn aborted");
    case "thread_rolled_back":
      return createErrorEntryEvent(context, "Thread rolled back");
    default:
      return buildSupplementalTextEvent(context);
  }
}

function buildReasoningEvent(context: EntryContext) {
  return createEntryEvent({
    ...context,
    eventType: "llm.started",
    title: "Reasoning",
    inputPreview: null,
    outputPreview: null,
  });
}

function buildTaskStartedEvent(context: EntryContext) {
  return createEntryEvent({
    ...context,
    eventType: "turn.started",
    title: "Turn started",
    inputPreview: null,
    outputPreview: null,
  });
}

function buildContextCompactedEvent(context: EntryContext) {
  const preview = context.entry.text
    ? sanitizeMessagePreview(context.entry.text)
    : "Context reduced to fit within the model window";
  return createEntryEvent({
    ...context,
    eventType: "note",
    title: "Context compacted",
    inputPreview: null,
    outputPreview: preview,
  });
}

function buildSupplementalTextEvent(context: EntryContext) {
  const eventConfig = SUPPLEMENTAL_TEXT_EVENT_CONFIG[context.entry.entryType];
  if (!eventConfig) {
    return null;
  }

  return createEntryEvent({
    ...context,
    ...eventConfig,
    inputPreview: null,
    outputPreview: context.entry.text
      ? sanitizeMessagePreview(context.entry.text)
      : null,
  });
}

function createErrorEntryEvent(
  context: EntryContext,
  fallbackReason: string,
) {
  const reason = context.entry.text ?? fallbackReason;
  return createEntryEvent({
    ...context,
    eventType: "error",
    title: fallbackReason,
    inputPreview: null,
    outputPreview: reason,
    errorMessage: reason,
  });
}
