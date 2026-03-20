import type { RunDataset } from "../../../../entities/run";
import type { LiveConnection, MonitorState } from "./types";

export function buildConnectionMap(datasets: RunDataset[]) {
  return Object.fromEntries(
    datasets
      .filter((dataset) => dataset.run.liveMode === "live")
      .map((dataset) => [
        dataset.run.traceId,
        resolveDatasetLiveConnection(dataset),
      ]),
  ) as Record<string, LiveConnection>;
}

export function updateLiveConnectionMap(
  liveConnectionByRunId: MonitorState["liveConnectionByRunId"],
  traceId: string,
  dataset: RunDataset,
  followLive: boolean,
  nextConnection?: Exclude<LiveConnection, "paused">,
) {
  return {
    ...liveConnectionByRunId,
    [traceId]: resolveVisibleLiveConnection(
      dataset,
      followLive,
      liveConnectionByRunId[traceId],
      nextConnection,
    ),
  };
}

function resolveDatasetLiveConnection(
  dataset: RunDataset,
): Exclude<LiveConnection, "paused"> {
  if (dataset.run.status === "stale") {
    return "stale";
  }
  if (dataset.run.status === "disconnected") {
    return "disconnected";
  }
  return "live";
}

function resolveVisibleLiveConnection(
  dataset: RunDataset,
  followLive: boolean,
  currentConnection?: LiveConnection,
  nextConnection?: Exclude<LiveConnection, "paused">,
): LiveConnection {
  const resolvedConnection =
    nextConnection ??
    (currentConnection && currentConnection !== "paused"
      ? currentConnection
      : resolveDatasetLiveConnection(dataset));

  if (resolvedConnection !== "live") {
    return resolvedConnection;
  }

  return followLive ? "live" : "paused";
}
