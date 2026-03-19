import { LIVE_FIXTURE_FRAMES } from "../../features/fixtures";
import { applyLiveFrame } from "../../features/ingestion";
import {
  buildCollapsedGapIds,
  buildConnectionMap,
  buildDatasetActivationPatch,
  buildFilterMap,
  buildFollowLiveMap,
  createDefaultFilters,
  defaultSelectionForDataset,
  LIVE_FIXTURE_TRACE_ID,
  resolveDatasetDrawerTab,
  toggleGapIds,
  upsertDataset,
} from "./helpers";
import type { MonitorAction, MonitorState } from "./types";

function replaceDatasets(state: MonitorState, datasets: MonitorState["datasets"]) {
  if (!datasets.length) {
    return state;
  }

  const activeDataset =
    datasets.find((item) => item.run.traceId === state.activeRunId) ?? datasets[0];

  return {
    ...state,
    datasets,
    activeRunId: activeDataset.run.traceId,
    selection: defaultSelectionForDataset(activeDataset),
    followLiveByRunId: buildFollowLiveMap(datasets),
    liveConnectionByRunId: buildConnectionMap(datasets),
    filtersByRunId: buildFilterMap(datasets),
    collapsedGapIds: buildCollapsedGapIds(datasets),
    ...resolveDatasetDrawerTab(state, activeDataset),
    appliedLiveFrames: 0,
  };
}

function applyFixtureFrame(state: MonitorState) {
  if (state.appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
    return state;
  }

  const dataset = state.datasets.find(
    (item) => item.run.traceId === LIVE_FIXTURE_TRACE_ID,
  );
  if (!dataset) {
    return state;
  }

  const snapshot = applyLiveFrame(
    dataset,
    LIVE_FIXTURE_FRAMES[state.appliedLiveFrames],
  );
  const latestEvent = snapshot.dataset.events[snapshot.dataset.events.length - 1];

  return {
    ...state,
    datasets: state.datasets.map((item) =>
      item.run.traceId === LIVE_FIXTURE_TRACE_ID ? snapshot.dataset : item,
    ),
    liveConnectionByRunId: {
      ...state.liveConnectionByRunId,
      [LIVE_FIXTURE_TRACE_ID]: state.followLiveByRunId[LIVE_FIXTURE_TRACE_ID]
        ? snapshot.connection
        : ("paused" as const),
    },
    selection:
      state.followLiveByRunId[LIVE_FIXTURE_TRACE_ID] &&
      state.activeRunId === LIVE_FIXTURE_TRACE_ID &&
      latestEvent
        ? { kind: "event" as const, id: latestEvent.eventId }
        : state.selection,
    appliedLiveFrames: state.appliedLiveFrames + 1,
  };
}

export function monitorStateReducer(
  state: MonitorState,
  action: MonitorAction,
): MonitorState {
  switch (action.type) {
    case "set-active-run": {
      const dataset = state.datasets.find((item) => item.run.traceId === action.traceId);
      if (!dataset) {
        return {
          ...state,
          activeRunId: action.traceId,
          selection: null,
        };
      }

      return {
        ...state,
        activeRunId: action.traceId,
        selection: defaultSelectionForDataset(dataset),
        ...resolveDatasetDrawerTab(state, dataset),
      };
    }
    case "set-selection":
      return { ...state, selection: action.selection };
    case "set-drawer-tab":
      return {
        ...state,
        drawerTab: action.tab,
        drawerOpen: action.open ?? state.drawerOpen,
      };
    case "toggle-drawer":
      return { ...state, drawerOpen: !state.drawerOpen };
    case "toggle-inspector":
      return { ...state, inspectorOpen: !state.inspectorOpen };
    case "toggle-follow-live": {
      const dataset = state.datasets.find((item) => item.run.traceId === action.traceId);
      if (!dataset || dataset.run.liveMode !== "live") {
        return state;
      }

      const nextFollow = !(state.followLiveByRunId[action.traceId] ?? false);
      return {
        ...state,
        followLiveByRunId: {
          ...state.followLiveByRunId,
          [action.traceId]: nextFollow,
        },
        liveConnectionByRunId: {
          ...state.liveConnectionByRunId,
          [action.traceId]: nextFollow ? "live" : "paused",
        },
      };
    }
    case "set-follow-live":
      return {
        ...state,
        followLiveByRunId: {
          ...state.followLiveByRunId,
          [action.traceId]: action.value,
        },
        liveConnectionByRunId: {
          ...state.liveConnectionByRunId,
          [action.traceId]: action.value ? "live" : "paused",
        },
      };
    case "set-filter":
      return {
        ...state,
        filtersByRunId: {
          ...state.filtersByRunId,
          [action.traceId]: {
            ...(state.filtersByRunId[action.traceId] ?? createDefaultFilters()),
            [action.key]: action.value,
          },
        },
      };
    case "toggle-gap":
      return {
        ...state,
        collapsedGapIds: {
          ...state.collapsedGapIds,
          [action.traceId]: toggleGapIds(state, action.traceId, action.gapId),
        },
      };
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
      return {
        ...state,
        datasets: upsertDataset(state, action.dataset),
        ...buildDatasetActivationPatch(state, action.dataset),
        drawerTab: "artifacts",
        drawerOpen: true,
      };
    case "replace-datasets":
      return replaceDatasets(state, action.datasets);
    case "apply-live-frame":
      return applyFixtureFrame(state);
    case "begin-archived-index-request":
      return {
        ...state,
        archivedIndexLoading: true,
        archivedIndexRequestId: action.requestId,
      };
    case "resolve-archived-index-request": {
      if (action.requestId !== state.archivedIndexRequestId) {
        return state;
      }

      return {
        ...state,
        archivedIndex: action.append
          ? [...state.archivedIndex, ...action.result.items]
          : action.result.items,
        archivedTotal: action.result.total,
        archivedHasMore: action.result.hasMore,
        archivedIndexLoading: false,
      };
    }
    case "finish-archived-index-request":
      return action.requestId === state.archivedIndexRequestId
        ? { ...state, archivedIndexLoading: false }
        : state;
    case "begin-archived-snapshot-request":
      return {
        ...state,
        archivedSnapshotLoading: true,
        archivedSnapshotRequestId: action.requestId,
      };
    case "resolve-archived-snapshot-request":
      if (action.requestId !== state.archivedSnapshotRequestId) {
        return state;
      }
      return {
        ...state,
        archivedSnapshotLoading: false,
        datasets: upsertDataset(state, action.dataset),
        ...buildDatasetActivationPatch(state, action.dataset),
      };
    case "finish-archived-snapshot-request":
      return action.requestId === state.archivedSnapshotRequestId
        ? { ...state, archivedSnapshotLoading: false }
        : state;
    case "set-archived-search":
      return { ...state, archivedSearch: action.value };
    case "toggle-archive-section":
      return { ...state, archiveSectionOpen: !state.archiveSectionOpen };
    default:
      return state;
  }
}
