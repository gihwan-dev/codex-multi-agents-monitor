import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWorkspaceTreeModel,
  type RunDataset,
  type WorkspaceIdentityOverrideMap,
} from "../../shared/domain";
import {
  areWorkspaceIdsEqual,
  buildRunTreeId,
  buildWorkspaceTreeId,
  flattenTree,
  resolveActiveTreeId,
  resolveExpandedWorkspaceIds,
  resolveTreeKeyAction,
} from "./workspaceTreeUtils";

interface UseWorkspaceTreeStateArgs {
  datasets: RunDataset[];
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}

export function useWorkspaceTreeState({
  datasets,
  activeRunId,
  onSelectRun,
  workspaceIdentityOverrides,
}: UseWorkspaceTreeStateArgs) {
  const [search, setSearch] = useState("");
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [activeTreeId, setActiveTreeId] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(search);
  const model = buildWorkspaceTreeModel(
    datasets,
    deferredSearch,
    "all",
    workspaceIdentityOverrides,
  );
  const flatItems = useMemo(
    () => flattenTree(model.workspaces, expandedWorkspaceIds),
    [model.workspaces, expandedWorkspaceIds],
  );

  useEffect(() => {
    const nextExpanded = resolveExpandedWorkspaceIds(
      model.workspaces,
      expandedWorkspaceIds,
    );
    if (!areWorkspaceIdsEqual(expandedWorkspaceIds, nextExpanded)) {
      setExpandedWorkspaceIds(nextExpanded);
    }

    const nextTreeId = resolveActiveTreeId(model.workspaces, activeRunId);
    if (activeTreeId !== nextTreeId) {
      setActiveTreeId(nextTreeId);
    }
  }, [activeRunId, activeTreeId, expandedWorkspaceIds, model.workspaces]);

  const focusTreeItem = (itemId: string) => {
    const target = treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${itemId}"]`);
    target?.focus();
  };

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = resolveTreeKeyAction({
      key: event.key,
      flatItems,
      activeTreeId,
      activeRunId,
      workspaces: model.workspaces,
      expandedWorkspaceIds,
    });
    if (!action.handled) {
      return;
    }

    event.preventDefault();

    if (action.expandedWorkspaceIds) {
      setExpandedWorkspaceIds(action.expandedWorkspaceIds);
    }
    if (action.activeTreeId) {
      setActiveTreeId(action.activeTreeId);
    }
    if (action.selectRunId) {
      onSelectRun(action.selectRunId);
    }
    if (action.focusTreeId) {
      const focusTreeId = action.focusTreeId;
      window.requestAnimationFrame(() => {
        focusTreeItem(focusTreeId);
      });
    }
  };

  const toggleWorkspace = (workspaceId: string) => {
    setActiveTreeId(buildWorkspaceTreeId(workspaceId));
    setExpandedWorkspaceIds((items) =>
      items.includes(workspaceId)
        ? items.filter((itemId) => itemId !== workspaceId)
        : [...items, workspaceId],
    );
  };

  const selectRun = (workspaceId: string, runId: string) => {
    setActiveTreeId(buildRunTreeId(workspaceId, runId));
    onSelectRun(runId);
  };

  return {
    activeTreeId,
    expandedWorkspaceIds,
    handleTreeKeyDown,
    model,
    search,
    selectRun,
    setSearch,
    toggleWorkspace,
    treeRef,
  };
}
