import { formatRelativeTime } from "../../../shared/lib/format";
import type { WorkspaceIdentityOverrideMap } from "../../workspace";
import type {
  EventRecord,
  RunDataset,
  WorkspaceQuickFilterKey,
  WorkspaceRunRow,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";
import {
  appendWorkspaceRun,
  sortWorkspaceThreads,
} from "./workspaceTreeCollections.js";

function sanitizeSidebarRunTitle(value: string) {
  return value
    .replace(/^(prompt|input|user(?:\s+message)?)(?:\s+preview)?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveWorkspaceRunTitle(dataset: RunDataset, orderedEvents: EventRecord[]) {
  const firstInputPreview = orderedEvents
    .map((event) => sanitizeSidebarRunTitle(event.inputPreview ?? ""))
    .find((value) => value.length > 0);

  if (firstInputPreview) {
    return firstInputPreview;
  }

  const sessionTitle = dataset.session.title.trim();
  if (sessionTitle.length > 0) {
    return sessionTitle;
  }

  return dataset.run.title;
}

function latestActivityTimestamp(dataset: RunDataset) {
  return Math.max(
    dataset.run.endTs ?? dataset.run.startTs,
    ...dataset.events.map((event) => event.endTs ?? event.startTs),
  );
}

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

function buildLastEventSummary(latestEvent: EventRecord | null) {
  return [
    latestEvent?.waitReason,
    latestEvent?.outputPreview,
    latestEvent?.inputPreview,
    latestEvent?.title,
    "No event summary yet.",
  ].find((value) => Boolean(value)) as string;
}

function buildWorkspaceRunRow(dataset: RunDataset, referenceTimestamp: number): WorkspaceRunRow {
  const orderedEvents = sortEvents(dataset.events);
  const lastActivityTs = latestActivityTimestamp(dataset);

  return {
    id: dataset.run.traceId,
    title: deriveWorkspaceRunTitle(dataset, orderedEvents),
    status: dataset.run.status,
    lastEventSummary:
      buildLastEventSummary(orderedEvents[orderedEvents.length - 1] ?? null),
    lastActivityTs,
    relativeTime: formatRelativeTime(lastActivityTs, referenceTimestamp),
    liveMode: dataset.run.liveMode,
  };
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

function buildReferenceTimestamp(datasets: RunDataset[]) {
  return datasets.length > 0
    ? Math.max(...datasets.map((dataset) => latestActivityTimestamp(dataset)))
    : 0;
}

export function buildWorkspaceTreeModel(
  ...[
    datasets,
    search,
    quickFilter,
    workspaceIdentityOverrides = {},
  ]: [
    RunDataset[],
    string,
    WorkspaceQuickFilterKey,
    WorkspaceIdentityOverrideMap?,
  ]
): WorkspaceTreeModel {
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
