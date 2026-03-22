import type {
  EventRecord,
  RunDataset,
  WorkspaceRunRow,
  WorkspaceThreadGroup,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { formatRelativeTime } from "../../../shared/lib/format";

function sortEvents(events: EventRecord[]) {
  return [...events].sort((left, right) => left.startTs - right.startTs);
}

interface SidebarRunSource {
  workspaceId: string;
  workspaceName: string;
  repoPath: string;
  badge: string | null;
  sessionId: string;
  sessionTitle: string;
  row: WorkspaceRunRow;
}

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

function resolveWorkspaceIdentity(
  projectId: string,
  repoPath: string,
  displayName: string,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
) {
  const workspaceIdentity = workspaceIdentityOverrides[repoPath];
  return {
    id: workspaceIdentity?.originPath ?? projectId,
    displayName: workspaceIdentity?.displayName ?? displayName,
    originPath: workspaceIdentity?.originPath ?? repoPath,
  };
}

function buildDatasetSource(
  dataset: RunDataset,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
): SidebarRunSource {
  const orderedEvents = sortEvents(dataset.events);
  const latestEvent = orderedEvents[orderedEvents.length - 1] ?? null;
  const lastActivityTs = latestActivityTimestamp(dataset);
  const workspaceIdentity = resolveWorkspaceIdentity(
    dataset.project.projectId,
    dataset.project.repoPath,
    dataset.project.name,
    workspaceIdentityOverrides,
  );

  return {
    workspaceId: workspaceIdentity.id,
    workspaceName: workspaceIdentity.displayName,
    repoPath: workspaceIdentity.originPath,
    badge: dataset.project.badge ?? null,
    sessionId: dataset.session.sessionId,
    sessionTitle: dataset.session.title,
    row: {
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
      relativeTime: "",
      liveMode: dataset.run.liveMode,
    },
  };
}

function buildRecentSource(
  item: RecentSessionIndexItem,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
  recentSnapshotLoadingId: string | null,
): SidebarRunSource {
  const startedAt = new Date(item.startedAt).getTime();
  const updatedAt = new Date(item.updatedAt).getTime();
  const lastActivityTs = Number.isNaN(updatedAt)
    ? startedAt
    : updatedAt;
  const workspaceIdentity = resolveWorkspaceIdentity(
    item.originPath,
    item.originPath,
    item.displayName,
    workspaceIdentityOverrides,
  );

  return {
    workspaceId: workspaceIdentity.id,
    workspaceName: workspaceIdentity.displayName,
    repoPath: workspaceIdentity.originPath,
    badge: "Desktop",
    sessionId: item.sessionId,
    sessionTitle: item.title,
    row: {
      id: item.sessionId,
      title: item.title,
      status: item.status,
      lastEventSummary: item.lastEventSummary,
      lastActivityTs: Number.isNaN(lastActivityTs) ? 0 : lastActivityTs,
      relativeTime: "",
      liveMode: "imported",
      filePath: item.filePath,
      loading: recentSnapshotLoadingId === item.filePath,
    },
  };
}

function buildWorkspaceTreeFromSources(
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
    const runRow: WorkspaceRunRow = {
      ...source.row,
      relativeTime: formatRelativeTime(source.row.lastActivityTs, referenceTimestamp),
    };

    const searchTarget = [
      source.workspaceName,
      source.repoPath,
      source.badge ?? "",
      runRow.title,
      source.sessionTitle,
      runRow.lastEventSummary,
    ]
      .join(" ")
      .toLowerCase();

    if (normalizedSearch && !searchTarget.includes(normalizedSearch)) {
      return;
    }

    const workspace =
      workspaceMap.get(source.workspaceId) ??
      ({
        id: source.workspaceId,
        name: source.workspaceName,
        repoPath: source.repoPath,
        badge: source.badge,
        runCount: 0,
        threads: [],
      } satisfies WorkspaceTreeItem);

    const thread =
      workspace.threads.find((item) => item.id === source.sessionId) ??
      ({
        id: source.sessionId,
        title: source.sessionTitle,
        runs: [],
      } satisfies WorkspaceThreadGroup);

    if (!workspace.threads.some((item) => item.id === thread.id)) {
      workspace.threads.push(thread);
    }

    thread.runs.push(runRow);
    workspace.runCount += 1;
    workspaceMap.set(source.workspaceId, workspace);
  });

  return {
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

interface BuildSidebarTreeModelOptions {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  recentSnapshotLoadingId: string | null;
  search: string;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}

export function buildSidebarTreeModel({
  datasets,
  recentIndex,
  recentIndexReady,
  recentSnapshotLoadingId,
  search,
  workspaceIdentityOverrides,
}: BuildSidebarTreeModelOptions): WorkspaceTreeModel {
  if (!recentIndexReady) {
    return buildWorkspaceTreeFromSources(
      datasets.map((dataset) => buildDatasetSource(dataset, workspaceIdentityOverrides)),
      search,
    );
  }

  const recentSessionIds = new Set(recentIndex.map((item) => item.sessionId));
  const sources: SidebarRunSource[] = [
    ...recentIndex.map((item) =>
      buildRecentSource(item, workspaceIdentityOverrides, recentSnapshotLoadingId),
    ),
    ...datasets
      .filter((dataset) => !recentSessionIds.has(dataset.run.traceId))
      .map((dataset) => buildDatasetSource(dataset, workspaceIdentityOverrides)),
  ];

  return buildWorkspaceTreeFromSources(sources, search);
}
