import {
  beginArchivedIndexRequest,
  beginArchivedSnapshotBuild,
  beginArchivedSnapshotRequest,
  cancelArchivedSnapshotRequest,
  finishArchivedIndexRequest,
  finishArchivedSnapshotRequest,
  resolveArchivedIndexRequest,
  resolveArchivedSnapshotRequest,
} from "./archiveRequestState";
import {
  applyFixtureFrameState,
  importDatasetState,
  navigateSelectionState,
  replaceDatasetsState,
  setActiveRunState,
  setFollowLiveState,
  toggleFollowLiveState,
  toggleGapState,
} from "./datasetState";
import {
  applyRecentLiveUpdate,
  refreshRecentSnapshot,
} from "./recentLiveUpdateState";
import {
  beginRecentIndexRequest,
  beginRecentSnapshotBuild,
  beginRecentSnapshotRequest,
  cancelRecentSnapshotRequest,
  finishRecentIndexRequest,
  finishRecentSnapshotRequest,
  resolveRecentIndexRequest,
  resolveRecentSnapshotRequest,
} from "./recentRequestState";
import type { MonitorAction, MonitorState } from "./types";

type ActionByType<Type extends MonitorAction["type"]> = Extract<
  MonitorAction,
  { type: Type }
>;

type MonitorActionHandlerMap = {
  [Type in MonitorAction["type"]]: (
    state: MonitorState,
    action: ActionByType<Type>,
  ) => MonitorState;
};

export const monitorActionHandlers: MonitorActionHandlerMap = {
  "set-active-run": (state, action) => setActiveRunState(state, action.traceId),
  "set-selection": (state, action) => ({ ...state, selection: action.selection }),
  "navigate-selection": (state, action) => navigateSelectionState(state, action.selection),
  "set-drawer-tab": (state, action) => ({
    ...state,
    drawerTab: action.tab,
    drawerOpen: action.open ?? state.drawerOpen,
  }),
  "set-drawer-open": (state, action) => ({ ...state, drawerOpen: action.open }),
  "toggle-follow-live": (state, action) => toggleFollowLiveState(state, action.traceId),
  "set-follow-live": (state, action) =>
    setFollowLiveState(state, action.traceId, action.value),
  "toggle-gap": (state, action) => toggleGapState(state, action.traceId, action.gapId),
  "set-rail-width": (state, action) => ({ ...state, railWidth: action.width }),
  "set-inspector-width": (state, action) => ({ ...state, inspectorWidth: action.width }),
  "set-import-text": (state, action) => ({ ...state, importText: action.value }),
  "set-allow-raw": (state, action) => ({ ...state, allowRawImport: action.value }),
  "set-no-raw": (state, action) => ({ ...state, noRawStorage: action.value }),
  "set-export-text": (state, action) => ({
    ...state,
    exportText: action.value,
    drawerTab: "log",
    drawerOpen: action.open ?? state.drawerOpen,
  }),
  "toggle-shortcuts": (state) => ({ ...state, shortcutHelpOpen: !state.shortcutHelpOpen }),
  "import-dataset": (state, action) => importDatasetState(state, action.dataset),
  "replace-datasets": (state, action) => replaceDatasetsState(state, action.datasets),
  "begin-recent-index-request": (state) => beginRecentIndexRequest(state),
  "resolve-recent-index-request": (state, action) =>
    resolveRecentIndexRequest(state, action.items),
  "finish-recent-index-request": (state, action) =>
    finishRecentIndexRequest(state, action.error),
  "begin-recent-snapshot-request": (state, action) =>
    beginRecentSnapshotRequest(state, action.requestId, action.filePath),
  "begin-recent-snapshot-build": (state, action) =>
    beginRecentSnapshotBuild(state, action.requestId, action.filePath),
  "resolve-recent-snapshot-request": (state, action) =>
    resolveRecentSnapshotRequest(
      state,
      action.requestId,
      action.filePath,
      action.dataset,
    ),
  "refresh-recent-snapshot": (state, action) =>
    refreshRecentSnapshot(state, action.filePath, action.dataset),
  "apply-recent-live-update": (state, action) =>
    applyRecentLiveUpdate({
      state,
      filePath: action.filePath,
      connection: action.connection,
      dataset: action.dataset,
    }),
  "cancel-recent-snapshot-request": (state, action) =>
    cancelRecentSnapshotRequest(state, action.requestId),
  "finish-recent-snapshot-request": (state, action) =>
    finishRecentSnapshotRequest(state, action.requestId),
  "apply-live-frame": (state) => applyFixtureFrameState(state),
  "begin-archived-index-request": (state, action) =>
    beginArchivedIndexRequest(state, action.requestId),
  "resolve-archived-index-request": (state, action) =>
    resolveArchivedIndexRequest({
      state,
      requestId: action.requestId,
      result: action.result,
      append: action.append,
    }),
  "finish-archived-index-request": (state, action) =>
    finishArchivedIndexRequest(state, action.requestId, action.error),
  "begin-archived-snapshot-request": (state, action) =>
    beginArchivedSnapshotRequest(state, action.requestId, action.filePath),
  "begin-archived-snapshot-build": (state, action) =>
    beginArchivedSnapshotBuild(state, action.requestId, action.filePath),
  "resolve-archived-snapshot-request": (state, action) =>
    resolveArchivedSnapshotRequest({
      state,
      requestId: action.requestId,
      filePath: action.filePath,
      dataset: action.dataset,
    }),
  "cancel-archived-snapshot-request": (state, action) =>
    cancelArchivedSnapshotRequest(state, action.requestId),
  "finish-archived-snapshot-request": (state, action) =>
    finishArchivedSnapshotRequest(state, action.requestId),
  "set-archived-search": (state, action) => ({ ...state, archivedSearch: action.value }),
  "toggle-archive-section": (state) => ({
    ...state,
    archiveSectionOpen: !state.archiveSectionOpen,
  }),
};
