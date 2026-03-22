import type {
  Dispatch,
  MutableRefObject,
} from "react";
import { createMonitorArchiveActions } from "./createMonitorArchiveActions";
import { createMonitorImportExportActions } from "./createMonitorImportExportActions";
import { createMonitorViewActions } from "./createMonitorViewActions";
import type {
  MonitorAction,
  MonitorState,
} from "./state";

interface CreateMonitorActionsOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
  activeDataset: MonitorState["datasets"][number] | null;
  activeFollowLive: boolean;
  requestRecentSnapshot: (filePath: string) => void;
  requestArchiveIndex: (
    offset: number,
    append: boolean,
    search?: string,
  ) => void;
  archiveSnapshotRequestIdRef: MutableRefObject<number>;
}

export function createMonitorActions({
  state,
  dispatch,
  activeDataset,
  activeFollowLive,
  requestRecentSnapshot,
  requestArchiveIndex,
  archiveSnapshotRequestIdRef,
}: CreateMonitorActionsOptions) {
  const viewActions = createMonitorViewActions({
    drawerOpen: state.drawerOpen,
    dispatch,
    activeDataset,
    activeFollowLive,
  });
  const importExportActions = createMonitorImportExportActions({
    importText: state.importText,
    allowRawImport: state.allowRawImport,
    noRawStorage: state.noRawStorage,
    dispatch,
    activeDataset,
  });
  const archiveActions = createMonitorArchiveActions({
    archivedIndexLength: state.archivedIndex.length,
    archivedSearch: state.archivedSearch,
    dispatch,
    requestArchiveIndex,
    archiveSnapshotRequestIdRef,
    hydratedDatasetsByFilePath: state.hydratedDatasetsByFilePath,
  });

  return {
    ...viewActions,
    ...importExportActions,
    ...archiveActions,
    selectRecentSession: requestRecentSnapshot,
  };
}
