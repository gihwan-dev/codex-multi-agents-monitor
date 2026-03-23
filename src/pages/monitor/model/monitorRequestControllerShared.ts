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
  recentLiveRefreshInFlightRef: MutableRefObject<boolean>;
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
    recentLiveRefreshInFlightRef: useRef(false),
  };
}

export function activateCachedDataset({
  state,
  dispatch,
  filePath,
}: ActivateCachedDatasetOptions) {
  const cachedDataset = state.hydratedDatasetsByFilePath[filePath];
  if (!cachedDataset) {
    return false;
  }

  dispatch({ type: "set-active-run", traceId: cachedDataset.run.traceId });
  return true;
}

export function beginSnapshotRequest({
  requestIdRef,
  filePath,
  dispatch,
  type,
}: BeginSnapshotRequestOptions) {
  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;
  dispatch({ type, requestId, filePath });
  return requestId;
}

export function resolveSnapshotRequest({
  dispatch,
  requestId,
  filePath,
  dataset,
  beginType,
  resolveType,
  finishType,
}: ResolveSnapshotRequestOptions) {
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
  dispatch: Dispatch<MonitorAction>,
  {
    recentSnapshotRequestIdRef,
    archiveSnapshotRequestIdRef,
  }: Pick<
    MonitorRequestRefs,
    "recentSnapshotRequestIdRef" | "archiveSnapshotRequestIdRef"
  >,
) {
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
