import {
  beginArchivedIndexRequest,
  beginArchivedSnapshotRequest,
  finishArchivedIndexRequest,
  finishArchivedSnapshotRequest,
  resolveArchivedIndexRequest,
  resolveArchivedSnapshotRequest,
} from "./archiveRequestState";
import {
  applyFixtureFrameState,
  importDatasetState,
  replaceDatasetsState,
  setActiveRunState,
  setFilterState,
  setFollowLiveState,
  toggleFollowLiveState,
  toggleGapState,
} from "./datasetState";
import type { MonitorAction, MonitorState } from "./types";

export function monitorStateReducer(
  state: MonitorState,
  action: MonitorAction,
): MonitorState {
  switch (action.type) {
    case "set-active-run":
      return setActiveRunState(state, action.traceId);
    case "set-selection":
      return { ...state, selection: action.selection };
    case "set-drawer-tab":
      return {
        ...state,
        drawerTab: action.tab,
        drawerOpen: action.open ?? state.drawerOpen,
      };
    case "set-drawer-open":
      return { ...state, drawerOpen: action.open };
    case "toggle-inspector":
      return { ...state, inspectorOpen: !state.inspectorOpen };
    case "toggle-follow-live":
      return toggleFollowLiveState(state, action.traceId);
    case "set-follow-live":
      return setFollowLiveState(state, action.traceId, action.value);
    case "set-filter":
      return setFilterState(state, action.traceId, action.key, action.value);
    case "toggle-gap":
      return toggleGapState(state, action.traceId, action.gapId);
    case "set-rail-width":
      return { ...state, railWidth: action.width };
    case "set-inspector-width":
      return { ...state, inspectorWidth: action.width };
    case "set-import-text":
      return { ...state, importText: action.value };
    case "set-allow-raw":
      return { ...state, allowRawImport: action.value };
    case "set-no-raw":
      return { ...state, noRawStorage: action.value };
    case "set-export-text":
      return {
        ...state,
        exportText: action.value,
        drawerTab: "log",
        drawerOpen: action.open ?? state.drawerOpen,
      };
    case "toggle-shortcuts":
      return { ...state, shortcutHelpOpen: !state.shortcutHelpOpen };
    case "import-dataset":
      return importDatasetState(state, action.dataset);
    case "replace-datasets":
      return replaceDatasetsState(state, action.datasets);
    case "apply-live-frame":
      return applyFixtureFrameState(state);
    case "begin-archived-index-request":
      return beginArchivedIndexRequest(state, action.requestId);
    case "resolve-archived-index-request":
      return resolveArchivedIndexRequest(
        state,
        action.requestId,
        action.result,
        action.append,
      );
    case "finish-archived-index-request":
      return finishArchivedIndexRequest(state, action.requestId, action.error);
    case "begin-archived-snapshot-request":
      return beginArchivedSnapshotRequest(state, action.requestId);
    case "resolve-archived-snapshot-request":
      return resolveArchivedSnapshotRequest(state, action.requestId, action.dataset);
    case "finish-archived-snapshot-request":
      return finishArchivedSnapshotRequest(state, action.requestId);
    case "set-archived-search":
      return { ...state, archivedSearch: action.value };
    case "toggle-archive-section":
      return { ...state, archiveSectionOpen: !state.archiveSectionOpen };
    default:
      return state;
  }
}
