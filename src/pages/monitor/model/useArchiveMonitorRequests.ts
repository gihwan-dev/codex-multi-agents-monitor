import { type Dispatch, startTransition, useEffectEvent } from "react";
import {
  loadArchivedSessionIndex,
  loadArchivedSessionSnapshot,
} from "../../../entities/session-log";
import {
  activateCachedDataset,
  beginSnapshotRequest,
  type MonitorRequestRefs,
  resolveSnapshotRequest,
} from "./monitorRequestControllerShared";
import { ARCHIVE_PAGE_SIZE, type MonitorAction, type MonitorState } from "./state";

interface UseArchiveMonitorRequestsOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  cancelPendingSelectionLoad: () => void;
  archiveIndexRequestIdRef: MonitorRequestRefs["archiveIndexRequestIdRef"];
  archiveSnapshotRequestIdRef: MonitorRequestRefs["archiveSnapshotRequestIdRef"];
}

function toOptionalArchiveSearch(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function requestArchiveIndexFromSource(args: {
  archiveIndexRequestIdRef: MonitorRequestRefs["archiveIndexRequestIdRef"];
  dispatch: Dispatch<MonitorAction>;
  offset: number;
  append: boolean;
  search?: string;
}) {
  const requestId = args.archiveIndexRequestIdRef.current + 1;
  args.archiveIndexRequestIdRef.current = requestId;
  args.dispatch({ type: "begin-archived-index-request", requestId });

  loadArchivedSessionIndex(args.offset, ARCHIVE_PAGE_SIZE, args.search).then((result) => {
    if (!result) {
      args.dispatch({
        type: "finish-archived-index-request",
        requestId,
        error: "Archive sessions are unavailable right now.",
      });
      return;
    }

    startTransition(() => {
      args.dispatch({
        type: "resolve-archived-index-request",
        requestId,
        result,
        append: args.append,
      });
    });
  });
}

function selectArchivedSessionFromSource(args: {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  cancelPendingSelectionLoad: () => void;
  archiveSnapshotRequestIdRef: MonitorRequestRefs["archiveSnapshotRequestIdRef"];
  filePath: string;
}) {
  args.cancelPendingSelectionLoad();
  if (activateCachedDataset({ state: args.state, dispatch: args.dispatch, filePath: args.filePath })) {
    return;
  }

  const requestId = beginSnapshotRequest({
    requestIdRef: args.archiveSnapshotRequestIdRef,
    filePath: args.filePath,
    dispatch: args.dispatch,
    type: "begin-archived-snapshot-request",
  });

  loadArchivedSessionSnapshot(args.filePath)
    .then((dataset) => {
      resolveSnapshotRequest({
        dispatch: args.dispatch,
        requestId,
        filePath: args.filePath,
        dataset,
        beginType: "begin-archived-snapshot-build",
        resolveType: "resolve-archived-snapshot-request",
        finishType: "finish-archived-snapshot-request",
      });
    })
    .catch(() => {
      args.dispatch({ type: "finish-archived-snapshot-request", requestId });
    });
}

export function useArchiveMonitorRequests({
  state,
  dispatch,
  cancelPendingSelectionLoad,
  archiveIndexRequestIdRef,
  archiveSnapshotRequestIdRef,
}: UseArchiveMonitorRequestsOptions) {
  const requestArchiveIndex = useEffectEvent(
    (offset: number, append: boolean, search?: string) =>
      requestArchiveIndexFromSource({
        archiveIndexRequestIdRef,
        dispatch,
        offset,
        append,
        search,
      }),
  );

  const loadArchiveIndex = useEffectEvent((append: boolean) => {
    const offset = append ? state.archivedIndex.length : 0;
    requestArchiveIndex(offset, append, toOptionalArchiveSearch(state.archivedSearch));
  });

  const searchArchive = useEffectEvent((query: string) => {
    dispatch({ type: "set-archived-search", value: query });
    requestArchiveIndex(0, false, toOptionalArchiveSearch(query));
  });

  const selectArchivedSession = useEffectEvent((filePath: string) =>
    selectArchivedSessionFromSource({
      state,
      dispatch,
      cancelPendingSelectionLoad,
      archiveSnapshotRequestIdRef,
      filePath,
    }),
  );

  return {
    requestArchiveIndex,
    loadArchiveIndex,
    searchArchive,
    selectArchivedSession,
  };
}
