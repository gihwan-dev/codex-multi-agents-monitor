import { useRef } from "react";

import { useGraphScrollTopState } from "./useGraphScrollTopState";
import { useGraphViewportMeasurements } from "./useGraphViewportMeasurements";

interface UseGraphViewportStateOptions {
  laneHeaderHeightOverride?: number;
  viewportHeightOverride?: number;
}

export function useGraphViewportState(options: UseGraphViewportStateOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneStripRef = useRef<HTMLDivElement>(null);
  const { laneHeaderHeight, viewportHeight, viewportWidth } =
    useGraphViewportMeasurements({
      laneHeaderHeightOverride: options.laneHeaderHeightOverride,
      laneStripRef,
      viewportHeightOverride: options.viewportHeightOverride,
      viewportRef,
    });
  const { scrollTop, scheduleScrollTopUpdate } = useGraphScrollTopState();
  const availableCanvasHeight = resolveAvailableCanvasHeight({
    laneHeaderHeight,
    laneHeaderHeightOverride: options.laneHeaderHeightOverride,
    viewportHeight,
    viewportHeightOverride: options.viewportHeightOverride,
  });

  return {
    availableCanvasHeight,
    laneHeaderHeight,
    laneStripRef,
    scrollRef,
    scrollTop,
    scheduleScrollTopUpdate,
    viewportRef,
    viewportWidth,
  };
}

function resolveAvailableCanvasHeight(options: {
  laneHeaderHeight: number;
  laneHeaderHeightOverride?: number;
  viewportHeight: number;
  viewportHeightOverride?: number;
}) {
  const nextViewportHeight = options.viewportHeightOverride ?? options.viewportHeight;
  const nextLaneHeaderHeight = options.laneHeaderHeightOverride ?? options.laneHeaderHeight;
  return Math.max(0, nextViewportHeight - nextLaneHeaderHeight);
}
