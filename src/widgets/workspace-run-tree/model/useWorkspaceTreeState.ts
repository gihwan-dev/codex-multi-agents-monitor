import { useMemo, useState } from "react";
import type { RunDataset } from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { flattenTree } from "../lib/workspaceTreeUtils";
import { useWorkspaceTreeSelectionController } from "./useWorkspaceTreeSelectionController";
import {
  useWorkspaceTreeModel,
} from "./workspaceTreeStateHelpers";
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
  return useWorkspaceTreeStateFromOptions(options);
}

function useWorkspaceTreeStateFromOptions(options: UseWorkspaceTreeStateArgs) {
  const {
    datasets,
    recentIndex,
    recentIndexReady,
    activeRunId,
    onSelectRun,
    onSelectRecentRun,
    workspaceIdentityOverrides,
  } = options;
  const treeIds = useWorkspaceTreeIds(activeRunId);
  const { search, setSearch, model } = useWorkspaceTreeModelState({
    datasets,
    recentIndex,
    recentIndexReady,
    workspaceIdentityOverrides,
  });
  const flatItems = useWorkspaceFlatItems(model.workspaces, treeIds.expandedWorkspaceIds);
  const actions = useWorkspaceTreeSelectionController({
    activeRunId,
    activeTreeId: treeIds.activeTreeId,
    expandedWorkspaceIds: treeIds.expandedWorkspaceIds,
    flatItems,
    model,
    onSelectRecentRun,
    onSelectRun,
    setActiveTreeId: treeIds.setActiveTreeId,
    setExpandedWorkspaceIds: treeIds.setExpandedWorkspaceIds,
    setOptimisticActiveRunId: treeIds.setOptimisticActiveRunId,
  });
  return buildWorkspaceTreeStateResult({
    treeIds,
    model,
    search,
    setSearch,
    actions,
  });
}

function useWorkspaceTreeModelState(options: {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}) {
  return useWorkspaceTreeModel(options);
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
