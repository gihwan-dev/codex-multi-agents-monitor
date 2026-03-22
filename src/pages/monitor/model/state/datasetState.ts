import { LIVE_FIXTURE_FRAMES } from "../../../../entities/run/testing";
import { applyLiveFrame } from "../../../../features/follow-live";
import {
  buildCollapsedGapIds,
  buildDatasetActivationPatch,
  buildFollowLiveMap,
  defaultSelectionForDataset,
  LIVE_FIXTURE_TRACE_ID,
  resolveDatasetDrawerTab,
  toggleGapIds,
  upsertDataset,
} from "./helpers";
import { buildConnectionMap, updateLiveConnectionMap } from "./liveConnection";
import type { MonitorState } from "./types";

export function setActiveRunState(state: MonitorState, traceId: string): MonitorState {
  const dataset = state.datasets.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    return {
      ...state,
      activeRunId: traceId,
      selection: null,
    };
  }

  return {
    ...state,
    activeRunId: traceId,
    selection: defaultSelectionForDataset(dataset),
    ...resolveDatasetDrawerTab(state, dataset),
  };
}

export function toggleFollowLiveState(
  state: MonitorState,
  traceId: string,
): MonitorState {
  const dataset = state.datasets.find((item) => item.run.traceId === traceId);
  if (!dataset || dataset.run.liveMode !== "live") {
    return state;
  }

  const nextFollow = !(state.followLiveByRunId[traceId] ?? false);
  return {
    ...state,
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [traceId]: nextFollow,
    },
    liveConnectionByRunId: updateLiveConnectionMap(
      state.liveConnectionByRunId,
      traceId,
      dataset,
      nextFollow,
    ),
  };
}

export function setFollowLiveState(
  state: MonitorState,
  traceId: string,
  value: boolean,
): MonitorState {
  const dataset = state.datasets.find((item) => item.run.traceId === traceId);
  return {
    ...state,
    followLiveByRunId: {
      ...state.followLiveByRunId,
      [traceId]: value,
    },
    liveConnectionByRunId: dataset
      ? updateLiveConnectionMap(
          state.liveConnectionByRunId,
          traceId,
          dataset,
          value,
        )
      : {
          ...state.liveConnectionByRunId,
          [traceId]: value ? "live" : "paused",
        },
  };
}

export function toggleGapState(
  state: MonitorState,
  traceId: string,
  gapId: string,
): MonitorState {
  return {
    ...state,
    collapsedGapIds: {
      ...state.collapsedGapIds,
      [traceId]: toggleGapIds(state, traceId, gapId),
    },
  };
}

export function importDatasetState(
  state: MonitorState,
  dataset: MonitorState["datasets"][number],
): MonitorState {
  return {
    ...state,
    datasets: upsertDataset(state, dataset),
    ...buildDatasetActivationPatch(state, dataset),
    drawerTab: "artifacts",
    drawerOpen: true,
  };
}

export function replaceDatasetsState(
  state: MonitorState,
  datasets: MonitorState["datasets"],
): MonitorState {
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
    collapsedGapIds: buildCollapsedGapIds(datasets),
    ...resolveDatasetDrawerTab(state, activeDataset),
    appliedLiveFrames: 0,
  };
}

export function applyFixtureFrameState(state: MonitorState): MonitorState {
  if (state.appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
    return state;
  }

  const traceId = LIVE_FIXTURE_TRACE_ID;
  const dataset = state.datasets.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    return state;
  }

  const snapshot = applyLiveFrame(dataset, LIVE_FIXTURE_FRAMES[state.appliedLiveFrames]);
  const latestEvent = snapshot.dataset.events[snapshot.dataset.events.length - 1];
  const followLive = state.followLiveByRunId[traceId] ?? false;

  return {
    ...state,
    datasets: state.datasets.map((item) =>
      item.run.traceId === traceId ? snapshot.dataset : item,
    ),
    liveConnectionByRunId: updateLiveConnectionMap(
      state.liveConnectionByRunId,
      traceId,
      snapshot.dataset,
      followLive,
      snapshot.connection,
    ),
    selection:
      followLive && state.activeRunId === traceId && latestEvent
        ? { kind: "event", id: latestEvent.eventId }
        : state.selection,
    appliedLiveFrames: state.appliedLiveFrames + 1,
  };
}
