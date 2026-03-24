import type { EventRecord, RunDataset } from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import {
  buildWorkspaceTreeFromSources,
  resolveWorkspaceIdentity,
  type SidebarRunSource,
} from "./sidebarTreeAssembly";

function sortEvents(events: EventRecord[]) {
  return [...events].sort((left, right) => left.startTs - right.startTs);
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
  return sessionTitle.length > 0 ? sessionTitle : dataset.run.title;
}

function latestActivityTimestamp(dataset: RunDataset) {
  return Math.max(
    dataset.run.endTs ?? dataset.run.startTs,
    ...dataset.events.map((event) => event.endTs ?? event.startTs),
  );
}

function isNonEmptySummary(value: string | null | undefined): value is string {
  return Boolean(value && value.length > 0);
}

function buildDatasetLastEventSummary(latestEvent: EventRecord | null) {
  return [
    latestEvent?.waitReason,
    latestEvent?.outputPreview,
    latestEvent?.inputPreview,
    latestEvent?.title,
  ].find(isNonEmptySummary) ?? "No event summary yet.";
}

function buildDatasetSource(
  dataset: RunDataset,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
): SidebarRunSource {
  const orderedEvents = sortEvents(dataset.events);
  const workspaceIdentity = resolveWorkspaceIdentity({
    projectId: dataset.project.projectId,
    repoPath: dataset.project.repoPath,
    displayName: dataset.project.name,
    workspaceIdentityOverrides,
  });

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
      lastEventSummary: buildDatasetLastEventSummary(
        orderedEvents[orderedEvents.length - 1] ?? null,
      ),
      lastActivityTs: latestActivityTimestamp(dataset),
      relativeTime: "",
      liveMode: dataset.run.liveMode,
    },
  };
}

function resolveRecentLastActivityTimestamp(item: RecentSessionIndexItem) {
  const startedAt = new Date(item.startedAt).getTime();
  const updatedAt = new Date(item.updatedAt).getTime();
  return Number.isNaN(updatedAt) ? startedAt : updatedAt;
}

function buildRecentSource(
  item: RecentSessionIndexItem,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
): SidebarRunSource {
  const lastActivityTs = resolveRecentLastActivityTimestamp(item);
  const workspaceIdentity = resolveWorkspaceIdentity({
    projectId: item.originPath,
    repoPath: item.originPath,
    displayName: item.displayName,
    workspaceIdentityOverrides,
  });

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
    },
  };
}

interface BuildSidebarTreeModelOptions {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  search: string;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}

function buildDatasetSources(
  datasets: RunDataset[],
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
) {
  return datasets.map((dataset) => buildDatasetSource(dataset, workspaceIdentityOverrides));
}

export function buildSidebarTreeModel(options: BuildSidebarTreeModelOptions) {
  const {
    datasets,
    recentIndex,
    recentIndexReady,
    search,
    workspaceIdentityOverrides,
  } = options;
  if (!recentIndexReady) {
    return buildWorkspaceTreeFromSources(
      buildDatasetSources(datasets, workspaceIdentityOverrides),
      search,
    );
  }

  const recentSessionIds = new Set(recentIndex.map((item) => item.sessionId));
  const recentSources = recentIndex.map((item) =>
    buildRecentSource(item, workspaceIdentityOverrides),
  );
  const datasetSources = datasets
    .filter((dataset) => !recentSessionIds.has(dataset.run.traceId))
    .map((dataset) => buildDatasetSource(dataset, workspaceIdentityOverrides));

  return buildWorkspaceTreeFromSources(
    [...recentSources, ...datasetSources],
    search,
  );
}
