import type {
  WorkspaceRunRow,
  WorkspaceScoreFilterKey,
  WorkspaceScoreSortKey,
  WorkspaceThreadGroup,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../../../entities/run";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { formatRelativeTime } from "../../../shared/lib/format";
import {
  matchesSidebarRunFilters,
  sortWorkspaceTreeItems,
} from "./sidebarTreeScoring";

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

function upsertThread(workspace: WorkspaceTreeItem, source: SidebarRunSource) {
  const existingThread = workspace.threads.find((item) => item.id === source.sessionId);
  if (existingThread) {
    return existingThread;
  }

  const nextThread = buildThreadGroup(source);
  workspace.threads.push(nextThread);
  return nextThread;
}

function appendSidebarRunSource(options: {
  workspaceMap: Map<string, WorkspaceTreeItem>;
  source: SidebarRunSource;
  normalizedSearch: string;
  referenceTimestamp: number;
  scoreFilter: WorkspaceScoreFilterKey;
}) {
  const {
    workspaceMap,
    source,
    normalizedSearch,
    referenceTimestamp,
    scoreFilter,
  } = options;
  const runRow = buildSidebarRunRow(source, referenceTimestamp);
  if (
    !matchesSidebarRunFilters({
      source,
      runRow,
      normalizedSearch,
      scoreFilter,
    })
  ) {
    return;
  }

  appendSidebarRun(workspaceMap, source, runRow);
}

function buildSidebarRunRow(
  source: SidebarRunSource,
  referenceTimestamp: number,
): WorkspaceRunRow {
  return {
    ...source.row,
    relativeTime: formatRelativeTime(source.row.lastActivityTs, referenceTimestamp),
  };
}

function appendSidebarRun(
  workspaceMap: Map<string, WorkspaceTreeItem>,
  source: SidebarRunSource,
  runRow: WorkspaceRunRow,
) {
  const workspace = workspaceMap.get(source.workspaceId) ?? buildWorkspaceItem(source);
  const thread = upsertThread(workspace, source);
  thread.runs.push(runRow);
  workspace.runCount += 1;
  workspaceMap.set(source.workspaceId, workspace);
}

export function resolveWorkspaceIdentity(options: ResolveWorkspaceIdentityOptions) {
  const { projectId, repoPath, displayName, workspaceIdentityOverrides } = options;
  const workspaceIdentity = workspaceIdentityOverrides[repoPath];
  return {
    id: workspaceIdentity?.originPath ?? projectId,
    displayName: workspaceIdentity?.displayName ?? displayName,
    originPath: workspaceIdentity?.originPath ?? repoPath,
  };
}

export function buildWorkspaceTreeFromSources(options: {
  sources: SidebarRunSource[];
  search: string;
  scoreSort: WorkspaceScoreSortKey;
  scoreFilter: WorkspaceScoreFilterKey;
}): WorkspaceTreeModel {
  const { sources, search, scoreSort, scoreFilter } = options;
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
      scoreFilter,
    });
  });

  return {
    workspaces: sortWorkspaceTreeItems([...workspaceMap.values()], scoreSort),
  };
}
