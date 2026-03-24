import { type RefObject } from "react";
import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  LiveMode,
} from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { useGraphFollowLiveScroll } from "./useGraphFollowLiveScroll";
import { useGraphSelectionRevealNavigation } from "./useGraphSelectionRevealNavigation";

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

export function useGraphViewportEffects(options: GraphViewportEffectsOptions) {
  const {
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
  } = options;
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
