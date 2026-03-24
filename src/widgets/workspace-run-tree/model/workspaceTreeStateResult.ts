import type { useWorkspaceTreeActions, useWorkspaceTreeModel } from "./workspaceTreeStateHelpers";

interface WorkspaceTreeIds {
  activeTreeId: string;
  expandedWorkspaceIds: string[];
  optimisticActiveRunId: string;
}

export function buildWorkspaceTreeStateResult(options: {
  treeIds: WorkspaceTreeIds;
  model: ReturnType<typeof useWorkspaceTreeModel>["model"];
  search: string;
  setSearch: ReturnType<typeof useWorkspaceTreeModel>["setSearch"];
  actions: ReturnType<typeof useWorkspaceTreeActions>;
}) {
  return {
    activeTreeId: options.treeIds.activeTreeId,
    expandedWorkspaceIds: options.treeIds.expandedWorkspaceIds,
    optimisticActiveRunId: options.treeIds.optimisticActiveRunId,
    model: options.model,
    search: options.search,
    setSearch: options.setSearch,
    ...options.actions,
  };
}
