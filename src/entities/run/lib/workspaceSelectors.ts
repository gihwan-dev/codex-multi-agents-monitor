import type { WorkspaceIdentityOverrideMap } from "../../workspace";
import type {
  RunDataset,
  WorkspaceQuickFilterKey,
  WorkspaceRunRow,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../model/types.js";
import {
  buildReferenceTimestamp,
  buildWorkspaceRunRow,
} from "./workspaceRunRow.js";
import {
  appendWorkspaceRun,
  sortWorkspaceThreads,
} from "./workspaceTreeCollections.js";

function matchesQuickFilter(dataset: RunDataset, filter: WorkspaceQuickFilterKey) {
  if (filter === "all") {
    return true;
  }
  if (filter === "live") {
    return dataset.run.liveMode === "live";
  }
  if (filter === "waiting") {
    return ["waiting", "blocked", "interrupted"].includes(dataset.run.status);
  }
  return dataset.run.status === "failed";
}

function resolveWorkspaceIdentity(
  dataset: RunDataset,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
) {
  const workspaceIdentity = workspaceIdentityOverrides[dataset.project.repoPath];
  return {
    id: workspaceIdentity?.originPath ?? dataset.project.projectId,
    displayName: workspaceIdentity?.displayName ?? dataset.project.name,
    originPath: workspaceIdentity?.originPath ?? dataset.project.repoPath,
  };
}

function buildWorkspaceSearchTarget(
  dataset: RunDataset,
  runRow: WorkspaceRunRow,
  workspaceName: string,
) {
  return [
    workspaceName,
    dataset.project.name,
    dataset.project.repoPath,
    dataset.project.badge ?? "",
    runRow.title,
    dataset.session.title,
    dataset.run.title,
    runRow.lastEventSummary,
  ]
    .join(" ")
    .toLowerCase();
}

function addWorkspaceDataset(
  args: {
    workspaceMap: Map<string, WorkspaceTreeItem>;
    dataset: RunDataset;
    referenceTimestamp: number;
    normalizedSearch: string;
    workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
  },
) {
  const runRow = buildWorkspaceRunRow(args.dataset, args.referenceTimestamp);
  const workspaceIdentity = resolveWorkspaceIdentity(
    args.dataset,
    args.workspaceIdentityOverrides,
  );
  const searchTarget = buildWorkspaceSearchTarget(
    args.dataset,
    runRow,
    workspaceIdentity.displayName,
  );

  if (args.normalizedSearch && !searchTarget.includes(args.normalizedSearch)) {
    return;
  }

  appendWorkspaceRun({
    workspaceMap: args.workspaceMap,
    dataset: args.dataset,
    workspaceIdentity,
    runRow,
  });
}

interface BuildWorkspaceTreeModelOptions {
  datasets: RunDataset[];
  search: string;
  quickFilter: WorkspaceQuickFilterKey;
  workspaceIdentityOverrides?: WorkspaceIdentityOverrideMap;
}

export function buildWorkspaceTreeModel(options: BuildWorkspaceTreeModelOptions): WorkspaceTreeModel {
  const {
    datasets,
    search,
    quickFilter,
    workspaceIdentityOverrides = {},
  } = options;
  const referenceTimestamp = buildReferenceTimestamp(datasets);
  const normalizedSearch = search.trim().toLowerCase();
  const workspaceMap = new Map<string, WorkspaceTreeItem>();

  for (const dataset of datasets.filter((item) => matchesQuickFilter(item, quickFilter))) {
    addWorkspaceDataset({
      workspaceMap,
      dataset,
      referenceTimestamp,
      normalizedSearch,
      workspaceIdentityOverrides,
    });
  }

  return {
    workspaces: [...workspaceMap.values()]
      .map(sortWorkspaceThreads)
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}
