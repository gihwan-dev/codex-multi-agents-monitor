import { type RefObject, useId, useRef } from "react";
import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
} from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { createGraphScrollHandler } from "./graphScrollHandler";
import type { buildGraphViewportSnapshot } from "./graphViewportSnapshot";
import { useGraphFollowLiveScroll } from "./useGraphFollowLiveScroll";
import { useGraphSelectionRevealNavigation } from "./useGraphSelectionRevealNavigation";
import type { useGraphViewportState } from "./useGraphViewportState";

interface GraphViewportEffectsOptions {
  availableCanvasHeight: number;
  followLive: boolean;
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>;
  lastHandledNavigationRequestIdRef: RefObject<number>;
  latestVisibleEventId: GraphSceneModel["latestVisibleEventId"];
  layout: GraphLayoutSnapshot;
  liveMode: LiveMode;
  renderedContentHeight: number;
  runTraceId: string;
  scheduleScrollTopUpdate: (nextScrollTop: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectionNavigationRequestId: number;
  selectionNavigationRunId: string | null;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
  stickyTop: number;
}

export function useGraphViewportEffects({
  availableCanvasHeight,
  followLive,
  followScrollTargetRef,
  lastHandledNavigationRequestIdRef,
  latestVisibleEventId,
  layout,
  liveMode,
  renderedContentHeight,
  runTraceId,
  scheduleScrollTopUpdate,
  scrollRef,
  selectionNavigationRequestId,
  selectionNavigationRunId,
  selectionRevealTarget,
  stickyTop,
}: GraphViewportEffectsOptions) {
  useGraphFollowLiveScroll({
    followLive,
    followScrollTargetRef,
    latestVisibleEventId,
    layout,
    liveMode,
    renderedContentHeight,
    scrollRef,
    stickyTop,
  });
  useGraphSelectionRevealNavigation({
    availableCanvasHeight,
    lastHandledNavigationRequestIdRef,
    layout,
    renderedContentHeight,
    runTraceId,
    scheduleScrollTopUpdate,
    scrollRef,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
  });
}

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
