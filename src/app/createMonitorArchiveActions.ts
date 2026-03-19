import {
  type Dispatch,
  type MutableRefObject,
  startTransition,
} from "react";
import type { MonitorAction, MonitorState } from "./monitorState";
import { loadArchivedSessionSnapshot } from "./sessionLogLoader";

interface CreateMonitorArchiveActionsOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  requestArchiveIndex: (
    offset: number,
    append: boolean,
    search?: string,
  ) => void;
  archiveSnapshotRequestIdRef: MutableRefObject<number>;
}

export function createMonitorArchiveActions({
  state,
  dispatch,
  requestArchiveIndex,
  archiveSnapshotRequestIdRef,
}: CreateMonitorArchiveActionsOptions) {
  return {
    loadArchiveIndex(append: boolean) {
      const offset = append ? state.archivedIndex.length : 0;
      requestArchiveIndex(offset, append, state.archivedSearch || undefined);
    },
    searchArchive(query: string) {
      dispatch({ type: "set-archived-search", value: query });
      requestArchiveIndex(0, false, query || undefined);
    },
    selectArchivedSession(filePath: string) {
      const requestId = archiveSnapshotRequestIdRef.current + 1;
      archiveSnapshotRequestIdRef.current = requestId;
      dispatch({ type: "begin-archived-snapshot-request", requestId });

      loadArchivedSessionSnapshot(filePath).then((dataset) => {
        if (!dataset) {
          dispatch({ type: "finish-archived-snapshot-request", requestId });
          return;
        }

        startTransition(() => {
          dispatch({
            type: "resolve-archived-snapshot-request",
            requestId,
            dataset,
          });
        });
      });
    },
  };
}
