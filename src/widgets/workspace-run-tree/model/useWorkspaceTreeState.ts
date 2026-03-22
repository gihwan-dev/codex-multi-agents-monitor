import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { RunDataset } from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { buildSidebarTreeModel } from "../lib/sidebarTreeModel";
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
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  onSelectRecentRun: (filePath: string) => void;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
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
  const [search, setSearch] = useState("");
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [activeTreeId, setActiveTreeId] = useState("");
  const [optimisticActiveRunId, setOptimisticActiveRunId] = useState(activeRunId);
  const treeRef = useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(search);
  const model = useMemo(
    () =>
      buildSidebarTreeModel({
        datasets,
        recentIndex,
        recentIndexReady,
        search: deferredSearch,
        workspaceIdentityOverrides,
      }),
    [
      datasets,
      recentIndex,
      recentIndexReady,
      deferredSearch,
      workspaceIdentityOverrides,
    ],
  );
  const flatItems = useMemo(
    () => flattenTree(model.workspaces, expandedWorkspaceIds),
    [model.workspaces, expandedWorkspaceIds],
  );

  useEffect(() => {
    setOptimisticActiveRunId((current) => (current === activeRunId ? current : activeRunId));
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
    setOptimisticActiveRunId(runId);
    setActiveTreeId(buildRunTreeId(workspaceId, runId));
    onSelectRun(runId);
  };

  const selectRecentRun = (
    workspaceId: string,
    runId: string,
    filePath: string,
  ) => {
    setOptimisticActiveRunId(runId);
    setActiveTreeId(buildRunTreeId(workspaceId, runId));
    onSelectRecentRun(filePath);
  };

  return {
    activeTreeId,
    expandedWorkspaceIds,
    handleTreeKeyDown,
    optimisticActiveRunId,
    model,
    search,
    selectRecentRun,
    selectRun,
    setSearch,
    toggleWorkspace,
    treeRef,
  };
}
