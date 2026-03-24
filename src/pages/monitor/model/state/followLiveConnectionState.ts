import { updateLiveConnectionMap } from "./liveConnection";
import type { MonitorState } from "./types";

interface ResolveFollowLiveConnectionStateOptions {
  state: MonitorState;
  traceId: string;
  value: boolean;
  dataset: MonitorState["datasets"][number] | null | undefined;
}

export function resolveFollowLiveConnectionState(
  options: ResolveFollowLiveConnectionStateOptions,
): MonitorState["liveConnectionByRunId"] {
  const { state, traceId, value, dataset } = options;
  if (dataset) {
    return updateLiveConnectionMap({
      liveConnectionByRunId: state.liveConnectionByRunId,
      traceId,
      dataset,
      followLive: value,
    });
  }

  const fallbackConnection = value ? "live" : "paused";
  return {
    ...state.liveConnectionByRunId,
    [traceId]: fallbackConnection,
  };
}
