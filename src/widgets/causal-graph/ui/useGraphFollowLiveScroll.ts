import { type RefObject, useLayoutEffect } from "react";
import type { GraphSceneModel, LiveMode } from "../../../entities/run";
import {
  type GraphLayoutSnapshot,
  resolveFollowLiveScrollTarget,
  TIME_GUTTER,
} from "../model/graphLayout";

interface UseGraphFollowLiveScrollOptions {
  followLive: boolean;
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>;
  latestVisibleEventId: GraphSceneModel["latestVisibleEventId"];
  layout: GraphLayoutSnapshot;
  liveMode: LiveMode;
  renderedContentHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  stickyTop: number;
}

export function useGraphFollowLiveScroll(options: UseGraphFollowLiveScrollOptions) {
  useLayoutEffect(() => {
    syncFollowLiveViewport(options);
  }, [options]);
}

function syncFollowLiveViewport({
  followLive,
  followScrollTargetRef,
  latestVisibleEventId,
  layout,
  liveMode,
  renderedContentHeight,
  scrollRef,
  stickyTop,
}: UseGraphFollowLiveScrollOptions) {
  applyFollowLiveResolution(followScrollTargetRef, resolveFollowLiveViewport({
    followLive,
    latestVisibleEventId,
    layout,
    liveMode,
    renderedContentHeight,
    scrollRef,
    stickyTop,
  }));
}

function hasReachedScrollTarget(
  element: HTMLDivElement,
  followTarget: { top: number; left: number },
) {
  return (
    Math.abs(followTarget.top - element.scrollTop) <= 1 &&
    Math.abs(followTarget.left - element.scrollLeft) <= 1
  );
}

function resolveFollowLiveViewport({
  followLive,
  latestVisibleEventId,
  layout,
  liveMode,
  renderedContentHeight,
  scrollRef,
  stickyTop,
}: {
  followLive: boolean;
  latestVisibleEventId: GraphSceneModel["latestVisibleEventId"];
  layout: GraphLayoutSnapshot;
  liveMode: LiveMode;
  renderedContentHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  stickyTop: number;
}):
  | { kind: "clear" }
  | { kind: "skip" }
  | {
      element: HTMLDivElement;
      followTarget: { top: number; left: number };
      kind: "scroll";
    } {
  const activeEventId = readActiveFollowLiveEventId(
    followLive,
    latestVisibleEventId,
    liveMode,
  );
  if (!activeEventId) {
    return { kind: "clear" };
  }

  const followLiveContext = readFollowLiveContext(
    activeEventId,
    layout,
    scrollRef,
  );
  if (!followLiveContext) {
    return { kind: "skip" };
  }

  return {
    element: followLiveContext.element,
    followTarget: resolveFollowLiveScrollTarget(followLiveContext.eventLayout, {
      scrollTop: followLiveContext.element.scrollTop,
      scrollLeft: followLiveContext.element.scrollLeft,
      viewportHeight: followLiveContext.element.clientHeight,
      viewportWidth: followLiveContext.element.clientWidth,
      stickyTop,
      stickyLeft: TIME_GUTTER,
      contentHeight: renderedContentHeight,
      contentWidth: layout.contentWidth,
    }),
    kind: "scroll",
  };
}

function applyFollowLiveResolution(
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>,
  resolution: ReturnType<typeof resolveFollowLiveViewport>,
) {
  if (resolution.kind !== "scroll") {
    applyNonScrollResolution(followScrollTargetRef, resolution.kind);
    return;
  }
  if (hasReachedScrollTarget(resolution.element, resolution.followTarget)) {
    clearFollowScrollTarget(followScrollTargetRef);
    return;
  }

  setFollowScrollTarget(followScrollTargetRef, resolution.followTarget);
  scrollElementToTarget(resolution.element, resolution.followTarget);
}

function readActiveFollowLiveEventId(
  followLive: boolean,
  latestVisibleEventId: GraphSceneModel["latestVisibleEventId"],
  liveMode: LiveMode,
) {
  if (!followLive || liveMode !== "live") {
    return null;
  }

  return latestVisibleEventId;
}

function readFollowLiveContext(
  latestVisibleEventId: string,
  layout: GraphLayoutSnapshot,
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const element = scrollRef.current;
  const eventLayout = layout.eventById.get(latestVisibleEventId);
  if (!element || !eventLayout || isViewportUnavailable(element)) {
    return null;
  }

  return { element, eventLayout };
}

function isViewportUnavailable(element: HTMLDivElement) {
  return element.clientHeight <= 0 || element.clientWidth <= 0;
}

function applyNonScrollResolution(
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>,
  kind: "clear" | "skip",
) {
  if (kind === "clear") {
    clearFollowScrollTarget(followScrollTargetRef);
  }
}

function clearFollowScrollTarget(
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>,
) {
  followScrollTargetRef.current = null;
}

function setFollowScrollTarget(
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>,
  followTarget: { top: number; left: number },
) {
  followScrollTargetRef.current = followTarget;
}

function scrollElementToTarget(
  element: HTMLDivElement,
  followTarget: { top: number; left: number },
) {
  element.scrollTo({
    top: followTarget.top,
    left: followTarget.left,
    behavior: "auto",
  });
}
