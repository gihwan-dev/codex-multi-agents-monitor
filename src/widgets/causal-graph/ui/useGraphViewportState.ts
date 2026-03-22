import { useEffect, useRef, useState } from "react";
import type { LiveMode } from "../../../entities/run";

interface UseGraphViewportStateOptions {
  followLive: boolean;
  laneHeaderHeightOverride?: number;
  latestVisibleEventId: string | null;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  viewportHeightOverride?: number;
}

export function useGraphViewportState({
  followLive: _followLive,
  laneHeaderHeightOverride,
  latestVisibleEventId: _latestVisibleEventId,
  liveMode: _liveMode,
  onPauseFollowLive: _onPauseFollowLive,
  viewportHeightOverride,
}: UseGraphViewportStateOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneStripRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(viewportHeightOverride ?? 0);
  const [laneHeaderHeight, setLaneHeaderHeight] = useState(laneHeaderHeightOverride ?? 0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollTopRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateMeasurements = () => {
      const nextViewportWidth = Math.round(viewportElement.clientWidth);
      const nextViewportHeight = Math.round(viewportElement.clientHeight);
      const nextLaneHeaderHeight = laneStripRef.current?.offsetHeight ?? 0;

      setViewportWidth((current) => (current === nextViewportWidth ? current : nextViewportWidth));
      if (viewportHeightOverride === undefined) {
        setViewportHeight((current) =>
          current === nextViewportHeight ? current : nextViewportHeight,
        );
      }
      if (laneHeaderHeightOverride === undefined) {
        setLaneHeaderHeight((current) =>
          current === nextLaneHeaderHeight ? current : nextLaneHeaderHeight,
        );
      }
    };

    updateMeasurements();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateMeasurements();
    });

    observer.observe(viewportElement);
    if (laneStripRef.current) {
      observer.observe(laneStripRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [laneHeaderHeightOverride, viewportHeightOverride]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const scheduleScrollTopUpdate = (nextScrollTop: number) => {
    scrollTopRef.current = nextScrollTop;
    if (rafRef.current === 0) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setScrollTop(scrollTopRef.current);
      });
    }
  };

  const availableCanvasHeight = Math.max(
    0,
    (viewportHeightOverride ?? viewportHeight) -
      (laneHeaderHeightOverride ?? laneHeaderHeight),
  );

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
