import type { RunDataset } from "../../../../entities/run";
import { LIVE_FIXTURE_TRACE_ID } from "./helpers";
import type { MonitorState } from "./types";

export function findDatasetByTraceId(
  datasets: MonitorState["datasets"],
  traceId: string,
) {
  return datasets.find((item) => item.run.traceId === traceId) ?? null;
}

export function getActiveDataset(state: MonitorState) {
  return findDatasetByTraceId(state.datasets, state.activeRunId);
}

function getLatestEventId(dataset: RunDataset) {
  return dataset.events[dataset.events.length - 1]?.eventId ?? null;
}

function isActiveLiveFollowSelection(
  state: MonitorState,
  dataset: RunDataset | null,
  selection: MonitorState["selection"],
) {
  return Boolean(
    dataset &&
      dataset.run.liveMode === "live" &&
      (state.followLiveByRunId[dataset.run.traceId] ?? false) &&
      selection,
  );
}

export function shouldPauseFollowLiveForManualNavigation(
  state: MonitorState,
  selection: MonitorState["selection"],
) {
  const activeDataset = getActiveDataset(state);
  if (!isActiveLiveFollowSelection(state, activeDataset, selection) || !selection) {
    return false;
  }

  if (!activeDataset) {
    return false;
  }

  return selection.kind !== "event" || getLatestEventId(activeDataset) !== selection.id;
}

export function resolveFixtureFrameSelection(
  state: MonitorState,
  dataset: RunDataset,
) {
  const latestEventId = getLatestEventId(dataset);
  const followLive = state.followLiveByRunId[LIVE_FIXTURE_TRACE_ID] ?? false;
  if (!followLive || state.activeRunId !== LIVE_FIXTURE_TRACE_ID || !latestEventId) {
    return state.selection;
  }

  return { kind: "event" as const, id: latestEventId };
}
