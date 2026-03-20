import {
  calculateSummaryMetrics,
  type LiveConnection,
  type LiveWatchFrame,
  type RunDataset,
  type RunStatus,
} from "../../../entities/run";

interface LiveWatchSnapshot {
  dataset: RunDataset;
  connection: Exclude<LiveConnection, "paused">;
}

const TERMINAL_RUN_STATUSES = new Set<RunStatus>(["done", "failed", "cancelled"]);

function resolveLatestObservedTs(dataset: RunDataset, events: RunDataset["events"]) {
  return events.reduce(
    (latestTs, event) => Math.max(latestTs, event.endTs ?? event.startTs),
    dataset.run.endTs ?? dataset.run.startTs,
  );
}

function mergeLiveEvents(dataset: RunDataset, frame: LiveWatchFrame) {
  const seenEventIds = new Set(dataset.events.map((event) => event.eventId));
  const mergedEvents = [...dataset.events];

  frame.events.forEach((event) => {
    if (seenEventIds.has(event.eventId)) {
      return;
    }

    seenEventIds.add(event.eventId);
    mergedEvents.push(event);
  });

  return mergedEvents;
}

export function applyLiveFrame(dataset: RunDataset, frame: LiveWatchFrame): LiveWatchSnapshot {
  const events = mergeLiveEvents(dataset, frame);
  const runStatus = frame.status ?? dataset.run.status;
  const latestObservedTs = resolveLatestObservedTs(dataset, events);
  const nextDataset: RunDataset = {
    ...dataset,
    events,
    run: {
      ...dataset.run,
      status: runStatus,
      endTs: TERMINAL_RUN_STATUSES.has(runStatus) ? latestObservedTs : dataset.run.endTs,
      durationMs: Math.max(dataset.run.durationMs, latestObservedTs - dataset.run.startTs, 0),
    },
  };

  return {
    dataset: {
      ...nextDataset,
      run: {
        ...nextDataset.run,
        summaryMetrics: calculateSummaryMetrics(nextDataset),
      },
    },
    connection: frame.connection ?? "live",
  };
}
