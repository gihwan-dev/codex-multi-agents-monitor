import { LIVE_FIXTURE_FRAMES } from "../../../../entities/run";
import { applyLiveFrame } from "../../../../features/follow-live";
import { findDatasetByTraceId } from "./datasetStateShared";
import { LIVE_FIXTURE_TRACE_ID } from "./helpers";
import type { MonitorState } from "./types";

export function resolveFixtureFrameSnapshot(state: MonitorState) {
  if (state.appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
    return null;
  }

  const traceId = LIVE_FIXTURE_TRACE_ID;
  const dataset = findDatasetByTraceId(state.datasets, traceId);
  if (!dataset) {
    return null;
  }

  return {
    traceId,
    followLive: state.followLiveByRunId[traceId] ?? false,
    snapshot: applyLiveFrame(dataset, LIVE_FIXTURE_FRAMES[state.appliedLiveFrames]),
  };
}
