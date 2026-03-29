import type { LiveConnection, RunDataset } from "../../../../entities/run";
import { resolveDatasetDrawerTab, upsertDataset } from "./helpers";
import { updateLiveConnectionMap } from "./liveConnection";
import { resolveSelectionAfterRecentRefresh } from "./recentRequestSelection";
import type { MonitorState } from "./types";

type TransportLiveConnection = Exclude<LiveConnection, "paused">;

interface ApplyRecentLiveUpdateOptions {
  state: MonitorState;
  filePath: string;
  connection: TransportLiveConnection;
  dataset?: RunDataset;
}

interface BuildRecentLiveStateOptions {
  state: MonitorState;
  filePath: string;
  connection?: TransportLiveConnection;
  dataset: RunDataset;
  refreshSelection: boolean;
}

function overlayLiveConnectionStatus(
  dataset: RunDataset,
  connection: TransportLiveConnection,
) {
  if (connection !== "stale" && connection !== "disconnected") {
    return dataset;
  }

  return {
    ...dataset,
    run: {
      ...dataset.run,
      status: connection,
    },
  };
}

function resolveRecentLiveDataset(options: ApplyRecentLiveUpdateOptions) {
  const { state, filePath, connection, dataset } = options;
  if (dataset) {
    return dataset;
  }

  const existingDataset = state.hydratedDatasetsByFilePath[filePath];
  return existingDataset
    ? overlayLiveConnectionStatus(existingDataset, connection)
    : null;
}

function buildRecentLiveState(options: BuildRecentLiveStateOptions) {
  const { state, filePath, connection, dataset, refreshSelection } = options;
  const nextFollowLive =
    dataset.run.liveMode === "live"
      ? (state.followLiveByRunId[dataset.run.traceId] ?? true)
      : false;
  const { [dataset.run.traceId]: _removedConnection, ...remainingConnections } =
    state.liveConnectionByRunId;

  return {
    hydratedDatasetsByFilePath: {
      ...state.hydratedDatasetsByFilePath,
      [filePath]: dataset,
    },
    datasets: upsertDataset(state, dataset),
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [dataset.run.traceId]: nextFollowLive,
    },
    liveConnectionByRunId:
      dataset.run.liveMode === "live"
        ? updateLiveConnectionMap({
            liveConnectionByRunId: state.liveConnectionByRunId,
            traceId: dataset.run.traceId,
            dataset,
            followLive: nextFollowLive,
            nextConnection: connection,
          })
        : remainingConnections,
    selection: refreshSelection
      ? resolveSelectionAfterRecentRefresh(state, dataset, nextFollowLive)
      : state.selection,
    ...(refreshSelection ? resolveDatasetDrawerTab(state, dataset) : {}),
  };
}

export function refreshRecentSnapshot(
  state: MonitorState,
  filePath: string,
  dataset: RunDataset,
): MonitorState {
  const nextState = buildRecentLiveState({
    state,
    filePath,
    dataset,
    refreshSelection: true,
  });

  return {
    ...state,
    ...nextState,
  };
}

export function applyRecentLiveUpdate(
  options: ApplyRecentLiveUpdateOptions,
): MonitorState {
  const nextDataset = resolveRecentLiveDataset(options);
  if (!nextDataset) {
    return options.state;
  }

  const nextState = buildRecentLiveState({
    state: options.state,
    filePath: options.filePath,
    connection: options.connection,
    dataset: nextDataset,
    refreshSelection: Boolean(options.dataset),
  });

  return {
    ...options.state,
    ...nextState,
  };
}
