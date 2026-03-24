import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { GraphSelectionRevealTarget, LiveMode } from "../../../entities/run";
import {
  isRevealRangeVisible,
  resolveSelectionRevealRange,
  resolveSelectionRevealScrollTop,
} from "../lib/graphSelectionReveal";
import { prefersReducedMotion } from "../lib/reducedMotion";
import {
  type GraphLayoutSnapshot,
  resolveFollowLiveScrollTarget,
  TIME_GUTTER,
} from "./graphLayout";

interface UseGraphScrollSyncOptions {
  availableCanvasHeight: number;
  followLive: boolean;
  laneHeaderHeight: number;
  laneHeaderHeightOverride?: number;
  laneStripRef: React.RefObject<HTMLDivElement | null>;
  latestVisibleEventId: string | null;
  layout: GraphLayoutSnapshot;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  renderedContentHeight: number;
  runTraceId: string;
  scheduleScrollTopUpdate: (nextScrollTop: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  selectionNavigationRequestId: number;
  selectionNavigationRunId: string | null;
  selectionRevealTarget: GraphSelectionRevealTarget | null;
}

export function useGraphScrollSync({
  availableCanvasHeight,
  followLive,
  laneHeaderHeight,
  laneHeaderHeightOverride,
  laneStripRef,
  latestVisibleEventId,
  layout,
  liveMode,
  onPauseFollowLive,
  renderedContentHeight,
  runTraceId,
  scheduleScrollTopUpdate,
  scrollRef,
  selectionNavigationRequestId,
  selectionNavigationRunId,
  selectionRevealTarget,
}: UseGraphScrollSyncOptions) {
  const followScrollTargetRef = useRef<{ top: number; left: number } | null>(null);
  const lastHandledNavigationRequestIdRef = useRef(0);
  const stickyTop = laneHeaderHeightOverride ?? laneHeaderHeight;

  useLayoutEffect(() => {
    if (!followLive || liveMode !== "live" || !latestVisibleEventId) {
      followScrollTargetRef.current = null;
      return;
    }

    const element = scrollRef.current;
    const eventLayout = layout.eventById.get(latestVisibleEventId);
    if (!element || !eventLayout) {
      return;
    }

    const nextViewportHeight = element.clientHeight;
    const nextViewportWidth = element.clientWidth;
    if (nextViewportHeight <= 0 || nextViewportWidth <= 0) {
      return;
    }

    const followTarget = resolveFollowLiveScrollTarget(eventLayout, {
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      viewportHeight: nextViewportHeight,
      viewportWidth: nextViewportWidth,
      stickyTop,
      stickyLeft: TIME_GUTTER,
      contentHeight: renderedContentHeight,
      contentWidth: layout.contentWidth,
    });

    const needsScroll =
      Math.abs(followTarget.top - element.scrollTop) > 1 ||
      Math.abs(followTarget.left - element.scrollLeft) > 1;
    if (!needsScroll) {
      followScrollTargetRef.current = null;
      return;
    }

    followScrollTargetRef.current = followTarget;
    element.scrollTo({
      top: followTarget.top,
      left: followTarget.left,
      behavior: "auto",
    });

    if (
      Math.abs(followTarget.top - element.scrollTop) <= 1 &&
      Math.abs(followTarget.left - element.scrollLeft) <= 1
    ) {
      followScrollTargetRef.current = null;
    }
  }, [
    followLive,
    latestVisibleEventId,
    layout,
    liveMode,
    renderedContentHeight,
    scrollRef,
    stickyTop,
  ]);

  useEffect(() => {
    if (
      selectionNavigationRequestId === 0 ||
      selectionNavigationRunId !== runTraceId ||
      selectionNavigationRequestId <= lastHandledNavigationRequestIdRef.current
    ) {
      return;
    }

    const element = scrollRef.current;
    if (!element || availableCanvasHeight <= 0) {
      return;
    }

    const revealRange = resolveSelectionRevealRange(selectionRevealTarget, layout);
    lastHandledNavigationRequestIdRef.current = selectionNavigationRequestId;
    if (!revealRange) {
      return;
    }

    const visibleTop = element.scrollTop;
    const visibleBottom = visibleTop + availableCanvasHeight;
    if (isRevealRangeVisible(revealRange, visibleTop, visibleBottom)) {
      return;
    }

    const nextScrollTop = resolveSelectionRevealScrollTop(
      revealRange,
      availableCanvasHeight,
      renderedContentHeight,
    );
    const behavior = prefersReducedMotion() ? "auto" : "smooth";

    element.scrollTo({
      top: nextScrollTop,
      behavior,
    });
    scheduleScrollTopUpdate(nextScrollTop);
  }, [
    availableCanvasHeight,
    layout,
    renderedContentHeight,
    runTraceId,
    scheduleScrollTopUpdate,
    scrollRef,
    selectionNavigationRunId,
    selectionNavigationRequestId,
    selectionRevealTarget,
  ]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const followTarget = followScrollTargetRef.current;
    if (followTarget) {
      const reachedFollowTarget =
        Math.abs(followTarget.top - element.scrollTop) <= 1 &&
        Math.abs(followTarget.left - element.scrollLeft) <= 1;
      if (reachedFollowTarget) {
        followScrollTargetRef.current = null;
      }
    } else if (followLive && liveMode === "live" && latestVisibleEventId) {
      const eventLayout = layout.eventById.get(latestVisibleEventId);
      if (eventLayout) {
        const nextStickyTop =
          laneHeaderHeightOverride ?? laneStripRef.current?.offsetHeight ?? laneHeaderHeight;
        if (element.clientHeight <= 0 || element.clientWidth <= 0) {
          return;
        }

        const followViewport = resolveFollowLiveScrollTarget(eventLayout, {
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          viewportHeight: element.clientHeight,
          viewportWidth: element.clientWidth,
          stickyTop: nextStickyTop,
          stickyLeft: TIME_GUTTER,
          contentHeight: renderedContentHeight,
          contentWidth: layout.contentWidth,
        });
        const latestEventInView =
          Math.abs(followViewport.top - element.scrollTop) <= 1 &&
          Math.abs(followViewport.left - element.scrollLeft) <= 1;
        if (!latestEventInView) {
          followScrollTargetRef.current = null;
          onPauseFollowLive();
        }
      } else {
        followScrollTargetRef.current = null;
        onPauseFollowLive();
      }
    }

    scheduleScrollTopUpdate(element.scrollTop);
  }, [
    followLive,
    laneHeaderHeight,
    laneHeaderHeightOverride,
    laneStripRef,
    latestVisibleEventId,
    layout,
    liveMode,
    onPauseFollowLive,
    renderedContentHeight,
    scheduleScrollTopUpdate,
    scrollRef,
  ]);

  return {
    handleScroll,
  };
}
