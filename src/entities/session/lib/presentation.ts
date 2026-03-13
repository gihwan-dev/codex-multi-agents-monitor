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
];
const ABSOLUTE_PATH_PATTERN = /\/(?:Users|home|workspace|tmp|var|opt)\/[^\s]+/g;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripSessionTitleNoise(line: string) {
  let next = line.trim();
  if (!next) {
    return "";
  }

  next = next.replace(/^#+\s*/g, "");
  next = next.replace(/^(?:[-*]|\d+\.)\s+/g, "");
  next = next.replace(ABSOLUTE_PATH_PATTERN, " ");

  for (const pattern of SESSION_TITLE_NOISE_PATTERNS) {
    next = next.replace(pattern, " ");
  }

  next = collapseWhitespace(next);
  next = next.replace(/^(?:for|in)\b[:\s-]*/i, "").trim();

  if (/^(?:instructions?|agent policy|global defaults?)$/i.test(next)) {
    return "";
  }

  return next;
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

  const candidate =
    rawTitle
      .split(/\r?\n+/)
      .map(stripSessionTitleNoise)
      .find((line) => /[A-Za-z0-9가-힣]/.test(line)) ??
    stripSessionTitleNoise(normalizedRaw);

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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
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
