import type {
  RunDataset,
  WorkspaceRunRow,
  WorkspaceThreadGroup,
  WorkspaceTreeItem,
} from "../model/types.js";

export function findOrCreateWorkspace(
  workspaceMap: Map<string, WorkspaceTreeItem>,
  dataset: RunDataset,
  workspaceIdentity: {
    id: string;
    displayName: string;
    originPath: string;
  },
) {
  const existingWorkspace = workspaceMap.get(workspaceIdentity.id);
  if (existingWorkspace) {
    return existingWorkspace;
  }

  const workspace = {
    id: workspaceIdentity.id,
    name: workspaceIdentity.displayName,
    repoPath: workspaceIdentity.originPath,
    badge: dataset.project.badge ?? null,
    runCount: 0,
    threads: [],
  } satisfies WorkspaceTreeItem;

  workspaceMap.set(workspaceIdentity.id, workspace);
  return workspace;
}

export function findOrCreateThread(
  workspace: WorkspaceTreeItem,
  dataset: RunDataset,
) {
  const existingThread = workspace.threads.find((thread) => thread.id === dataset.session.sessionId);
  if (existingThread) {
    return existingThread;
  }

  const thread = {
    id: dataset.session.sessionId,
    title: dataset.session.title,
    runs: [],
  } satisfies WorkspaceThreadGroup;

  workspace.threads.push(thread);
  return thread;
}

export function appendWorkspaceRun(
  args: {
    workspaceMap: Map<string, WorkspaceTreeItem>;
    dataset: RunDataset;
    workspaceIdentity: {
      id: string;
      displayName: string;
      originPath: string;
    };
    runRow: WorkspaceRunRow;
  },
) {
  const workspace = findOrCreateWorkspace(
    args.workspaceMap,
    args.dataset,
    args.workspaceIdentity,
  );
  const thread = findOrCreateThread(workspace, args.dataset);

  thread.runs.push(args.runRow);
  workspace.runCount += 1;
}

export function sortWorkspaceThreads(workspace: WorkspaceTreeItem) {
  const threads = workspace.threads
    .map((thread) => ({
      ...thread,
      runs: [...thread.runs].sort((left, right) => right.lastActivityTs - left.lastActivityTs),
    }))
    .sort((left, right) => {
      const rightLatest = right.runs[0]?.lastActivityTs ?? 0;
      const leftLatest = left.runs[0]?.lastActivityTs ?? 0;
      return rightLatest - leftLatest;
    });

  return { ...workspace, threads };
}
