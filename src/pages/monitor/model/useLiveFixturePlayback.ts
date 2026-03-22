import { type Dispatch, useEffect } from "react";
import { LIVE_FIXTURE_FRAMES } from "../../../entities/run";
import type { MonitorAction, MonitorState } from "./state";
import { LIVE_FIXTURE_TRACE_ID } from "./state";

interface UseLiveFixturePlaybackOptions {
  datasets: MonitorState["datasets"];
  appliedLiveFrames: number;
  dispatch: Dispatch<MonitorAction>;
}

export function useLiveFixturePlayback({
  datasets,
  appliedLiveFrames,
  dispatch,
}: UseLiveFixturePlaybackOptions) {
  useEffect(() => {
    const liveFixtureRun = datasets.find(
      (item) => item.run.traceId === LIVE_FIXTURE_TRACE_ID,
    );
    if (!liveFixtureRun || liveFixtureRun.run.liveMode !== "live") {
      return undefined;
    }

    if (appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
      return undefined;
    }

    const frame = LIVE_FIXTURE_FRAMES[appliedLiveFrames];
    const timeout = window.setTimeout(() => {
      dispatch({ type: "apply-live-frame" });
    }, frame.delayMs);

    return () => window.clearTimeout(timeout);
  }, [appliedLiveFrames, datasets, dispatch]);
}
