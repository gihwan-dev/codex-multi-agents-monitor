import { type Dispatch, startTransition, useEffectEvent } from "react";
import {
  buildDatasetFromSessionLogAsync,
  loadRecentSessionIndex,
  loadRecentSessionSnapshot,
  type RecentSessionLiveUpdate,
} from "../../../entities/session-log";
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

function applyRecentLiveUpdateFromSource(args: {
  dispatch: Dispatch<MonitorAction>;
  update: RecentSessionLiveUpdate;
}) {
  const { dispatch, update } = args;

  if (!update.snapshot) {
    startTransition(() => {
      dispatch({
        type: "apply-recent-live-update",
        filePath: update.filePath,
        connection: update.connection,
      });
    });
    return;
  }

  buildDatasetFromSessionLogAsync(update.snapshot).then((dataset) => {
    startTransition(() => {
      dispatch({
        type: "apply-recent-live-update",
        filePath: update.filePath,
        connection: update.connection,
        ...(dataset ? { dataset } : {}),
      });
    });
  });
}

function useRecentSnapshotRequester(options: UseRecentMonitorRequestsOptions) {
  const { state, dispatch, cancelPendingSelectionLoad, recentSnapshotRequestIdRef } = options;
  return useEffectEvent((filePath: string) =>
    requestRecentSnapshotFromSource({
      state,
      dispatch,
      cancelPendingSelectionLoad,
      recentSnapshotRequestIdRef,
      filePath,
    }),
  );
}

export function useRecentMonitorRequests(options: UseRecentMonitorRequestsOptions) {
  const { dispatch } = options;
  const requestRecentIndex = useEffectEvent(() => requestRecentIndexFromSource(dispatch));
  const requestRecentSnapshot = useRecentSnapshotRequester(options);
  const handleRecentLiveUpdate = useEffectEvent((update: RecentSessionLiveUpdate) =>
    applyRecentLiveUpdateFromSource({
      dispatch,
      update,
    }),
  );

  return {
    requestRecentIndex,
    requestRecentSnapshot,
    handleRecentLiveUpdate,
  };
}
