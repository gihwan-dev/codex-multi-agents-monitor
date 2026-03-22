import { type Dispatch, startTransition, useEffectEvent, useRef } from "react";
import type { RunDataset } from "../../../entities/run";
import {
  loadArchivedSessionIndex,
  loadArchivedSessionSnapshot,
  loadRecentSessionIndex,
  loadRecentSessionSnapshot,
} from "../../../entities/session-log";
import { ARCHIVE_PAGE_SIZE, type MonitorAction, type MonitorState } from "./state";

interface UseMonitorRequestControllerOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
}

function toOptionalArchiveSearch(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

export function useMonitorRequestController({
  state,
  dispatch,
}: UseMonitorRequestControllerOptions) {
  const recentSnapshotRequestIdRef = useRef(0);
  const archiveIndexRequestIdRef = useRef(0);
  const archiveSnapshotRequestIdRef = useRef(0);

  const cancelPendingSelectionLoad = useEffectEvent(() => {
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

  const requestRecentIndex = useEffectEvent(() => {
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
  });

  const requestRecentSnapshot = useEffectEvent((filePath: string) => {
    cancelPendingSelectionLoad();

    const cachedDataset = state.hydratedDatasetsByFilePath[filePath];
    if (cachedDataset) {
      dispatch({ type: "set-active-run", traceId: cachedDataset.run.traceId });
      return;
    }

    const requestId = recentSnapshotRequestIdRef.current + 1;
    recentSnapshotRequestIdRef.current = requestId;
    dispatch({ type: "begin-recent-snapshot-request", requestId, filePath });

    loadRecentSessionSnapshot(filePath).then((dataset) => {
      if (!dataset) {
        dispatch({ type: "finish-recent-snapshot-request", requestId });
        return;
      }

      dispatch({
        type: "begin-recent-snapshot-build",
        requestId,
        filePath,
      });
      startTransition(() => {
        dispatch({
          type: "resolve-recent-snapshot-request",
          requestId,
          filePath,
          dataset,
        });
      });
    });
  });

  const requestArchiveIndex = useEffectEvent(
    (offset: number, append: boolean, search?: string) => {
      const requestId = archiveIndexRequestIdRef.current + 1;
      archiveIndexRequestIdRef.current = requestId;
      dispatch({ type: "begin-archived-index-request", requestId });

      loadArchivedSessionIndex(offset, ARCHIVE_PAGE_SIZE, search).then((result) => {
        if (!result) {
          dispatch({
            type: "finish-archived-index-request",
            requestId,
            error: "Archive sessions are unavailable right now.",
          });
          return;
        }

        startTransition(() => {
          dispatch({
            type: "resolve-archived-index-request",
            requestId,
            result,
            append,
          });
        });
      });
    },
  );

  const loadArchiveIndex = useEffectEvent((append: boolean) => {
    const offset = append ? state.archivedIndex.length : 0;
    requestArchiveIndex(offset, append, toOptionalArchiveSearch(state.archivedSearch));
  });

  const searchArchive = useEffectEvent((query: string) => {
    dispatch({ type: "set-archived-search", value: query });
    requestArchiveIndex(0, false, toOptionalArchiveSearch(query));
  });

  const hydrateArchivedDataset = useEffectEvent(
    (requestId: number, filePath: string, dataset: RunDataset | null) => {
      if (!dataset) {
        dispatch({ type: "finish-archived-snapshot-request", requestId });
        return;
      }

      dispatch({
        type: "begin-archived-snapshot-build",
        requestId,
        filePath,
      });
      startTransition(() => {
        dispatch({
          type: "resolve-archived-snapshot-request",
          requestId,
          filePath,
          dataset,
        });
      });
    },
  );

  const selectArchivedSession = useEffectEvent((filePath: string) => {
    cancelPendingSelectionLoad();

    const cachedDataset = state.hydratedDatasetsByFilePath[filePath];
    if (cachedDataset) {
      dispatch({ type: "set-active-run", traceId: cachedDataset.run.traceId });
      return;
    }

    const requestId = archiveSnapshotRequestIdRef.current + 1;
    archiveSnapshotRequestIdRef.current = requestId;
    dispatch({
      type: "begin-archived-snapshot-request",
      requestId,
      filePath,
    });

    loadArchivedSessionSnapshot(filePath)
      .then((dataset) => {
        hydrateArchivedDataset(requestId, filePath, dataset);
      })
      .catch(() => {
        dispatch({ type: "finish-archived-snapshot-request", requestId });
      });
  });

  return {
    cancelPendingSelectionLoad,
    loadArchiveIndex,
    requestArchiveIndex,
    requestRecentIndex,
    requestRecentSnapshot,
    searchArchive,
    selectArchivedSession,
  };
}
