import { useRef } from "react";

import { useGraphScrollTopState } from "./useGraphScrollTopState";
import { useGraphViewportMeasurements } from "./useGraphViewportMeasurements";

interface UseGraphViewportStateOptions {
  laneHeaderHeightOverride?: number;
  viewportHeightOverride?: number;
}

export function useGraphViewportState({
  laneHeaderHeightOverride,
  viewportHeightOverride,
}: UseGraphViewportStateOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneStripRef = useRef<HTMLDivElement>(null);
  const { laneHeaderHeight, viewportHeight, viewportWidth } =
    useGraphViewportMeasurements({
      laneHeaderHeightOverride,
      laneStripRef,
      viewportHeightOverride,
      viewportRef,
    });
  const { scrollTop, scheduleScrollTopUpdate } = useGraphScrollTopState();
  const availableCanvasHeight = resolveAvailableCanvasHeight({
    laneHeaderHeight,
    laneHeaderHeightOverride,
    viewportHeight,
    viewportHeightOverride,
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

function resolveAvailableCanvasHeight({
  laneHeaderHeight,
  laneHeaderHeightOverride,
  viewportHeight,
  viewportHeightOverride,
}: {
  laneHeaderHeight: number;
  laneHeaderHeightOverride?: number;
  viewportHeight: number;
  viewportHeightOverride?: number;
}) {
  return Math.max(
    0,
    (viewportHeightOverride ?? viewportHeight) -
      (laneHeaderHeightOverride ?? laneHeaderHeight),
  );
}
