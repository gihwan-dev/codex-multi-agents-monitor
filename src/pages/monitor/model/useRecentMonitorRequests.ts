import { type Dispatch, startTransition, useEffectEvent } from "react";
import { loadRecentSessionIndex, loadRecentSessionSnapshot } from "../../../entities/session-log";
import {
  activateCachedDataset,
  beginSnapshotRequest,
  type MonitorRequestRefs,
  resolveSnapshotRequest,
} from "./monitorRequestControllerShared";
import type { MonitorAction, MonitorState } from "./state";

interface UseRecentMonitorRequestsOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  cancelPendingSelectionLoad: () => void;
  recentSnapshotRequestIdRef: MonitorRequestRefs["recentSnapshotRequestIdRef"];
  recentLiveRefreshInFlightRef: MonitorRequestRefs["recentLiveRefreshInFlightRef"];
}

function requestRecentIndexFromSource(dispatch: Dispatch<MonitorAction>) {
  dispatch({ type: "begin-recent-index-request" });

  loadRecentSessionIndex().then((items) => {
    if (items === null) {
      dispatch({
        type: "finish-recent-index-request",
        error: "Recent sessions are unavailable right now.",
      });
      return;
    }

    startTransition(() => {
      dispatch({ type: "resolve-recent-index-request", items });
    });
  });
}

function requestRecentSnapshotFromSource(args: {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  cancelPendingSelectionLoad: () => void;
  recentSnapshotRequestIdRef: MonitorRequestRefs["recentSnapshotRequestIdRef"];
  filePath: string;
}) {
  args.cancelPendingSelectionLoad();
  if (activateCachedDataset({ state: args.state, dispatch: args.dispatch, filePath: args.filePath })) {
    return;
  }

  const requestId = beginSnapshotRequest({
    requestIdRef: args.recentSnapshotRequestIdRef,
    filePath: args.filePath,
    dispatch: args.dispatch,
    type: "begin-recent-snapshot-request",
  });

  loadRecentSessionSnapshot(args.filePath).then((dataset) => {
    resolveSnapshotRequest({
      dispatch: args.dispatch,
      requestId,
      filePath: args.filePath,
      dataset,
      beginType: "begin-recent-snapshot-build",
      resolveType: "resolve-recent-snapshot-request",
      finishType: "finish-recent-snapshot-request",
    });
  });
}

function refreshRecentSnapshotFromSource(args: {
  dispatch: Dispatch<MonitorAction>;
  recentLiveRefreshInFlightRef: MonitorRequestRefs["recentLiveRefreshInFlightRef"];
  filePath: string;
}) {
  if (args.recentLiveRefreshInFlightRef.current) {
    return;
  }

  args.recentLiveRefreshInFlightRef.current = true;
  loadRecentSessionSnapshot(args.filePath)
    .then((dataset) => {
      if (!dataset) {
        return;
      }

      startTransition(() => {
        args.dispatch({
          type: "refresh-recent-snapshot",
          filePath: args.filePath,
          dataset,
        });
      });
    })
    .finally(() => {
      args.recentLiveRefreshInFlightRef.current = false;
    });
}

export function useRecentMonitorRequests({
  state,
  dispatch,
  cancelPendingSelectionLoad,
  recentSnapshotRequestIdRef,
  recentLiveRefreshInFlightRef,
}: UseRecentMonitorRequestsOptions) {
  const requestRecentIndex = useEffectEvent(() => requestRecentIndexFromSource(dispatch));
  const requestRecentSnapshot = useEffectEvent((filePath: string) =>
    requestRecentSnapshotFromSource({
      state,
      dispatch,
      cancelPendingSelectionLoad,
      recentSnapshotRequestIdRef,
      filePath,
    }),
  );
  const refreshRecentSnapshot = useEffectEvent((filePath: string) =>
    refreshRecentSnapshotFromSource({
      dispatch,
      recentLiveRefreshInFlightRef,
      filePath,
    }),
  );

  return {
    requestRecentIndex,
    requestRecentSnapshot,
    refreshRecentSnapshot,
  };
}
