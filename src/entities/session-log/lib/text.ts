import { NEW_THREAD_TITLE, type SessionEntrySnapshot } from "../model/types";
import { deriveSessionLogStatus } from "./sessionStatus";
import { isSystemBoilerplate } from "./systemBoilerplate";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const IMAGE_TAG_PATTERN = /<\/?image>/gi;

export { deriveSessionLogStatus };

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
