import {
  type Dispatch,
  type MutableRefObject,
  startTransition,
  useEffectEvent,
  useRef,
} from "react";
import type { RunDataset } from "../../../entities/run";
import type { MonitorAction, MonitorState } from "./state";

export interface MonitorRequestRefs {
  recentSnapshotRequestIdRef: MutableRefObject<number>;
  archiveIndexRequestIdRef: MutableRefObject<number>;
  archiveSnapshotRequestIdRef: MutableRefObject<number>;
}

type SnapshotRequestActionType =
  | "begin-recent-snapshot-request"
  | "begin-archived-snapshot-request";

interface ActivateCachedDatasetOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  filePath: string;
}

interface BeginSnapshotRequestOptions {
  requestIdRef: MutableRefObject<number>;
  filePath: string;
  dispatch: Dispatch<MonitorAction>;
  type: SnapshotRequestActionType;
}

interface ResolveSnapshotRequestOptions {
  dispatch: Dispatch<MonitorAction>;
  requestId: number;
  filePath: string;
  dataset: RunDataset | null;
  beginType: "begin-recent-snapshot-build" | "begin-archived-snapshot-build";
  resolveType:
    | "resolve-recent-snapshot-request"
    | "resolve-archived-snapshot-request";
  finishType:
    | "finish-recent-snapshot-request"
    | "finish-archived-snapshot-request";
}

export function useMonitorRequestRefs(): MonitorRequestRefs {
  return {
    recentSnapshotRequestIdRef: useRef(0),
    archiveIndexRequestIdRef: useRef(0),
    archiveSnapshotRequestIdRef: useRef(0),
  };
}

export function activateCachedDataset(options: ActivateCachedDatasetOptions) {
  const { state, dispatch, filePath } = options;
  const cachedDataset = state.hydratedDatasetsByFilePath[filePath];
  if (!cachedDataset) {
    return false;
  }

  dispatch({ type: "set-active-run", traceId: cachedDataset.run.traceId });
  return true;
}

export function beginSnapshotRequest(options: BeginSnapshotRequestOptions) {
  const { requestIdRef, filePath, dispatch, type } = options;
  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;
  dispatch({ type, requestId, filePath });
  return requestId;
}

export function resolveSnapshotRequest(options: ResolveSnapshotRequestOptions) {
  const { dispatch, requestId, filePath, dataset, beginType, resolveType, finishType } =
    options;
  if (!dataset) {
    dispatch({ type: finishType, requestId });
    return;
  }

  dispatch({
    type: beginType,
    requestId,
    filePath,
  });
  startTransition(() => {
    dispatch({
      type: resolveType,
      requestId,
      filePath,
      dataset,
    });
  });
}

export function useCancelPendingSelectionLoad(
  options: {
    dispatch: Dispatch<MonitorAction>;
  } & Pick<
    MonitorRequestRefs,
    "recentSnapshotRequestIdRef" | "archiveSnapshotRequestIdRef"
  >,
) {
  const {
    dispatch,
    recentSnapshotRequestIdRef,
    archiveSnapshotRequestIdRef,
  } = options;

  return useEffectEvent(() => {
    const nextRecentRequestId = recentSnapshotRequestIdRef.current + 1;
    recentSnapshotRequestIdRef.current = nextRecentRequestId;
    dispatch({
      type: "cancel-recent-snapshot-request",
      requestId: nextRecentRequestId,
    });

    const nextArchivedRequestId = archiveSnapshotRequestIdRef.current + 1;
    archiveSnapshotRequestIdRef.current = nextArchivedRequestId;
    dispatch({
      type: "cancel-archived-snapshot-request",
      requestId: nextArchivedRequestId,
    });
  });
}
