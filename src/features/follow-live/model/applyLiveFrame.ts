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

export function applyLiveFrame(dataset: RunDataset, frame: LiveWatchFrame): LiveWatchSnapshot {
  const events = [...dataset.events, ...frame.events];
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
