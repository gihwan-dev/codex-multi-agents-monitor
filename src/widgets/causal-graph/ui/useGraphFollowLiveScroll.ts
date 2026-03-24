import { type RefObject, useLayoutEffect } from "react";
import type { GraphSceneModel, LiveMode } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { readActiveFollowLiveEventId } from "./graphFollowLiveContext";
import {
  applyFollowLiveResolution,
  type FollowLiveResolution,
  readFollowLiveResolution,
} from "./graphFollowLiveResolution";

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

interface ResolveFollowLiveViewportOptions {
  followLive: boolean;
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

function syncFollowLiveViewport(options: UseGraphFollowLiveScrollOptions) {
  const {
    followLive,
    followScrollTargetRef,
    latestVisibleEventId,
    layout,
    liveMode,
    renderedContentHeight,
    scrollRef,
    stickyTop,
  } = options;
  applyFollowLiveResolution(
    followScrollTargetRef,
    resolveFollowLiveViewport({
      followLive,
      latestVisibleEventId,
      layout,
      liveMode,
      renderedContentHeight,
      scrollRef,
      stickyTop,
    }),
  );
}

function resolveFollowLiveViewport(
  options: ResolveFollowLiveViewportOptions,
): FollowLiveResolution {
  const {
    followLive,
    latestVisibleEventId,
    layout,
    liveMode,
    renderedContentHeight,
    scrollRef,
    stickyTop,
  } = options;
  const activeEventId = readActiveFollowLiveEventId(
    followLive,
    latestVisibleEventId,
    liveMode,
  );
  if (!activeEventId) {
    return { kind: "clear" };
  }

  return readFollowLiveResolution({
    activeEventId,
    layout,
    renderedContentHeight,
    scrollRef,
    stickyTop,
  });
}
