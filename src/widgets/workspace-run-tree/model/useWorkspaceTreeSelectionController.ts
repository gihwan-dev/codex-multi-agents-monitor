import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceTreeModel } from "../../../entities/run";
import type { flattenTree } from "../lib/workspaceTreeUtils";
import { useWorkspaceTreeSelectionState } from "./useWorkspaceTreeSelectionState";
import { useWorkspaceTreeActions } from "./workspaceTreeStateHelpers";

interface UseWorkspaceTreeSelectionControllerOptions {
  activeRunId: string;
  activeTreeId: string;
  expandedWorkspaceIds: string[];
  flatItems: ReturnType<typeof flattenTree>;
  model: WorkspaceTreeModel;
  onSelectRecentRun: (filePath: string) => void;
  onSelectRun: (traceId: string) => void;
  setActiveTreeId: Dispatch<SetStateAction<string>>;
  setExpandedWorkspaceIds: Dispatch<SetStateAction<string[]>>;
  setOptimisticActiveRunId: Dispatch<SetStateAction<string>>;
}

export function useWorkspaceTreeSelectionController(
  options: UseWorkspaceTreeSelectionControllerOptions,
) {
  const {
    activeRunId,
    activeTreeId,
    expandedWorkspaceIds,
    flatItems,
    model,
    onSelectRecentRun,
    onSelectRun,
    setActiveTreeId,
    setExpandedWorkspaceIds,
    setOptimisticActiveRunId,
  } = options;
  const actions = useWorkspaceTreeActions({
    activeRunId,
    activeTreeId,
    expandedWorkspaceIds,
    flatItems,
    model,
    onSelectRecentRun,
    onSelectRun,
    setActiveTreeId,
    setExpandedWorkspaceIds,
    setOptimisticActiveRunId,
  });

  useWorkspaceTreeSelectionState({
    activeRunId,
    model,
    setActiveTreeId,
    setExpandedWorkspaceIds,
    setOptimisticActiveRunId,
  });

  return actions;
}
