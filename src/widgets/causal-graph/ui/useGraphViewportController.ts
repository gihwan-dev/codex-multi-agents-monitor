import { useId, useRef } from "react";
import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
} from "../../../entities/run";
import { createGraphScrollHandler } from "./graphScrollHandler";
import { useGraphViewportEffects } from "./graphViewportEffects";
import type { buildGraphViewportSnapshot } from "./graphViewportSnapshot";
import type { useGraphViewportState } from "./useGraphViewportState";

interface UseGraphViewportControllerOptions {
  followLive: boolean;
  graphSnapshot: ReturnType<typeof buildGraphViewportSnapshot>;
  laneHeaderHeightOverride?: number;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  runTraceId: string;
  scene: GraphSceneModel;
  selectionNavigationRequestId: number;
  selectionNavigationRunId: string | null;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
  viewportState: ReturnType<typeof useGraphViewportState>;
}

export function useGraphViewportController({
  followLive,
  graphSnapshot,
  laneHeaderHeightOverride,
  liveMode,
  onPauseFollowLive,
  runTraceId,
  scene,
  selectionNavigationRequestId,
  selectionNavigationRunId,
  selectionRevealTarget,
  viewportState,
}: UseGraphViewportControllerOptions) {
  const followScrollTargetRef = useRef<{ top: number; left: number } | null>(null);
  const lastHandledNavigationRequestIdRef = useRef(0);

  useGraphViewportEffects({
    availableCanvasHeight: viewportState.availableCanvasHeight,
    followLive,
    followScrollTargetRef,
    lastHandledNavigationRequestIdRef,
    latestVisibleEventId: scene.latestVisibleEventId,
    layout: graphSnapshot.layout,
    liveMode,
    renderedContentHeight: graphSnapshot.renderedContentHeight,
    runTraceId,
    scheduleScrollTopUpdate: viewportState.scheduleScrollTopUpdate,
    scrollRef: viewportState.scrollRef,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
    stickyTop: laneHeaderHeightOverride ?? viewportState.laneHeaderHeight,
  });

  return {
    handleScroll: createGraphScrollHandler({
      followLive,
      followScrollTargetRef,
      laneHeaderHeight: viewportState.laneHeaderHeight,
      laneHeaderHeightOverride,
      laneStripRef: viewportState.laneStripRef,
      latestVisibleEventId: scene.latestVisibleEventId,
      layout: graphSnapshot.layout,
      liveMode,
      onPauseFollowLive,
      renderedContentHeight: graphSnapshot.renderedContentHeight,
      scheduleScrollTopUpdate: viewportState.scheduleScrollTopUpdate,
      scrollRef: viewportState.scrollRef,
    }),
    routeMarkerId: useId(),
  };
}
