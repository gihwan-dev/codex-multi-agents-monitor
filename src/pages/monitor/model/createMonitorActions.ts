import type {
  Dispatch,
} from "react";
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
  loadArchiveIndex: (append: boolean) => void;
  searchArchive: (query: string) => void;
  selectArchivedSession: (filePath: string) => void;
  requestRecentSnapshot: (filePath: string) => void;
}

export function createMonitorActions({
  state,
  dispatch,
  activeDataset,
  activeFollowLive,
  loadArchiveIndex,
  searchArchive,
  selectArchivedSession,
  requestRecentSnapshot,
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

  return {
    ...viewActions,
    ...importExportActions,
    loadArchiveIndex,
    searchArchive,
    selectArchivedSession,
    selectRecentSession: requestRecentSnapshot,
  };
}
