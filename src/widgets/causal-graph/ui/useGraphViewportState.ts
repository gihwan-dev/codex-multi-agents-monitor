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
  followLive,
  laneHeaderHeightOverride,
  latestVisibleEventId,
  liveMode,
  onPauseFollowLive,
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
    if (!followLive || liveMode !== "live" || !latestVisibleEventId) {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "auto",
    });
  }, [followLive, latestVisibleEventId, liveMode]);

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

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    if (followLive && liveMode === "live") {
      const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 32;
      if (!nearBottom) {
        onPauseFollowLive();
      }
    }

    scrollTopRef.current = element.scrollTop;
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
    handleScroll,
    laneStripRef,
    scrollRef,
    scrollTop,
    viewportRef,
    viewportWidth,
  };
}
