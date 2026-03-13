import type { SessionSummary } from "@/shared/queries";

type SessionBadgeVariant = "default" | "secondary" | "destructive" | "outline";
type SessionTitleDisplayInput = {
  rawTitle: string | null | undefined;
  workspacePath: string;
};

export interface SessionTitleDisplay {
  displayTitle: string;
  rawTitle: string | null;
  tooltip: string;
  workspaceLabel: string;
}

const SESSION_TITLE_NOISE_PATTERNS = [
  /AGENTS\.md instructions for/gi,
  /Global Agent Policy/gi,
  /This file defines global defaults(?: for [^.]+)?/gi,
  /<INSTRUCTIONS>/gi,
  /<environment_context>/gi,
  /PLEASE IMPLEMENT THIS PLAN/gi,
];
const ABSOLUTE_PATH_PATTERN = /\/(?:Users|home|workspace|tmp|var|opt)\/[^\s]+/g;
const SESSION_TITLE_BLOCK_TAGS = new Set([
  "instructions",
  "environment_context",
  "skill",
]);
const SESSION_TITLE_DISCARDED_LINES = [
  /^(?:instructions?|global agent policy|environment context)$/i,
  /^(?:summary|key changes|test plan|assumptions)$/i,
  /^(?:workflow|hard rules|required references|required bundle content)$/i,
  /^(?:how to use skills|available skills|core goal)$/i,
  /^(?:codex across all repositories)$/i,
  /^(?:please implement this plan\.?)$/i,
  /^this file defines global defaults(?: for codex)?(?: across all repositories)?\.?$/i,
];
const SKILL_MARKER_ONLY_PATTERN = /^\$[A-Za-z0-9._/-]+$/;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripRefreshMarker(value: string) {
  const separatorIndex = value.lastIndexOf("#");
  if (separatorIndex < 0) {
    return value;
  }

  const revision = value.slice(separatorIndex + 1);
  if (!/^\d+$/.test(revision)) {
    return value;
  }

  return value.slice(0, separatorIndex);
}

function stripLeadingPromptMarkers(value: string) {
  let next = value.trim();

  while (next) {
    const stripped = next
      .replace(/^#+\s*/g, "")
      .replace(/^>\s*/g, "")
      .replace(/^(?:[-*]|\d+\.)\s+/g, "")
      .replace(/^(?:[.:;,-]+)\s*/g, "")
      .trim();

    if (stripped === next) {
      return stripped;
    }

    next = stripped;
  }

  return next;
}

function stripSessionTitleNoise(line: string) {
  let next = line.trim();
  if (!next) {
    return "";
  }

  next = next.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  next = next.replace(/^\[\$([^\]]+)\]\s*/g, "$$$1 ");
  next = stripLeadingPromptMarkers(next);
  next = next.replace(ABSOLUTE_PATH_PATTERN, " ");
  next = next.replace(/<\/?[a-z_:-]+>/gi, " ");

  for (const pattern of SESSION_TITLE_NOISE_PATTERNS) {
    next = next.replace(pattern, " ");
  }

  next = collapseWhitespace(next);
  next = stripLeadingPromptMarkers(next);
  next = next.replace(/^(?:for|in)\b[:\s-]*/i, "").trim();

  if (/^(?:instructions?|agent policy|global defaults?)$/i.test(next)) {
    return "";
  }

  return next;
}

function isSubstantiveSessionTitleLine(line: string) {
  if (!line || !/[A-Za-z0-9가-힣$]/.test(line)) {
    return false;
  }

  if (/^<\/?[a-z_:-]+>$/i.test(line)) {
    return false;
  }

  return !SESSION_TITLE_DISCARDED_LINES.some((pattern) => pattern.test(line));
}

function isSkillMarkerOnlyLine(line: string) {
  return SKILL_MARKER_ONLY_PATTERN.test(line);
}

function findSubstantiveSessionTitle(rawTitle: string) {
  const lines = rawTitle.split(/\r?\n+/);
  let pendingPrefix: string | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    if (
      /^<\/?[a-z_:-]+>$/i.test(trimmed) &&
      SESSION_TITLE_BLOCK_TAGS.has(trimmed.replace(/[</>]/g, "").toLowerCase())
    ) {
      continue;
    }

    const candidate = stripSessionTitleNoise(trimmed);
    if (isSkillMarkerOnlyLine(candidate)) {
      pendingPrefix = candidate;
      continue;
    }
    if (isSubstantiveSessionTitleLine(candidate)) {
      return pendingPrefix && !candidate.startsWith(`${pendingPrefix} `)
        ? `${pendingPrefix} ${candidate}`
        : candidate;
    }
  }

  const fallback = stripSessionTitleNoise(collapseWhitespace(rawTitle));
  if (isSkillMarkerOnlyLine(fallback)) {
    return null;
  }

  return isSubstantiveSessionTitleLine(fallback) ? fallback : null;
}

function clipSessionTitle(value: string, maxLength = 88) {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength);
  const lastBoundary = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf(": "),
    slice.lastIndexOf("; "),
    slice.lastIndexOf(", "),
    slice.lastIndexOf(" "),
  );
  const cutIndex = lastBoundary > 24 ? lastBoundary : maxLength;

  return `${slice.slice(0, cutIndex).trim()}…`;
}

function extractSessionTitleSnippet(candidate: string) {
  const next = collapseWhitespace(candidate);
  if (!next) {
    return null;
  }

  const sentenceBoundary = next.search(/[.!?]\s/);
  if (sentenceBoundary >= 8 && sentenceBoundary <= 72) {
    return next.slice(0, sentenceBoundary + 1).trim();
  }

  return clipSessionTitle(next);
}

export function formatWorkspaceLabel(workspacePath: string) {
  const segments = workspacePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? workspacePath;
}

export function normalizeSessionTitle(rawTitle: string | null | undefined) {
  if (typeof rawTitle !== "string") {
    return null;
  }

  const normalizedRaw = collapseWhitespace(rawTitle);
  if (!normalizedRaw) {
    return null;
  }

  const candidate = findSubstantiveSessionTitle(rawTitle);

  if (!candidate) {
    return null;
  }

  return extractSessionTitleSnippet(candidate);
}

export function formatSessionDisplayTitle({
  rawTitle,
  workspacePath,
}: SessionTitleDisplayInput): SessionTitleDisplay {
  const workspaceLabel = formatWorkspaceLabel(workspacePath);
  const normalizedRaw =
    typeof rawTitle === "string" ? collapseWhitespace(rawTitle) : null;
  const displayTitle =
    normalizeSessionTitle(rawTitle) ??
    (workspaceLabel ? `${workspaceLabel} session` : "Untitled session");

  return {
    displayTitle,
    rawTitle: normalizedRaw,
    tooltip: normalizedRaw ?? displayTitle,
    workspaceLabel,
  };
}

export function formatTimestamp(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const displayValue = stripRefreshMarker(value);
  const date = new Date(displayValue);
  if (Number.isNaN(date.getTime())) {
    return displayValue;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(value: string | null) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function statusBadgeVariant(
  status: SessionSummary["status"],
): SessionBadgeVariant {
  switch (status) {
    case "live":
      return "default";
    case "stalled":
    case "aborted":
      return "destructive";
    case "completed":
    case "archived":
      return "secondary";
    default:
      return "outline";
  }
}
