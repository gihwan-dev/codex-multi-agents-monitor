import type { RunStatus } from "../../shared/domain";
import { parseRequiredTimestamp } from "./helpers";
import { NEW_THREAD_TITLE, type SessionEntrySnapshot } from "./types";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const IMAGE_TAG_PATTERN = /<\/?image>/gi;
const IMPLEMENT_PLAN_PATTERN = /^PLEASE IMPLEMENT THIS PLAN:/i;

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
  const hasAbort = entries.some(
    (entry) =>
      entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back",
  );

  const messageEntries = entries.filter(
    (entry) => entry.entryType === "message" && entry.text != null,
  );

  const latestMessage = [...messageEntries].reverse().find((entry) => {
    const trimmed = entry.text?.trim() ?? "";
    return (
      trimmed.startsWith("<turn_aborted>") ||
      !isSystemBoilerplate(trimmed, skipImplementPlan)
    );
  });

  if (!latestMessage) {
    return hasAbort ? "interrupted" : "done";
  }

  if (latestMessage.text?.includes("<turn_aborted>")) {
    return "interrupted";
  }

  if (hasAbort) {
    const lastAbortEntry = [...entries].reverse().find(
      (entry) =>
        entry.entryType === "turn_aborted" || entry.entryType === "thread_rolled_back",
    );
    if (lastAbortEntry) {
      const abortTs = parseRequiredTimestamp(lastAbortEntry.timestamp);
      const msgTs = parseRequiredTimestamp(latestMessage.timestamp);
      if (abortTs !== null && msgTs !== null && abortTs >= msgTs) {
        return "interrupted";
      }
    }
  }

  if (latestMessage.role === "user") {
    const msgTs = parseRequiredTimestamp(latestMessage.timestamp);
    if (msgTs === null) {
      return "running";
    }

    const hasCompletionAfter = entries.some((entry) => {
      if (entry.entryType !== "task_complete") {
        return false;
      }

      const entryTs = parseRequiredTimestamp(entry.timestamp);
      return entryTs !== null && entryTs >= msgTs;
    });

    return hasCompletionAfter ? "done" : "running";
  }

  return "done";
}

export function isSystemBoilerplate(
  value: string,
  skipImplementPlan = false,
): boolean {
  const trimmed = value.trim();
  return (
    isAgentsInstruction(trimmed) ||
    isAutomationEnvelope(trimmed) ||
    trimmed.startsWith("<skill>") ||
    trimmed.startsWith("<subagent_notification>") ||
    trimmed.startsWith("<permissions") ||
    trimmed.startsWith("<turn_aborted>") ||
    (!skipImplementPlan && isImplementPlanMessage(trimmed))
  );
}

export function isImplementPlanMessage(value: string) {
  return IMPLEMENT_PLAN_PATTERN.test(value.trim());
}

export function sanitizeMessagePreview(value: string) {
  const normalized = sanitizeSessionText(value);
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
}

export function sanitizeSessionText(value: string) {
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

function isAgentsInstruction(value: string) {
  return /^#\s*AGENTS\.md instructions\b/i.test(value.trim());
}

function isAutomationEnvelope(value: string) {
  return /^Automation:/i.test(value.trim());
}
