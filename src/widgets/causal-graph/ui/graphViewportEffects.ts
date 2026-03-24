import type { RefObject } from "react";
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
  useGraphFollowLiveScroll(readFollowLiveScrollOptions(options));
  useGraphSelectionRevealNavigation(readSelectionRevealOptions(options));
}

function readFollowLiveScrollOptions(options: GraphViewportEffectsOptions) {
  return {
    followLive: options.followLive,
    followScrollTargetRef: options.followScrollTargetRef,
    latestVisibleEventId: options.latestVisibleEventId,
    layout: options.layout,
    liveMode: options.liveMode,
    renderedContentHeight: options.renderedContentHeight,
    scrollRef: options.scrollRef,
    stickyTop: options.stickyTop,
  };
}

function readSelectionRevealOptions(options: GraphViewportEffectsOptions) {
  return {
    availableCanvasHeight: options.availableCanvasHeight,
    lastHandledNavigationRequestIdRef: options.lastHandledNavigationRequestIdRef,
    layout: options.layout,
    renderedContentHeight: options.renderedContentHeight,
    runTraceId: options.runTraceId,
    scheduleScrollTopUpdate: options.scheduleScrollTopUpdate,
    scrollRef: options.scrollRef,
    selectionNavigationRunId: options.selectionNavigationRunId,
    selectionNavigationRequestId: options.selectionNavigationRequestId,
    selectionRevealTarget: options.selectionRevealTarget,
  };
}
