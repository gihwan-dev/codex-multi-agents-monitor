import { useMemo, useState } from "react";
import type { RunDataset } from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { flattenTree } from "../lib/workspaceTreeUtils";
import { useWorkspaceTreeSelectionController } from "./useWorkspaceTreeSelectionController";
import { useWorkspaceTreeModel } from "./workspaceTreeModelState";
import { buildWorkspaceTreeStateResult } from "./workspaceTreeStateResult";

interface UseWorkspaceTreeStateArgs {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  onSelectRecentRun: (filePath: string) => void;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}

function useWorkspaceTreeIds(activeRunId: string) {
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [activeTreeId, setActiveTreeId] = useState("");
  const [optimisticActiveRunId, setOptimisticActiveRunId] = useState(activeRunId);

  return {
    activeTreeId,
    expandedWorkspaceIds,
    optimisticActiveRunId,
    setActiveTreeId,
    setExpandedWorkspaceIds,
    setOptimisticActiveRunId,
  };
}

export function useWorkspaceTreeState(options: UseWorkspaceTreeStateArgs) {
  const treeIds = useWorkspaceTreeIds(options.activeRunId);
  const state = useWorkspaceTreeViewState(options, treeIds);

  return buildWorkspaceTreeStateResult({
    treeIds,
    model: state.model,
    scoreFilter: state.scoreFilter,
    scoreSort: state.scoreSort,
    search: state.search,
    setScoreFilter: state.setScoreFilter,
    setScoreSort: state.setScoreSort,
    setSearch: state.setSearch,
    actions: state.actions,
  });
}

function useWorkspaceTreeViewState(
  options: UseWorkspaceTreeStateArgs,
  treeIds: ReturnType<typeof useWorkspaceTreeIds>,
) {
  const modelState = useWorkspaceTreeModelState(options);
  const flatItems = useWorkspaceFlatItems(
    modelState.model.workspaces,
    treeIds.expandedWorkspaceIds,
  );
  const actions = useWorkspaceTreeSelectionController({
    activeRunId: options.activeRunId,
    activeTreeId: treeIds.activeTreeId,
    expandedWorkspaceIds: treeIds.expandedWorkspaceIds,
    flatItems,
    model: modelState.model,
    onSelectRecentRun: options.onSelectRecentRun,
    onSelectRun: options.onSelectRun,
    setActiveTreeId: treeIds.setActiveTreeId,
    setExpandedWorkspaceIds: treeIds.setExpandedWorkspaceIds,
    setOptimisticActiveRunId: treeIds.setOptimisticActiveRunId,
  });

  return {
    ...modelState,
    actions,
  };
}

function useWorkspaceTreeModelState(options: {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}) {
  return useWorkspaceTreeModel({
    datasets: options.datasets,
    recentIndex: options.recentIndex,
    recentIndexReady: options.recentIndexReady,
    workspaceIdentityOverrides: options.workspaceIdentityOverrides,
  });
}

function useWorkspaceFlatItems(
  workspaces: ReturnType<typeof useWorkspaceTreeModel>["model"]["workspaces"],
  expandedWorkspaceIds: string[],
) {
  return useMemo(
    () => flattenTree(workspaces, expandedWorkspaceIds),
    [workspaces, expandedWorkspaceIds],
  );
}
