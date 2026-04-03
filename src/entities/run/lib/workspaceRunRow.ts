import { formatRelativeTime } from "../../../shared/lib/format";
import type {
  EventRecord,
  RunDataset,
  WorkspaceRunRow,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";
import { resolveMainSessionProvider } from "./sessionProvider.js";

function sanitizeSidebarRunTitle(value: string) {
  return value
    .replace(/^(prompt|input|user(?:\s+message)?)(?:\s+preview)?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveWorkspaceRunTitle(
  dataset: RunDataset,
  orderedEvents: EventRecord[],
) {
  const firstInputPreview = orderedEvents
    .map((event) => sanitizeSidebarRunTitle(event.inputPreview ?? ""))
    .find((value) => value.length > 0);

  if (firstInputPreview) {
    return firstInputPreview;
  }

  const sessionTitle = dataset.session.title.trim();
  return sessionTitle.length > 0 ? sessionTitle : dataset.run.title;
}

export function latestActivityTimestamp(dataset: RunDataset) {
  return Math.max(
    dataset.run.endTs ?? dataset.run.startTs,
    ...dataset.events.map((event) => event.endTs ?? event.startTs),
  );
}

function buildLastEventSummary(latestEvent: EventRecord | null) {
  return [
    latestEvent?.waitReason,
    latestEvent?.outputPreview,
    latestEvent?.inputPreview,
    latestEvent?.title,
    "No event summary yet.",
  ].find(Boolean) as string;
}

function createWorkspaceRunRow(options: {
  dataset: RunDataset;
  orderedEvents: EventRecord[];
  referenceTimestamp: number;
}): WorkspaceRunRow {
  const { dataset, orderedEvents, referenceTimestamp } = options;
  const lastActivityTs = latestActivityTimestamp(dataset);
  const latestEvent = orderedEvents[orderedEvents.length - 1] ?? null;
  return {
    id: dataset.run.traceId,
    title: deriveWorkspaceRunTitle(dataset, orderedEvents),
    provider: resolveMainSessionProvider(dataset),
    status: dataset.run.status,
    lastEventSummary: buildLastEventSummary(latestEvent),
    lastActivityTs,
    relativeTime: formatRelativeTime(lastActivityTs, referenceTimestamp),
    liveMode: dataset.run.liveMode,
  };
}

export function buildWorkspaceRunRow(
  dataset: RunDataset,
  referenceTimestamp: number,
): WorkspaceRunRow {
  return createWorkspaceRunRow({
    dataset,
    orderedEvents: sortEvents(dataset.events),
    referenceTimestamp,
  });
}

export function buildReferenceTimestamp(datasets: RunDataset[]) {
  return datasets.length > 0
    ? Math.max(...datasets.map((dataset) => latestActivityTimestamp(dataset)))
    : 0;
}
