import type { RefObject } from "react";
import type { GraphSceneModel, LiveMode } from "../../../entities/run";
import {
  type GraphLayoutSnapshot,
  resolveFollowLiveScrollTarget,
  TIME_GUTTER,
} from "../model/graphLayout";

interface CreateGraphScrollHandlerOptions {
  followLive: boolean;
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>;
  laneHeaderHeight: number;
  laneHeaderHeightOverride?: number;
  laneStripRef: RefObject<HTMLDivElement | null>;
  latestVisibleEventId: GraphSceneModel["latestVisibleEventId"];
  layout: GraphLayoutSnapshot;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  renderedContentHeight: number;
  scheduleScrollTopUpdate: (nextScrollTop: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function createGraphScrollHandler({
  followLive,
  followScrollTargetRef,
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
}: CreateGraphScrollHandlerOptions) {
  return () =>
    handleGraphScroll({
      followLive,
      followScrollTargetRef,
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
    });
}

function handleGraphScroll(options: CreateGraphScrollHandlerOptions) {
  const element = options.scrollRef.current;
  if (!element) {
    return;
  }

  syncFollowLiveScrollState(options, element);
  options.scheduleScrollTopUpdate(element.scrollTop);
}

function hasReachedFollowTarget(
  element: HTMLDivElement,
  followTarget: { top: number; left: number } | null,
) {
  return (
    followTarget !== null &&
    Math.abs(followTarget.top - element.scrollTop) <= 1 &&
    Math.abs(followTarget.left - element.scrollLeft) <= 1
  );
}

function syncFollowLiveScrollState(
  options: CreateGraphScrollHandlerOptions,
  element: HTMLDivElement,
) {
  if (hasReachedFollowTarget(element, options.followScrollTargetRef.current)) {
    options.followScrollTargetRef.current = null;
    return;
  }

  const latestVisibleEventId = readFollowLiveEventId(options);
  if (!latestVisibleEventId) {
    return;
  }

  syncFollowLiveState({
    element,
    followScrollTargetRef: options.followScrollTargetRef,
    latestVisibleEventId,
    layout: options.layout,
    onPauseFollowLive: options.onPauseFollowLive,
    renderedContentHeight: options.renderedContentHeight,
    stickyTop: resolveStickyTop(options),
  });
}

function readFollowLiveEventId(options: CreateGraphScrollHandlerOptions) {
  if (!options.followLive || options.liveMode !== "live") {
    return null;
  }

  return options.latestVisibleEventId;
}

function resolveStickyTop(options: CreateGraphScrollHandlerOptions) {
  return (
    options.laneHeaderHeightOverride ??
    options.laneStripRef.current?.offsetHeight ??
    options.laneHeaderHeight
  );
}

interface SyncFollowLiveStateOptions {
  element: HTMLDivElement;
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>;
  latestVisibleEventId: string;
  layout: GraphLayoutSnapshot;
  onPauseFollowLive: () => void;
  renderedContentHeight: number;
  stickyTop: number;
}

function syncFollowLiveState({
  element,
  followScrollTargetRef,
  latestVisibleEventId,
  layout,
  onPauseFollowLive,
  renderedContentHeight,
  stickyTop,
}: SyncFollowLiveStateOptions) {
  const followViewport = resolveFollowViewport({
    element,
    latestVisibleEventId,
    layout,
    renderedContentHeight,
    stickyTop,
  });
  if (!followViewport || !hasFollowViewportDrift(element, followViewport)) {
    return;
  }

  clearFollowLiveState(followScrollTargetRef, onPauseFollowLive);
}

function resolveFollowViewport({
  element,
  latestVisibleEventId,
  layout,
  renderedContentHeight,
  stickyTop,
}: {
  element: HTMLDivElement;
  latestVisibleEventId: string;
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
  stickyTop: number;
}) {
  const eventLayout = layout.eventById.get(latestVisibleEventId);
  if (!eventLayout || element.clientHeight <= 0 || element.clientWidth <= 0) {
    return null;
  }

  return resolveFollowLiveScrollTarget(eventLayout, {
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
    viewportHeight: element.clientHeight,
    viewportWidth: element.clientWidth,
    stickyTop,
    stickyLeft: TIME_GUTTER,
    contentHeight: renderedContentHeight,
    contentWidth: layout.contentWidth,
  });
}

function hasFollowViewportDrift(
  element: HTMLDivElement,
  followViewport: { top: number; left: number },
) {
  return (
    Math.abs(followViewport.top - element.scrollTop) > 1 ||
    Math.abs(followViewport.left - element.scrollLeft) > 1
  );
}

function clearFollowLiveState(
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>,
  onPauseFollowLive: () => void,
) {
  followScrollTargetRef.current = null;
  onPauseFollowLive();
}
