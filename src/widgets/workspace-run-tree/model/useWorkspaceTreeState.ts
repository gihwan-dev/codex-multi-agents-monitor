import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWorkspaceTreeModel,
  type RunDataset,
  type WorkspaceIdentityOverrideMap,
} from "../../../entities/run";
import {
  areWorkspaceIdsEqual,
  buildRunTreeId,
  buildWorkspaceTreeId,
  flattenTree,
  resolveActiveTreeId,
  resolveExpandedWorkspaceIds,
  resolveTreeKeyAction,
} from "../lib/workspaceTreeUtils";

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
  const model = useMemo(
    () =>
      buildWorkspaceTreeModel(
        datasets,
        deferredSearch,
        "all",
        workspaceIdentityOverrides,
      ),
    [datasets, deferredSearch, workspaceIdentityOverrides],
  );
  const flatItems = useMemo(
    () => flattenTree(model.workspaces, expandedWorkspaceIds),
    [model.workspaces, expandedWorkspaceIds],
  );

  useEffect(() => {
    setExpandedWorkspaceIds((current) => {
      const nextExpanded = resolveExpandedWorkspaceIds(model.workspaces, current);
      return areWorkspaceIdsEqual(current, nextExpanded) ? current : nextExpanded;
    });

    setActiveTreeId((current) => {
      const nextTreeId = resolveActiveTreeId(model.workspaces, activeRunId);
      return current === nextTreeId ? current : nextTreeId;
    });
  }, [activeRunId, model.workspaces]);

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
