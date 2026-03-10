import { useState } from "react";

import {
  filterLiveOverviewThreads,
  getRoleOptions,
  getTopBottleneckThreads,
  getWorkspaceOptions,
} from "@/features/overview/lib/live-overview-selectors";
import type { LiveOverviewThread } from "@/shared/types/contracts";

export function useLiveOverviewFilters(threads: LiveOverviewThread[]) {
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const workspaceOptions = getWorkspaceOptions(threads);
  const roleOptions = getRoleOptions(threads);
  const filteredThreads = filterLiveOverviewThreads(threads, {
    workspace: workspaceFilter,
    role: roleFilter,
    severity: severityFilter,
  });
  const bottleneckThreads = getTopBottleneckThreads(filteredThreads);

  return {
    workspaceFilter,
    setWorkspaceFilter,
    roleFilter,
    setRoleFilter,
    severityFilter,
    setSeverityFilter,
    workspaceOptions,
    roleOptions,
    filteredThreads,
    bottleneckThreads,
  };
}
