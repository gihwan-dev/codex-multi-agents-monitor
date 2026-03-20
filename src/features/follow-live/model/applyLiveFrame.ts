import {
  calculateSummaryMetrics,
  type LiveConnection,
  type LiveWatchFrame,
  type RunDataset,
} from "../../../entities/run";

interface LiveWatchSnapshot {
  dataset: RunDataset;
  connection: Exclude<LiveConnection, "paused">;
}

export function applyLiveFrame(dataset: RunDataset, frame: LiveWatchFrame): LiveWatchSnapshot {
  const events = [...dataset.events, ...frame.events];
  const runStatus = frame.status ?? dataset.run.status;
  const lastEvent = frame.events.length ? frame.events[frame.events.length - 1] : null;
  const nextDataset: RunDataset = {
    ...dataset,
    events,
    run: {
      ...dataset.run,
      status: runStatus,
      endTs: frame.status === "done" ? lastEvent?.endTs ?? dataset.run.endTs : null,
      durationMs:
        (lastEvent?.endTs ?? dataset.run.endTs ?? dataset.run.startTs) - dataset.run.startTs,
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
