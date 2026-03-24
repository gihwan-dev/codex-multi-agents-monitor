import type { WorkspaceTreeItem } from "../../../entities/run";
import {
  buildRunTreeId,
  buildWorkspaceTreeId,
  type FlatTreeItem,
  getWorkspaceRuns,
} from "./workspaceTreeCore";

export {
  areWorkspaceIdsEqual,
  buildRunTreeId,
  buildWorkspaceTreeId,
  findRunTreeId,
  flattenTree,
  getWorkspaceRuns,
  resolveActiveTreeId,
  resolveExpandedWorkspaceIds,
} from "./workspaceTreeCore";

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

interface TreeNavigationContext {
  activeItem: FlatTreeItem;
  workspace: WorkspaceTreeItem;
}

function buildExpandedWorkspaceAction(
  workspaceId: string,
  expandedWorkspaceIds: string[],
) {
  return {
    handled: true,
    expandedWorkspaceIds: [...expandedWorkspaceIds, workspaceId],
  };
}

function buildFirstRunFocusAction(workspace: WorkspaceTreeItem) {
  const firstRun = getWorkspaceRuns(workspace)[0];
  if (!firstRun) {
    return { handled: true };
  }

  const firstRunTreeId = buildRunTreeId(workspace.id, firstRun.id);
  return {
    handled: true,
    activeTreeId: firstRunTreeId,
    focusTreeId: firstRunTreeId,
  };
}

function resolveCurrentIndex(flatItems: FlatTreeItem[], activeTreeId: string) {
  return Math.max(flatItems.findIndex((item) => item.treeId === activeTreeId), 0);
}

function resolveVerticalTreeKeyAction(options: {
  key: string;
  flatItems: FlatTreeItem[];
  currentIndex: number;
}): WorkspaceTreeKeyAction | null {
  const { key, flatItems, currentIndex } = options;
  if (key !== "ArrowDown" && key !== "ArrowUp") {
    return null;
  }

  const delta = key === "ArrowDown" ? 1 : -1;
  const nextIndex = Math.min(Math.max(currentIndex + delta, 0), flatItems.length - 1);
  const nextItem = flatItems[nextIndex];
  return nextItem
    ? { handled: true, activeTreeId: nextItem.treeId, focusTreeId: nextItem.treeId }
    : { handled: true };
}

function resolveTreeNavigationContext(
  flatItems: FlatTreeItem[],
  activeTreeId: string,
  workspaces: WorkspaceTreeItem[],
) {
  const activeItem = flatItems[resolveCurrentIndex(flatItems, activeTreeId)];
  if (!activeItem) {
    return null;
  }

  const workspace = workspaces.find((item) => item.id === activeItem.workspaceId);
  return workspace ? { activeItem, workspace } : null;
}

function resolveArrowRightTreeAction(
  context: TreeNavigationContext,
  expandedWorkspaceIds: string[],
) {
  if (context.activeItem.type !== "workspace") {
    return { handled: true };
  }

  return expandedWorkspaceIds.includes(context.workspace.id)
    ? buildFirstRunFocusAction(context.workspace)
    : buildExpandedWorkspaceAction(context.workspace.id, expandedWorkspaceIds);
}

function resolveArrowLeftTreeAction(
  context: TreeNavigationContext,
  expandedWorkspaceIds: string[],
) {
  if (context.activeItem.type === "run") {
    const workspaceTreeId = buildWorkspaceTreeId(context.workspace.id);
    return { handled: true, activeTreeId: workspaceTreeId, focusTreeId: workspaceTreeId };
  }

  return {
    handled: true,
    expandedWorkspaceIds: expandedWorkspaceIds.filter(
      (workspaceId) => workspaceId !== context.workspace.id,
    ),
  };
}

function resolveEnterTreeAction(
  context: TreeNavigationContext,
  activeRunId: string,
  expandedWorkspaceIds: string[],
) {
  if (context.activeItem.type === "run") {
    return {
      handled: true,
      activeTreeId: context.activeItem.treeId,
      selectRunId: context.activeItem.runId ?? activeRunId,
    };
  }

  return {
    handled: true,
    activeTreeId: buildWorkspaceTreeId(context.workspace.id),
    expandedWorkspaceIds: expandedWorkspaceIds.includes(context.workspace.id)
      ? expandedWorkspaceIds.filter((workspaceId) => workspaceId !== context.workspace.id)
      : [...expandedWorkspaceIds, context.workspace.id],
  };
}

function resolveHorizontalOrEnterAction(
  args: ResolveTreeKeyActionArgs,
  context: TreeNavigationContext,
) {
  if (args.key === "ArrowRight") {
    return resolveArrowRightTreeAction(context, args.expandedWorkspaceIds);
  }

  if (args.key === "ArrowLeft") {
    return resolveArrowLeftTreeAction(context, args.expandedWorkspaceIds);
  }

  if (args.key === "Enter") {
    return resolveEnterTreeAction(context, args.activeRunId, args.expandedWorkspaceIds);
  }

  return { handled: false };
}

export function resolveTreeKeyAction(
  args: ResolveTreeKeyActionArgs,
): WorkspaceTreeKeyAction {
  if (!args.flatItems.length) {
    return { handled: false };
  }

  const currentIndex = resolveCurrentIndex(args.flatItems, args.activeTreeId);
  const verticalAction = resolveVerticalTreeKeyAction({
    key: args.key,
    flatItems: args.flatItems,
    currentIndex,
  });
  if (verticalAction) {
    return verticalAction;
  }

  const context = resolveTreeNavigationContext(
    args.flatItems,
    args.activeTreeId,
    args.workspaces,
  );
  return context ? resolveHorizontalOrEnterAction(args, context) : { handled: false };
}
