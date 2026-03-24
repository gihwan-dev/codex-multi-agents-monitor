import type { WorkspaceTreeItem } from "../../../entities/run";

export interface FlatTreeItem {
  treeId: string;
  workspaceId: string;
  type: "workspace" | "run";
  runId?: string;
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

export function flattenTree(
  workspaces: WorkspaceTreeItem[],
  expandedWorkspaceIds: string[],
): FlatTreeItem[] {
  return workspaces.flatMap((workspace) =>
    buildFlatWorkspaceTreeItems(workspace, expandedWorkspaceIds),
  );
}

function buildFlatWorkspaceTreeItems(
  workspace: WorkspaceTreeItem,
  expandedWorkspaceIds: string[],
) {
  return [
    {
      treeId: buildWorkspaceTreeId(workspace.id),
      workspaceId: workspace.id,
      type: "workspace" as const,
    },
    ...buildFlatRunTreeItems(workspace, expandedWorkspaceIds),
  ];
}

function buildFlatRunTreeItems(
  workspace: WorkspaceTreeItem,
  expandedWorkspaceIds: string[],
) {
  return expandedWorkspaceIds.includes(workspace.id)
    ? getWorkspaceRuns(workspace).map((run) => ({
        treeId: buildRunTreeId(workspace.id, run.id),
        workspaceId: workspace.id,
        type: "run" as const,
        runId: run.id,
      }))
    : [];
}

export function areWorkspaceIdsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
