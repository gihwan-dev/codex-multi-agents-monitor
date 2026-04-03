import type {
  WorkspaceRunRow,
  WorkspaceScoreFilterKey,
  WorkspaceScoreSortKey,
  WorkspaceTreeItem,
} from "../../../entities/run";

interface SidebarSearchSource {
  badge: string | null;
  repoPath: string;
  sessionTitle: string;
  workspaceName: string;
}

function buildSearchTarget(source: SidebarSearchSource, runRow: WorkspaceRunRow) {
  return [
    source.workspaceName,
    source.repoPath,
    source.badge ?? "",
    runRow.provider ?? "",
    runRow.profileLabel ?? "",
    runRow.title,
    source.sessionTitle,
    runRow.lastEventSummary,
  ]
    .join(" ")
    .toLowerCase();
}

function compareNullableScore(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right - left;
}

export function matchesSidebarRunFilters(options: {
  normalizedSearch: string;
  runRow: WorkspaceRunRow;
  scoreFilter: WorkspaceScoreFilterKey;
  source: SidebarSearchSource;
}) {
  const { normalizedSearch, runRow, scoreFilter, source } = options;
  if (scoreFilter === "scored" && runRow.score === null) {
    return false;
  }
  if (scoreFilter === "high" && (runRow.score ?? -1) < 80) {
    return false;
  }

  return normalizedSearch
    ? buildSearchTarget(source, runRow).includes(normalizedSearch)
    : true;
}

export function compareWorkspaceRuns(
  left: WorkspaceRunRow,
  right: WorkspaceRunRow,
  scoreSort: WorkspaceScoreSortKey,
) {
  if (scoreSort === "score") {
    const scoreComparison = compareNullableScore(left.score, right.score);
    if (scoreComparison !== 0) {
      return scoreComparison;
    }
  }

  return right.lastActivityTs - left.lastActivityTs;
}

function buildEmptyWorkspaceRun(): WorkspaceRunRow {
  return {
    id: "",
    title: "",
    provider: null,
    score: null,
    profileLabel: null,
    status: "done",
    lastEventSummary: "",
    lastActivityTs: 0,
    relativeTime: "",
    liveMode: "imported",
  };
}

function compareWorkspaceThreads(
  left: WorkspaceTreeItem["threads"][number],
  right: WorkspaceTreeItem["threads"][number],
  scoreSort: WorkspaceScoreSortKey,
) {
  const topRunComparison = compareWorkspaceRuns(
    left.runs[0] ?? buildEmptyWorkspaceRun(),
    right.runs[0] ?? buildEmptyWorkspaceRun(),
    scoreSort,
  );

  return topRunComparison !== 0
    ? topRunComparison
    : left.title.localeCompare(right.title);
}

function compareWorkspaceItems(
  left: WorkspaceTreeItem,
  right: WorkspaceTreeItem,
  scoreSort: WorkspaceScoreSortKey,
) {
  const topRunComparison = compareWorkspaceRuns(
    left.threads[0]?.runs[0] ?? buildEmptyWorkspaceRun(),
    right.threads[0]?.runs[0] ?? buildEmptyWorkspaceRun(),
    scoreSort,
  );

  return topRunComparison !== 0
    ? topRunComparison
    : left.name.localeCompare(right.name);
}

export function sortWorkspaceTreeItems(
  workspaces: WorkspaceTreeItem[],
  scoreSort: WorkspaceScoreSortKey,
) {
  return workspaces
    .map((workspace) => ({
      ...workspace,
      threads: workspace.threads
        .map((thread) => ({
          ...thread,
          runs: [...thread.runs].sort((left, right) =>
            compareWorkspaceRuns(left, right, scoreSort),
          ),
        }))
        .sort((left, right) => compareWorkspaceThreads(left, right, scoreSort)),
    }))
    .sort((left, right) => {
      if (scoreSort === "score") {
        const topRunComparison = compareWorkspaceItems(left, right, scoreSort);
        if (topRunComparison !== 0) {
          return topRunComparison;
        }
      }

      return left.name.localeCompare(right.name);
    });
}
