import {
  type Dispatch,
  type MutableRefObject,
  startTransition,
} from "react";
import type { MonitorAction } from "./monitorState";
import { loadArchivedSessionSnapshot } from "./sessionLogLoader";

interface CreateMonitorArchiveActionsOptions {
  archivedIndexLength: number;
  archivedSearch: string;
  dispatch: Dispatch<MonitorAction>;
  requestArchiveIndex: (
    offset: number,
    append: boolean,
    search?: string,
  ) => void;
  archiveSnapshotRequestIdRef: MutableRefObject<number>;
}

function toOptionalSearch(value: string) {
  return value || undefined;
}

export function createMonitorArchiveActions({
  archivedIndexLength,
  archivedSearch,
  dispatch,
  requestArchiveIndex,
  archiveSnapshotRequestIdRef,
}: CreateMonitorArchiveActionsOptions) {
  function startSnapshotRequest() {
    const requestId = archiveSnapshotRequestIdRef.current + 1;
    archiveSnapshotRequestIdRef.current = requestId;
    dispatch({ type: "begin-archived-snapshot-request", requestId });
    return requestId;
  }

  function finishSnapshotRequest(requestId: number) {
    dispatch({ type: "finish-archived-snapshot-request", requestId });
  }

  return {
    loadArchiveIndex(append: boolean) {
      const offset = append ? archivedIndexLength : 0;
      requestArchiveIndex(offset, append, toOptionalSearch(archivedSearch));
    },
    searchArchive(query: string) {
      dispatch({ type: "set-archived-search", value: query });
      requestArchiveIndex(0, false, toOptionalSearch(query));
    },
    selectArchivedSession(filePath: string) {
      const requestId = startSnapshotRequest();

      loadArchivedSessionSnapshot(filePath)
        .then((dataset) => {
          if (!dataset) {
            finishSnapshotRequest(requestId);
            return;
          }

          startTransition(() => {
            dispatch({
              type: "resolve-archived-snapshot-request",
              requestId,
              dataset,
            });
          });
        })
        .catch(() => {
          finishSnapshotRequest(requestId);
        });
    },
  };
}
