import type {
  BottleneckLevel,
  SessionListItem,
} from "@/shared/types/contracts";

export const severityPillClassMap: Record<BottleneckLevel, string> = {
  normal:
    "border-[hsl(var(--line))] bg-[hsl(var(--panel)/0.82)] text-[hsl(var(--muted))]",
  warning:
    "border-[hsl(var(--warn)/0.45)] bg-[hsl(var(--warn)/0.12)] text-[hsl(var(--warn))]",
  critical: "border-rose-500/45 bg-rose-500/12 text-rose-200",
};

export function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${totalSeconds}s`;
  }

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function renderPrimaryBottleneck(thread: SessionListItem) {
  if (thread.longest_wait_ms !== null) {
    return `wait ${formatDuration(thread.longest_wait_ms)}`;
  }

  if (thread.active_tool_name && thread.active_tool_ms !== null) {
    return `tool ${thread.active_tool_name} ${formatDuration(thread.active_tool_ms)}`;
  }

  return "active wait/tool 없음";
}
