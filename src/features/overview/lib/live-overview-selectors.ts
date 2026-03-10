import type {
  BottleneckLevel,
  LiveOverviewThread,
} from "@/shared/types/contracts";

export type LiveOverviewFilters = {
  role: string;
  severity: string;
  workspace: string;
};

function severityRank(level: BottleneckLevel) {
  switch (level) {
    case "critical":
      return 2;
    case "warning":
      return 1;
    default:
      return 0;
  }
}

export function compareBottleneckThreads(
  left: LiveOverviewThread,
  right: LiveOverviewThread,
) {
  return (
    severityRank(right.bottleneck_level) -
      severityRank(left.bottleneck_level) ||
    (right.longest_wait_ms ?? -1) - (left.longest_wait_ms ?? -1) ||
    (right.active_tool_ms ?? -1) - (left.active_tool_ms ?? -1) ||
    new Date(right.updated_at ?? 0).getTime() -
      new Date(left.updated_at ?? 0).getTime()
  );
}

export function getWorkspaceOptions(threads: LiveOverviewThread[]) {
  return Array.from(new Set(threads.map((thread) => thread.cwd))).sort();
}

export function getRoleOptions(threads: LiveOverviewThread[]) {
  return Array.from(
    new Set(threads.flatMap((thread) => thread.agent_roles)),
  ).sort();
}

export function filterLiveOverviewThreads(
  threads: LiveOverviewThread[],
  filters: LiveOverviewFilters,
) {
  return threads.filter((thread) => {
    if (filters.workspace !== "all" && thread.cwd !== filters.workspace) {
      return false;
    }

    if (filters.role !== "all" && !thread.agent_roles.includes(filters.role)) {
      return false;
    }

    if (
      filters.severity !== "all" &&
      thread.bottleneck_level !== filters.severity
    ) {
      return false;
    }

    return true;
  });
}

export function getTopBottleneckThreads(threads: LiveOverviewThread[]) {
  return [...threads].sort(compareBottleneckThreads).slice(0, 5);
}
