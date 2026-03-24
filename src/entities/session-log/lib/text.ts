import type { RunStatus } from "../../run";
import { NEW_THREAD_TITLE, type SessionEntrySnapshot } from "../model/types";
import { parseRequiredTimestamp } from "./helpers";
import { isSystemBoilerplate } from "./systemBoilerplate";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const IMAGE_TAG_PATTERN = /<\/?image>/gi;

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
  if (sanitizedTitle.length === 0) {
    return NEW_THREAD_TITLE;
  }

  return sanitizedTitle.length > 120
    ? `${sanitizedTitle.slice(0, 117)}...`
    : sanitizedTitle;
}

export function deriveSessionLogStatus(
  entries: SessionEntrySnapshot[],
  skipImplementPlan = false,
): RunStatus {
  const latestMessage = findLatestMeaningfulMessage(entries, skipImplementPlan);
  if (latestMessage?.text?.includes("<turn_aborted>")) {
    return "interrupted";
  }

  return resolveEntryDrivenStatus(entries, latestMessage);
}

function findLatestEntryTimestamp(
  entries: SessionEntrySnapshot[],
  predicate: (entry: SessionEntrySnapshot) => boolean,
) {
  const latestEntry = [...entries].reverse().find(predicate);
  return latestEntry ? parseRequiredTimestamp(latestEntry.timestamp) : null;
}

function findLatestMeaningfulMessage(
  entries: SessionEntrySnapshot[],
  skipImplementPlan: boolean,
) {
  return [...entries].reverse().find((entry) => isMeaningfulStatusMessage(entry, skipImplementPlan));
}

function isMeaningfulStatusMessage(
  entry: SessionEntrySnapshot,
  skipImplementPlan: boolean,
) {
  if (entry.entryType !== "message" || entry.text == null) {
    return false;
  }

  const trimmed = entry.text.trim();
  return trimmed.startsWith("<turn_aborted>") || !isSystemBoilerplate(trimmed, skipImplementPlan);
}

function hasInterruptedEntry(entries: SessionEntrySnapshot[]) {
  return entries.some(
    (entry) =>
      entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back",
  );
}

function hasOpenTaskWindow(entries: SessionEntrySnapshot[]) {
  const latestTaskStartedTs = findLatestEntryTimestamp(
    entries,
    (entry) => entry.entryType === "task_started",
  );
  const latestTaskCompleteTs = findLatestEntryTimestamp(
    entries,
    (entry) => entry.entryType === "task_complete",
  );

  return (
    latestTaskStartedTs !== null &&
    (latestTaskCompleteTs === null || latestTaskStartedTs > latestTaskCompleteTs)
  );
}

function resolveEntryDrivenStatus(
  entries: SessionEntrySnapshot[],
  latestMessage: SessionEntrySnapshot | undefined,
): RunStatus {
  const hasAbort = hasInterruptedEntry(entries);
  const hasOpenTask = hasOpenTaskWindow(entries);
  return latestMessage
    ? resolveLatestMessageStatus(entries, latestMessage, hasAbort, hasOpenTask)
    : resolveStatusWithoutLatestMessage(hasAbort, hasOpenTask);
}

function resolveStatusWithoutLatestMessage(
  hasAbort: boolean,
  hasOpenTask: boolean,
): RunStatus {
  if (hasOpenTask) {
    return "running";
  }

  return hasAbort ? "interrupted" : "done";
}

function isInterruptedAfterLatestMessage(
  entries: SessionEntrySnapshot[],
  latestMessage: SessionEntrySnapshot,
  hasAbort: boolean,
) {
  if (!hasAbort) {
    return false;
  }

  const lastAbortEntry = [...entries].reverse().find(
    (entry) =>
      entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back",
  );
  if (!lastAbortEntry) {
    return false;
  }

  const abortTs = parseRequiredTimestamp(lastAbortEntry.timestamp);
  const msgTs = parseRequiredTimestamp(latestMessage.timestamp);
  return abortTs !== null && msgTs !== null && abortTs >= msgTs;
}

function resolveLatestMessageStatus(
  entries: SessionEntrySnapshot[],
  latestMessage: SessionEntrySnapshot,
  hasAbort: boolean,
  hasOpenTask: boolean,
): RunStatus {
  const interrupted = isInterruptedAfterLatestMessage(entries, latestMessage, hasAbort);
  if (interrupted) {
    return "interrupted";
  }

  return resolveLatestMessageOpenTaskStatus(entries, latestMessage, hasOpenTask);
}

function resolveLatestMessageOpenTaskStatus(
  entries: SessionEntrySnapshot[],
  latestMessage: SessionEntrySnapshot,
  hasOpenTask: boolean,
): RunStatus {
  return hasOpenTask ? "running" : resolveMessageDrivenStatus(entries, latestMessage);
}

function resolveMessageDrivenStatus(
  entries: SessionEntrySnapshot[],
  latestMessage: SessionEntrySnapshot,
): RunStatus {
  if (latestMessage.role !== "user") {
    return "done";
  }

  const msgTs = parseRequiredTimestamp(latestMessage.timestamp);
  if (msgTs === null) {
    return "running";
  }

  return hasTaskCompletionAfter(entries, msgTs) ? "done" : "running";
}

function hasTaskCompletionAfter(entries: SessionEntrySnapshot[], msgTs: number) {
  return entries.some((entry) => {
    if (entry.entryType !== "task_complete") {
      return false;
    }

    const entryTs = parseRequiredTimestamp(entry.timestamp);
    return entryTs !== null && entryTs >= msgTs;
  });
}

export function sanitizeMessagePreview(value: string) {
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

export function deriveArchiveIndexTitle(
  firstUserMessage: string | null,
): string | null {
  if (!firstUserMessage) {
    return null;
  }

  const sanitized = sanitizeSessionText(firstUserMessage);
  if (sanitized.length === 0) {
    return null;
  }

  return sanitized.length > 120 ? `${sanitized.slice(0, 117)}...` : sanitized;
}

function isMeaningfulTitleMessage(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && !isSystemBoilerplate(trimmed);
}
