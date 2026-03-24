import type { RunStatus } from "../../run";
import type { SessionEntrySnapshot } from "../model/types";
import { parseRequiredTimestamp } from "./helpers";
import {
  findLatestMeaningfulMessage,
  isInterruptedEntry,
  resolveLatestMessageStatus,
  type SessionStatusSignals,
} from "./sessionStatusSignals";

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

function resolveEntryDrivenStatus(options: SessionStatusSignals): RunStatus {
  return options.latestMessage
    ? resolveLatestMessageStatus(options)
    : resolveStatusWithoutLatestMessage(options);
}
