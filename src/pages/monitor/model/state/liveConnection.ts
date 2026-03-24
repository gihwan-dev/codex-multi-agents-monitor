import type { LiveConnection, RunDataset } from "../../../../entities/run";
import type { MonitorState } from "./types";

interface UpdateLiveConnectionMapOptions {
  liveConnectionByRunId: MonitorState["liveConnectionByRunId"];
  traceId: string;
  dataset: RunDataset;
  followLive: boolean;
  nextConnection?: Exclude<LiveConnection, "paused">;
}

interface ResolveVisibleLiveConnectionOptions {
  dataset: RunDataset;
  followLive: boolean;
  currentConnection?: LiveConnection;
  nextConnection?: Exclude<LiveConnection, "paused">;
}

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

export function updateLiveConnectionMap(options: UpdateLiveConnectionMapOptions) {
  const { liveConnectionByRunId, traceId, dataset, followLive, nextConnection } = options;
  return {
    ...liveConnectionByRunId,
    [traceId]: resolveVisibleLiveConnection({ dataset, followLive, currentConnection: liveConnectionByRunId[traceId], nextConnection }),
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
  options: ResolveVisibleLiveConnectionOptions,
): LiveConnection {
  const { dataset, followLive, currentConnection, nextConnection } = options;
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
