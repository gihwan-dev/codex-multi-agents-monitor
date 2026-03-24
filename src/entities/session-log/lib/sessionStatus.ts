import type { RunStatus } from "../../run";
import type { SessionEntrySnapshot } from "../model/types";
import { parseRequiredTimestamp } from "./helpers";
import { isSystemBoilerplate } from "./systemBoilerplate";

interface SessionStatusSignals {
  entries: SessionEntrySnapshot[];
  latestMessage: SessionEntrySnapshot | undefined;
  hasAbort: boolean;
  hasOpenTask: boolean;
}

function isInterruptedEntry(entry: SessionEntrySnapshot) {
  return (
    entry.entryType === "turn_aborted" ||
    entry.entryType === "thread_rolled_back"
  );
}

export function deriveSessionLogStatus(
  entries: SessionEntrySnapshot[],
  skipImplementPlan = false,
): RunStatus {
  const latestMessage = findLatestMeaningfulMessage(entries, skipImplementPlan);
  if (latestMessage?.text?.includes("<turn_aborted>")) {
    return "interrupted";
  }

  return resolveEntryDrivenStatus({
    entries,
    latestMessage,
    hasAbort: hasInterruptedEntry(entries),
    hasOpenTask: hasOpenTaskWindow(entries),
  });
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
  return [...entries].reverse().find((entry) =>
    isMeaningfulStatusMessage(entry, skipImplementPlan),
  );
}

function isMeaningfulStatusMessage(
  entry: SessionEntrySnapshot,
  skipImplementPlan: boolean,
) {
  if (entry.entryType !== "message" || entry.text == null) {
    return false;
  }

  const trimmed = entry.text.trim();
  return (
    trimmed.startsWith("<turn_aborted>") ||
    !isSystemBoilerplate(trimmed, skipImplementPlan)
  );
}

function hasInterruptedEntry(entries: SessionEntrySnapshot[]) {
  return entries.some(isInterruptedEntry);
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

function resolveStatusWithoutLatestMessage(
  options: Pick<SessionStatusSignals, "hasAbort" | "hasOpenTask">,
): RunStatus {
  if (options.hasOpenTask) {
    return "running";
  }

  return options.hasAbort ? "interrupted" : "done";
}

function isInterruptedAfterLatestMessage(options: SessionStatusSignals) {
  if (!options.latestMessage || !options.hasAbort) {
    return false;
  }

  const lastAbortEntry = [...options.entries].reverse().find(isInterruptedEntry);
  if (!lastAbortEntry) {
    return false;
  }

  const abortTs = parseRequiredTimestamp(lastAbortEntry.timestamp);
  const msgTs = parseRequiredTimestamp(options.latestMessage.timestamp);
  return abortTs !== null && msgTs !== null && abortTs >= msgTs;
}

function resolveLatestMessageStatus(options: SessionStatusSignals): RunStatus {
  if (isInterruptedAfterLatestMessage(options)) {
    return "interrupted";
  }

  if (options.hasOpenTask) {
    return "running";
  }

  return resolveMessageDrivenStatus(options);
}

function resolveMessageDrivenStatus(
  options: Pick<SessionStatusSignals, "entries" | "latestMessage">,
): RunStatus {
  if (!options.latestMessage || options.latestMessage.role !== "user") {
    return "done";
  }

  const msgTs = parseRequiredTimestamp(options.latestMessage.timestamp);
  if (msgTs === null) {
    return "running";
  }

  return hasTaskCompletionAfter(options.entries, msgTs) ? "done" : "running";
}

function resolveEntryDrivenStatus(options: SessionStatusSignals): RunStatus {
  return options.latestMessage
    ? resolveLatestMessageStatus(options)
    : resolveStatusWithoutLatestMessage(options);
}

function hasTaskCompletionAfter(
  entries: SessionEntrySnapshot[],
  msgTs: number,
) {
  return entries.some((entry) => {
    if (entry.entryType !== "task_complete") {
      return false;
    }

    const entryTs = parseRequiredTimestamp(entry.timestamp);
    return entryTs !== null && entryTs >= msgTs;
  });
}
