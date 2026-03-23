import type {
  WorkspaceRunRow,
  WorkspaceThreadGroup,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../../../entities/run";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { formatRelativeTime } from "../../../shared/lib/format";

export interface SidebarRunSource {
  workspaceId: string;
  workspaceName: string;
  repoPath: string;
  badge: string | null;
  sessionId: string;
  sessionTitle: string;
  row: WorkspaceRunRow;
}

interface ResolveWorkspaceIdentityOptions {
  projectId: string;
  repoPath: string;
  displayName: string;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}

function buildWorkspaceItem(source: SidebarRunSource): WorkspaceTreeItem {
  return {
    id: source.workspaceId,
    name: source.workspaceName,
    repoPath: source.repoPath,
    badge: source.badge,
    runCount: 0,
    threads: [],
  } satisfies WorkspaceTreeItem;
}

function buildThreadGroup(source: SidebarRunSource): WorkspaceThreadGroup {
  return {
    id: source.sessionId,
    title: source.sessionTitle,
    runs: [],
  } satisfies WorkspaceThreadGroup;
}

function buildSearchTarget(source: SidebarRunSource, runRow: WorkspaceRunRow) {
  return [
    source.workspaceName,
    source.repoPath,
    source.badge ?? "",
    runRow.title,
    source.sessionTitle,
    runRow.lastEventSummary,
  ]
    .join(" ")
    .toLowerCase();
}

function upsertThread(workspace: WorkspaceTreeItem, source: SidebarRunSource) {
  const existingThread = workspace.threads.find((item) => item.id === source.sessionId);
  if (existingThread) {
    return existingThread;
  }

  const nextThread = buildThreadGroup(source);
  workspace.threads.push(nextThread);
  return nextThread;
}

function appendSidebarRunSource({
  workspaceMap,
  source,
  normalizedSearch,
  referenceTimestamp,
}: {
  workspaceMap: Map<string, WorkspaceTreeItem>;
  source: SidebarRunSource;
  normalizedSearch: string;
  referenceTimestamp: number;
}) {
  const runRow: WorkspaceRunRow = {
    ...source.row,
    relativeTime: formatRelativeTime(source.row.lastActivityTs, referenceTimestamp),
  };
  if (normalizedSearch && !buildSearchTarget(source, runRow).includes(normalizedSearch)) {
    return;
  }

  const workspace = workspaceMap.get(source.workspaceId) ?? buildWorkspaceItem(source);
  const thread = upsertThread(workspace, source);
  thread.runs.push(runRow);
  workspace.runCount += 1;
  workspaceMap.set(source.workspaceId, workspace);
}

function sortWorkspaceTreeItems(workspaces: WorkspaceTreeItem[]) {
  return workspaces
    .map((workspace) => ({
      ...workspace,
      threads: workspace.threads
        .map((thread) => ({
          ...thread,
          runs: [...thread.runs].sort(
            (left, right) => right.lastActivityTs - left.lastActivityTs,
          ),
        }))
        .sort((left, right) => {
          const rightLatest = right.runs[0]?.lastActivityTs ?? 0;
          const leftLatest = left.runs[0]?.lastActivityTs ?? 0;
          return rightLatest - leftLatest;
        }),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function resolveWorkspaceIdentity({
  projectId,
  repoPath,
  displayName,
  workspaceIdentityOverrides,
}: ResolveWorkspaceIdentityOptions) {
  const workspaceIdentity = workspaceIdentityOverrides[repoPath];
  return {
    id: workspaceIdentity?.originPath ?? projectId,
    displayName: workspaceIdentity?.displayName ?? displayName,
    originPath: workspaceIdentity?.originPath ?? repoPath,
  };
}

export function buildWorkspaceTreeFromSources(
  sources: SidebarRunSource[],
  search: string,
): WorkspaceTreeModel {
  const referenceTimestamp =
    sources.length > 0
      ? Math.max(...sources.map((source) => source.row.lastActivityTs))
      : 0;
  const normalizedSearch = search.trim().toLowerCase();
  const workspaceMap = new Map<string, WorkspaceTreeItem>();

  sources.forEach((source) => {
    appendSidebarRunSource({
      workspaceMap,
      source,
      normalizedSearch,
      referenceTimestamp,
    });
  });

  return {
    workspaces: sortWorkspaceTreeItems([...workspaceMap.values()]),
  };
}
