import type { WorkspaceTreeItem } from "../../shared/domain";

interface FlatTreeItem {
  treeId: string;
  workspaceId: string;
  type: "workspace" | "run";
  runId?: string;
}

interface ResolveTreeKeyActionArgs {
  key: string;
  flatItems: FlatTreeItem[];
  activeTreeId: string;
  activeRunId: string;
  workspaces: WorkspaceTreeItem[];
  expandedWorkspaceIds: string[];
}

interface WorkspaceTreeKeyAction {
  handled: boolean;
  activeTreeId?: string;
  expandedWorkspaceIds?: string[];
  focusTreeId?: string;
  selectRunId?: string;
}

export function flattenTree(
  workspaces: WorkspaceTreeItem[],
  expandedWorkspaceIds: string[],
): FlatTreeItem[] {
  return workspaces.flatMap((workspace) => [
    {
      treeId: buildWorkspaceTreeId(workspace.id),
      workspaceId: workspace.id,
      type: "workspace" as const,
    },
    ...(expandedWorkspaceIds.includes(workspace.id)
      ? getWorkspaceRuns(workspace).map((run) => ({
          treeId: buildRunTreeId(workspace.id, run.id),
          workspaceId: workspace.id,
          type: "run" as const,
          runId: run.id,
        }))
      : []),
  ]);
}

export function areWorkspaceIdsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function getWorkspaceRuns(workspace: WorkspaceTreeItem) {
  return workspace.threads.flatMap((thread) => thread.runs);
}

export function buildWorkspaceTreeId(workspaceId: string) {
  return `workspace-${encodeURIComponent(workspaceId)}`;
}

export function buildRunTreeId(workspaceId: string, runId: string) {
  return `run-${encodeURIComponent(workspaceId)}-${encodeURIComponent(runId)}`;
}

export function findRunTreeId(workspaces: WorkspaceTreeItem[], activeRunId: string) {
  for (const workspace of workspaces) {
    const run = getWorkspaceRuns(workspace).find((item) => item.id === activeRunId);
    if (run) {
      return buildRunTreeId(workspace.id, run.id);
    }
  }

  return null;
}

export function resolveExpandedWorkspaceIds(
  workspaces: WorkspaceTreeItem[],
  expandedWorkspaceIds: string[],
) {
  const nextExpanded = expandedWorkspaceIds.filter((workspaceId) =>
    workspaces.some((workspace) => workspace.id === workspaceId),
  );

  return nextExpanded.length ? nextExpanded : workspaces.map((workspace) => workspace.id);
}

export function resolveActiveTreeId(
  workspaces: WorkspaceTreeItem[],
  activeRunId: string,
) {
  return findRunTreeId(workspaces, activeRunId) ?? buildWorkspaceTreeId(workspaces[0]?.id ?? "");
}

export function resolveTreeKeyAction({
  key,
  flatItems,
  activeTreeId,
  activeRunId,
  workspaces,
  expandedWorkspaceIds,
}: ResolveTreeKeyActionArgs): WorkspaceTreeKeyAction {
  if (!flatItems.length) {
    return { handled: false };
  }

  const currentIndex = Math.max(
    flatItems.findIndex((item) => item.treeId === activeTreeId),
    0,
  );

  if (key === "ArrowDown" || key === "ArrowUp") {
    const delta = key === "ArrowDown" ? 1 : -1;
    const nextIndex = Math.min(
      Math.max(currentIndex + delta, 0),
      flatItems.length - 1,
    );
    const nextItem = flatItems[nextIndex];

    return nextItem
      ? {
          handled: true,
          activeTreeId: nextItem.treeId,
          focusTreeId: nextItem.treeId,
        }
      : { handled: true };
  }

  const activeItem = flatItems[currentIndex];
  if (!activeItem) {
    return { handled: false };
  }

  const workspace = workspaces.find((item) => item.id === activeItem.workspaceId);
  if (!workspace) {
    return { handled: false };
  }

  if (key === "ArrowRight") {
    if (activeItem.type !== "workspace") {
      return { handled: true };
    }

    if (!expandedWorkspaceIds.includes(workspace.id)) {
      return {
        handled: true,
        expandedWorkspaceIds: [...expandedWorkspaceIds, workspace.id],
      };
    }

    const firstRun = getWorkspaceRuns(workspace)[0];
    return firstRun
      ? {
          handled: true,
          activeTreeId: buildRunTreeId(workspace.id, firstRun.id),
          focusTreeId: buildRunTreeId(workspace.id, firstRun.id),
        }
      : { handled: true };
  }

  if (key === "ArrowLeft") {
    if (activeItem.type === "run") {
      const workspaceTreeId = buildWorkspaceTreeId(workspace.id);
      return {
        handled: true,
        activeTreeId: workspaceTreeId,
        focusTreeId: workspaceTreeId,
      };
    }

    return {
      handled: true,
      expandedWorkspaceIds: expandedWorkspaceIds.filter(
        (workspaceId) => workspaceId !== workspace.id,
      ),
    };
  }

  if (key !== "Enter") {
    return { handled: false };
  }

  if (activeItem.type === "run") {
    return {
      handled: true,
      activeTreeId: activeItem.treeId,
      selectRunId: activeItem.runId ?? activeRunId,
    };
  }

  return {
    handled: true,
    activeTreeId: buildWorkspaceTreeId(workspace.id),
    expandedWorkspaceIds: expandedWorkspaceIds.includes(workspace.id)
      ? expandedWorkspaceIds.filter((workspaceId) => workspaceId !== workspace.id)
      : [...expandedWorkspaceIds, workspace.id],
  };
}
