import type { RefObject } from "react";
import {
  type GraphLayoutSnapshot,
  resolveFollowLiveScrollTarget,
  TIME_GUTTER,
} from "../model/graphLayout";
import { readFollowLiveContext } from "./graphFollowLiveContext";

export type FollowLiveResolution =
  | { kind: "clear" }
  | { kind: "skip" }
  | {
      element: HTMLDivElement;
      followTarget: { top: number; left: number };
      kind: "scroll";
    };

interface ReadFollowLiveResolutionOptions {
  activeEventId: string;
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  stickyTop: number;
}

export function readFollowLiveResolution(
  options: ReadFollowLiveResolutionOptions,
): FollowLiveResolution {
  const followLiveContext = readFollowLiveContext({
    latestVisibleEventId: options.activeEventId,
    layout: options.layout,
    scrollRef: options.scrollRef,
  });
  if (!followLiveContext) {
    return { kind: "skip" };
  }

  const followTarget = resolveFollowLiveScrollTarget(followLiveContext.eventLayout, {
    scrollTop: followLiveContext.element.scrollTop,
    scrollLeft: followLiveContext.element.scrollLeft,
    viewportHeight: followLiveContext.element.clientHeight,
    viewportWidth: followLiveContext.element.clientWidth,
    stickyTop: options.stickyTop,
    stickyLeft: TIME_GUTTER,
    contentHeight: options.renderedContentHeight,
    contentWidth: options.layout.contentWidth,
  });

  return {
    element: followLiveContext.element,
    followTarget,
    kind: "scroll",
  };
}

export function applyFollowLiveResolution(
  followScrollTargetRef: RefObject<{ top: number; left: number } | null>,
  resolution: FollowLiveResolution,
) {
  const scrollInstruction = readFollowLiveScrollInstruction(resolution);
  if (scrollInstruction === null) {
    followScrollTargetRef.current = null;
    return;
  }
  if (!scrollInstruction) {
    return;
  }

  followScrollTargetRef.current = scrollInstruction.followTarget;
  scrollInstruction.element.scrollTo({
    top: scrollInstruction.followTarget.top,
    left: scrollInstruction.followTarget.left,
    behavior: "auto",
  });
}

function readFollowLiveScrollInstruction(resolution: FollowLiveResolution) {
  if (resolution.kind === "clear") {
    return null;
  }
  if (resolution.kind === "skip") {
    return undefined;
  }

  return hasReachedScrollTarget(resolution.element, resolution.followTarget)
    ? null
    : resolution;
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
