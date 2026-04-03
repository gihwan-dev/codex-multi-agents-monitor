import type { useWorkspaceTreeModel } from "./workspaceTreeModelState";
import type { useWorkspaceTreeActions } from "./workspaceTreeStateHelpers";

interface WorkspaceTreeIds {
  activeTreeId: string;
  expandedWorkspaceIds: string[];
  optimisticActiveRunId: string;
}

export function buildWorkspaceTreeStateResult(options: {
  treeIds: WorkspaceTreeIds;
  model: ReturnType<typeof useWorkspaceTreeModel>["model"];
  scoreFilter: ReturnType<typeof useWorkspaceTreeModel>["scoreFilter"];
  setScoreFilter: ReturnType<typeof useWorkspaceTreeModel>["setScoreFilter"];
  scoreSort: ReturnType<typeof useWorkspaceTreeModel>["scoreSort"];
  setScoreSort: ReturnType<typeof useWorkspaceTreeModel>["setScoreSort"];
  search: string;
  setSearch: ReturnType<typeof useWorkspaceTreeModel>["setSearch"];
  actions: ReturnType<typeof useWorkspaceTreeActions>;
}) {
  return {
    activeTreeId: options.treeIds.activeTreeId,
    expandedWorkspaceIds: options.treeIds.expandedWorkspaceIds,
    optimisticActiveRunId: options.treeIds.optimisticActiveRunId,
    model: options.model,
    scoreFilter: options.scoreFilter,
    scoreSort: options.scoreSort,
    search: options.search,
    setScoreFilter: options.setScoreFilter,
    setScoreSort: options.setScoreSort,
    setSearch: options.setSearch,
    ...options.actions,
  };
}
