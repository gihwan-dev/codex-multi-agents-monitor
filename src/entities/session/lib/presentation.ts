import type { SessionSummary } from "@/shared/queries";

type SessionBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function formatWorkspaceLabel(workspacePath: string) {
  const segments = workspacePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? workspacePath;
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
