import {
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RunDataset, WorkspaceTreeModel } from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { buildSidebarTreeModel } from "../lib/sidebarTreeModel";
import type { flattenTree } from "../lib/workspaceTreeUtils";
import {
  areWorkspaceIdsEqual,
  buildRunTreeId,
  buildWorkspaceTreeId,
  resolveActiveTreeId,
  resolveExpandedWorkspaceIds,
  resolveTreeKeyAction,
} from "../lib/workspaceTreeUtils";

export function useWorkspaceTreeModel(options: {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}) {
  const {
    datasets,
    recentIndex,
    recentIndexReady,
    workspaceIdentityOverrides,
  } = options;
  const [search, setSearch] = useState("");
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
  return { search, setSearch, model };
}

export function useWorkspaceTreeSelectionSync(options: {
  activeRunId: string;
  model: WorkspaceTreeModel;
  setActiveTreeId: Dispatch<SetStateAction<string>>;
  setExpandedWorkspaceIds: Dispatch<SetStateAction<string[]>>;
  setOptimisticActiveRunId: Dispatch<SetStateAction<string>>;
}) {
  const {
    activeRunId,
    model,
    setActiveTreeId,
    setExpandedWorkspaceIds,
    setOptimisticActiveRunId,
  } = options;
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
  }, [activeRunId, model.workspaces, setActiveTreeId, setExpandedWorkspaceIds, setOptimisticActiveRunId]);
}

function focusTreeItem(
  treeRef: RefObject<HTMLDivElement | null>,
  itemId: string,
) {
  const target = treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${itemId}"]`);
  target?.focus();
}
function applyTreeKeyAction({
  action,
  onSelectRun,
  setActiveTreeId,
  setExpandedWorkspaceIds,
  treeRef,
}: {
  action: ReturnType<typeof resolveTreeKeyAction>;
  onSelectRun: (traceId: string) => void;
  setActiveTreeId: Dispatch<SetStateAction<string>>;
  setExpandedWorkspaceIds: Dispatch<SetStateAction<string[]>>;
  treeRef: RefObject<HTMLDivElement | null>;
}) {
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
    window.requestAnimationFrame(() => {
      focusTreeItem(treeRef, action.focusTreeId as string);
    });
  }
}

function buildWorkspaceSelectionActions({
  onSelectRecentRun,
  onSelectRun,
  setActiveTreeId,
  setExpandedWorkspaceIds,
  setOptimisticActiveRunId,
}: {
  onSelectRecentRun: (filePath: string) => void;
  onSelectRun: (traceId: string) => void;
  setActiveTreeId: Dispatch<SetStateAction<string>>;
  setExpandedWorkspaceIds: Dispatch<SetStateAction<string[]>>;
  setOptimisticActiveRunId: Dispatch<SetStateAction<string>>;
}) {
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
  const selectRecentRun = (workspaceId: string, runId: string, filePath: string) => {
    setOptimisticActiveRunId(runId);
    setActiveTreeId(buildRunTreeId(workspaceId, runId));
    onSelectRecentRun(filePath);
  };
  return { selectRecentRun, selectRun, toggleWorkspace };
}

export function useWorkspaceTreeActions({
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
}: {
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
}) {
  const treeRef = useRef<HTMLDivElement>(null);
  const selectionActions = buildWorkspaceSelectionActions({
    onSelectRecentRun,
    onSelectRun,
    setActiveTreeId,
    setExpandedWorkspaceIds,
    setOptimisticActiveRunId,
  });
  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = resolveTreeKeyAction({ key: event.key, flatItems, activeTreeId, activeRunId, workspaces: model.workspaces, expandedWorkspaceIds });
    if (!action.handled) {
      return;
    }
    event.preventDefault();
    applyTreeKeyAction({ action, onSelectRun, setActiveTreeId, setExpandedWorkspaceIds, treeRef });
  };

  return {
    handleTreeKeyDown,
    ...selectionActions,
    treeRef,
  };
}
