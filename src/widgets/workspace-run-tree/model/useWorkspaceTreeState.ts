import { useMemo, useState } from "react";
import type { RunDataset } from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { flattenTree } from "../lib/workspaceTreeUtils";
import {
  useWorkspaceTreeActions,
  useWorkspaceTreeModel,
  useWorkspaceTreeSelectionSync,
} from "./workspaceTreeStateHelpers";

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

export function useWorkspaceTreeState({
  datasets,
  recentIndex,
  recentIndexReady,
  activeRunId,
  onSelectRun,
  onSelectRecentRun,
  workspaceIdentityOverrides,
}: UseWorkspaceTreeStateArgs) {
  const treeIds = useWorkspaceTreeIds(activeRunId);
  const { search, setSearch, model } = useWorkspaceTreeModel({ datasets, recentIndex, recentIndexReady, workspaceIdentityOverrides });
  const flatItems = useMemo(() => flattenTree(model.workspaces, treeIds.expandedWorkspaceIds), [model.workspaces, treeIds.expandedWorkspaceIds]);
  const actions = useWorkspaceTreeActions({
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
  useWorkspaceTreeSelectionSync({
    activeRunId,
    model,
    setActiveTreeId: treeIds.setActiveTreeId,
    setExpandedWorkspaceIds: treeIds.setExpandedWorkspaceIds,
    setOptimisticActiveRunId: treeIds.setOptimisticActiveRunId,
  });
  return {
    activeTreeId: treeIds.activeTreeId,
    expandedWorkspaceIds: treeIds.expandedWorkspaceIds,
    optimisticActiveRunId: treeIds.optimisticActiveRunId,
    model,
    search,
    setSearch,
    ...actions,
  };
}
