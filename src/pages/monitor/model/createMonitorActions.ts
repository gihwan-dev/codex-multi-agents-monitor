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
  refreshRecentIndex: () => void;
  searchArchive: (query: string) => void;
  selectArchivedSession: (filePath: string) => void;
  requestRecentSnapshot: (filePath: string) => void;
}

function createRefreshSessionScoringAction(options: {
  archivedIndex: MonitorState["archivedIndex"];
  archiveSectionOpen: boolean;
  loadArchiveIndex: (append: boolean) => void;
  recentIndex: MonitorState["recentIndex"];
  refreshRecentIndex: () => void;
}) {
  const {
    archivedIndex,
    archiveSectionOpen,
    loadArchiveIndex,
    recentIndex,
    refreshRecentIndex,
  } = options;

  return (filePath: string) => {
    const inRecent = recentIndex.some((item) => item.filePath === filePath);
    const inArchived = archivedIndex.some((item) => item.filePath === filePath);

    if (inRecent) {
      refreshRecentIndex();
    }
    if (archiveSectionOpen || inArchived) {
      loadArchiveIndex(false);
    }
  };
}

function buildMonitorActionSlices(options: {
  activeDataset: MonitorState["datasets"][number] | null;
  activeFollowLive: boolean;
  dispatch: Dispatch<MonitorAction>;
  state: MonitorState;
}) {
  const importExportOptions = {
    importText: options.state.importText,
    allowRawImport: options.state.allowRawImport,
    noRawStorage: options.state.noRawStorage,
    dispatch: options.dispatch,
    activeDataset: options.activeDataset,
  };
  const viewOptions = {
    drawerOpen: options.state.drawerOpen,
    dispatch: options.dispatch,
    activeDataset: options.activeDataset,
    activeFollowLive: options.activeFollowLive,
  };

  return {
    importExportActions: createMonitorImportExportActions(importExportOptions),
    viewActions: createMonitorViewActions(viewOptions),
  };
}

export function createMonitorActions(options: CreateMonitorActionsOptions) {
  const {
    state,
    dispatch,
    activeDataset,
    activeFollowLive,
    loadArchiveIndex,
    refreshRecentIndex,
    searchArchive,
    selectArchivedSession,
    requestRecentSnapshot,
  } = options;
  const { importExportActions, viewActions } = buildMonitorActionSlices({
    activeDataset,
    activeFollowLive,
    dispatch,
    state,
  });
  const refreshSessionScoring = createRefreshSessionScoringAction({
    archivedIndex: state.archivedIndex,
    archiveSectionOpen: state.archiveSectionOpen,
    loadArchiveIndex,
    recentIndex: state.recentIndex,
    refreshRecentIndex,
  });

  return {
    ...viewActions,
    ...importExportActions,
    loadArchiveIndex,
    refreshSessionScoring,
    searchArchive,
    selectArchivedSession,
    selectRecentSession: requestRecentSnapshot,
  };
}
