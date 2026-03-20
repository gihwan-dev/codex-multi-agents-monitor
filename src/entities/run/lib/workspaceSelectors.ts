import { formatRelativeTime } from "../../../shared/lib/format/index.js";
import type {
  EventRecord,
  QuickFilterSummary,
  RunDataset,
  WorkspaceIdentityOverrideMap,
  WorkspaceRunRow,
  WorkspaceThreadGroup,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";

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

function matchesQuickFilter(dataset: RunDataset, filter: QuickFilterSummary["key"]) {
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

function buildWorkspaceRunRow(dataset: RunDataset, referenceTimestamp: number): WorkspaceRunRow {
  const orderedEvents = sortEvents(dataset.events);
  const latestEvent = orderedEvents[orderedEvents.length - 1] ?? null;
  const lastActivityTs = latestActivityTimestamp(dataset);

  return {
    id: dataset.run.traceId,
    title: deriveWorkspaceRunTitle(dataset, orderedEvents),
    status: dataset.run.status,
    lastEventSummary:
      latestEvent?.waitReason ??
      latestEvent?.outputPreview ??
      latestEvent?.inputPreview ??
      latestEvent?.title ??
      "No event summary yet.",
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

export function buildWorkspaceTreeModel(
  datasets: RunDataset[],
  search: string,
  quickFilter: QuickFilterSummary["key"],
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap = {},
): WorkspaceTreeModel {
  const referenceTimestamp =
    datasets.length > 0
      ? Math.max(...datasets.map((dataset) => latestActivityTimestamp(dataset)))
      : 0;
  const normalizedSearch = search.trim().toLowerCase();
  const quickFilters: QuickFilterSummary[] = [
    { key: "all", label: "All", count: datasets.length },
    {
      key: "live",
      label: "Live",
      count: datasets.filter((dataset) => matchesQuickFilter(dataset, "live")).length,
    },
    {
      key: "waiting",
      label: "Waiting",
      count: datasets.filter((dataset) => matchesQuickFilter(dataset, "waiting")).length,
    },
    {
      key: "failed",
      label: "Failed",
      count: datasets.filter((dataset) => matchesQuickFilter(dataset, "failed")).length,
    },
  ];

  const workspaceMap = new Map<string, WorkspaceTreeItem>();
  datasets
    .filter((dataset) => matchesQuickFilter(dataset, quickFilter))
    .forEach((dataset) => {
      const runRow = buildWorkspaceRunRow(dataset, referenceTimestamp);
      const workspaceIdentity = resolveWorkspaceIdentity(
        dataset,
        workspaceIdentityOverrides,
      );
      const searchTarget = [
        workspaceIdentity.displayName,
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

      if (normalizedSearch && !searchTarget.includes(normalizedSearch)) {
        return;
      }

      const workspace =
        workspaceMap.get(workspaceIdentity.id) ??
        ({
          id: workspaceIdentity.id,
          name: workspaceIdentity.displayName,
          repoPath: workspaceIdentity.originPath,
          badge: dataset.project.badge ?? null,
          runCount: 0,
          threads: [],
        } satisfies WorkspaceTreeItem);

      const thread =
        workspace.threads.find((item) => item.id === dataset.session.sessionId) ??
        ({
          id: dataset.session.sessionId,
          title: dataset.session.title,
          runs: [],
        } satisfies WorkspaceThreadGroup);

      if (!workspace.threads.some((item) => item.id === thread.id)) {
        workspace.threads.push(thread);
      }

      thread.runs.push(runRow);
      workspace.runCount += 1;
      workspaceMap.set(workspaceIdentity.id, workspace);
    });

  return {
    quickFilters,
    workspaces: [...workspaceMap.values()]
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
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}
