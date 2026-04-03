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

interface RequestArchiveIndexFromSourceArgs {
  archiveIndexRequestIdRef: MonitorRequestRefs["archiveIndexRequestIdRef"];
  dispatch: Dispatch<MonitorAction>;
  offset: number;
  append: boolean;
  search?: string;
}

function toOptionalArchiveSearch(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function requestArchiveIndexFromSource(args: RequestArchiveIndexFromSourceArgs) {
  const requestId = args.archiveIndexRequestIdRef.current + 1;
  args.archiveIndexRequestIdRef.current = requestId;
  args.dispatch({ type: "begin-archived-index-request", requestId });

  loadArchivedSessionIndex(args.offset, ARCHIVE_PAGE_SIZE, args.search)
    .then((result) => {
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
    })
    .catch(() => {});
}

function useRequestArchiveIndexEvent(args: Pick<UseArchiveMonitorRequestsOptions, "archiveIndexRequestIdRef" | "dispatch">) {
  return useEffectEvent((offset: number, append: boolean, search?: string) =>
    requestArchiveIndexFromSource({
      archiveIndexRequestIdRef: args.archiveIndexRequestIdRef,
      dispatch: args.dispatch,
      offset,
      append,
      search,
    }),
  );
}

function useLoadArchiveIndexEvent(options: {
  archivedIndexLength: number;
  archivedSearch: string;
  requestArchiveIndex: ReturnType<typeof useRequestArchiveIndexEvent>;
}) {
  return useEffectEvent((append: boolean) => {
    const offset = append ? options.archivedIndexLength : 0;
    options.requestArchiveIndex(
      offset,
      append,
      toOptionalArchiveSearch(options.archivedSearch),
    );
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

function useArchiveIndexRequester(options: UseArchiveMonitorRequestsOptions) {
  const { archiveIndexRequestIdRef, dispatch, state } = options;
  const requestArchiveIndex = useRequestArchiveIndexEvent({
    archiveIndexRequestIdRef,
    dispatch,
  });
  const loadArchiveIndex = useLoadArchiveIndexEvent({
    archivedIndexLength: state.archivedIndex.length,
    archivedSearch: state.archivedSearch,
    requestArchiveIndex,
  });

  return {
    requestArchiveIndex,
    loadArchiveIndex,
  };
}

function useArchivedSessionSearch(dispatch: Dispatch<MonitorAction>, requestArchiveIndex: ReturnType<typeof useArchiveIndexRequester>["requestArchiveIndex"]) {
  return useEffectEvent((query: string) => {
    dispatch({ type: "set-archived-search", value: query });
    requestArchiveIndex(0, false, toOptionalArchiveSearch(query));
  });
}

function useArchivedSessionSelector(options: UseArchiveMonitorRequestsOptions) {
  const { state, dispatch, cancelPendingSelectionLoad, archiveSnapshotRequestIdRef } = options;
  return useEffectEvent((filePath: string) =>
    selectArchivedSessionFromSource({
      state,
      dispatch,
      cancelPendingSelectionLoad,
      archiveSnapshotRequestIdRef,
      filePath,
    }),
  );
}

export function useArchiveMonitorRequests(options: UseArchiveMonitorRequestsOptions) {
  const { dispatch } = options;
  const { requestArchiveIndex, loadArchiveIndex } = useArchiveIndexRequester(options);
  const searchArchive = useArchivedSessionSearch(dispatch, requestArchiveIndex);
  const selectArchivedSession = useArchivedSessionSelector(options);

  return {
    requestArchiveIndex,
    loadArchiveIndex,
    searchArchive,
    selectArchivedSession,
  };
}
