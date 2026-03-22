import { type CSSProperties, useId, useLayoutEffect, useRef } from "react";
import type { GraphSceneModel, LiveMode, SelectionState } from "../../../entities/run";
import { Panel } from "../../../shared/ui";
import {
  buildContinuationGuideYs,
  buildGraphLayoutSnapshot,
  computeRenderedContentHeight,
  computeVisibleEdgeRoutes,
  computeVisibleRowRange,
  EVENT_ROW_HEIGHT,
  GAP_ROW_HEIGHT,
  resolveFollowLiveScrollTarget,
  ROW_GAP,
  TIME_GUTTER,
} from "../model/graphLayout";
import { CausalGraphCanvas } from "./CausalGraphCanvas";
import { CausalGraphLaneStrip } from "./CausalGraphLaneStrip";
import { useGraphViewportState } from "./useGraphViewportState";

interface CausalGraphViewProps {
  scene: GraphSceneModel;
  onSelect: (selection: SelectionState) => void;
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  viewportHeightOverride?: number;
  laneHeaderHeightOverride?: number;
}

export function CausalGraphView({
  scene,
  onSelect,
  followLive,
  liveMode,
  onPauseFollowLive,
  viewportHeightOverride,
  laneHeaderHeightOverride,
}: CausalGraphViewProps) {
  const followScrollTargetRef = useRef<{ top: number; left: number } | null>(null);
  const {
    availableCanvasHeight,
    laneHeaderHeight,
    laneStripRef,
    scrollRef,
    scrollTop,
    scheduleScrollTopUpdate,
    viewportRef,
    viewportWidth,
  } = useGraphViewportState({
    followLive,
    laneHeaderHeightOverride,
    latestVisibleEventId: scene.latestVisibleEventId,
    liveMode,
    onPauseFollowLive,
    viewportHeightOverride,
  });
  const layout = buildGraphLayoutSnapshot(scene, viewportWidth);
  const routeMarkerId = useId();
  const bundleById = new Map(scene.edgeBundles.map((bundle) => [bundle.id, bundle]));
  const renderedContentHeight = computeRenderedContentHeight(
    layout.contentHeight,
    availableCanvasHeight,
  );
  const continuationGuideYs = buildContinuationGuideYs(
    layout.contentHeight,
    renderedContentHeight,
  );
  const visibleRange = computeVisibleRowRange(
    layout.rowPositions,
    scrollTop,
    availableCanvasHeight,
    4,
  );
  const visibleRows = scene.rows.slice(visibleRange.startIndex, visibleRange.endIndex);
  const visibleRowPositions = layout.rowPositions.slice(
    visibleRange.startIndex,
    visibleRange.endIndex,
  );
  const visibleEdgeRoutes = computeVisibleEdgeRoutes(
    layout.edgeRoutes,
    scrollTop,
    availableCanvasHeight,
    500,
  );

  useLayoutEffect(() => {
    if (!followLive || liveMode !== "live" || !scene.latestVisibleEventId) {
      followScrollTargetRef.current = null;
      return;
    }

    const element = scrollRef.current;
    const eventLayout = layout.eventById.get(scene.latestVisibleEventId);
    if (!element || !eventLayout) {
      return;
    }

    const stickyTop =
      laneHeaderHeightOverride ?? laneStripRef.current?.offsetHeight ?? laneHeaderHeight;
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
    laneHeaderHeight,
    laneHeaderHeightOverride,
    layout,
    liveMode,
    renderedContentHeight,
    scene.latestVisibleEventId,
  ]);

  const handleScroll = () => {
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
    } else if (followLive && liveMode === "live" && scene.latestVisibleEventId) {
      const eventLayout = layout.eventById.get(scene.latestVisibleEventId);
      if (eventLayout) {
        const stickyTop =
          laneHeaderHeightOverride ?? laneStripRef.current?.offsetHeight ?? laneHeaderHeight;
        if (element.clientHeight <= 0 || element.clientWidth <= 0) {
          return;
        }

        const followViewport = resolveFollowLiveScrollTarget(eventLayout, {
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          viewportHeight: element.clientHeight,
          viewportWidth: element.clientWidth,
          stickyTop,
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
  };

  const gridTemplateColumns = `${TIME_GUTTER}px repeat(${scene.lanes.length || 1}, ${layout.laneMetrics.laneWidth}px)`;

  const handleSelectEdge = (edgeId: string) => {
    if (followLive && liveMode === "live") {
      onPauseFollowLive();
    }
    onSelect({ kind: "edge", id: edgeId });
  };

  return (
    <Panel
      panelSlot="graph-panel"
      title="Graph"
      className="flex-1 overflow-hidden rounded-none border-x-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
    >
      {scene.hiddenLaneCount ? (
        <p className="text-[0.8rem] text-muted-foreground">
          {scene.hiddenLaneCount} inactive done lanes are folded to preserve the active path.
        </p>
      ) : null}
      <div
        ref={viewportRef}
        data-slot="graph"
        className="grid min-h-0 flex-1 gap-3"
        style={
          {
            ["--graph-time-gutter" as string]: `${TIME_GUTTER}px`,
            ["--graph-lane-width" as string]: `${layout.laneMetrics.laneWidth}px`,
            ["--graph-card-width" as string]: `${layout.laneMetrics.cardWidth}px`,
            ["--graph-event-row-height" as string]: `${EVENT_ROW_HEIGHT}px`,
            ["--graph-gap-row-height" as string]: `${GAP_ROW_HEIGHT}px`,
            ["--graph-row-gap" as string]: `${ROW_GAP}px`,
          } as CSSProperties
        }
      >
        <div
          ref={scrollRef}
          data-slot="graph-scroll"
          className="h-full min-h-0 overflow-auto border-t border-white/8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
        >
          <CausalGraphLaneStrip
            gridTemplateColumns={gridTemplateColumns}
            laneStripRef={laneStripRef}
            layout={layout}
            scene={scene}
          />

          <CausalGraphCanvas
            availableCanvasHeight={availableCanvasHeight}
            bundleById={bundleById}
            continuationGuideYs={continuationGuideYs}
            gridTemplateColumns={gridTemplateColumns}
            layout={layout}
            onSelect={onSelect}
            onSelectEdge={handleSelectEdge}
            renderedContentHeight={renderedContentHeight}
            routeMarkerId={routeMarkerId}
            scene={scene}
            scrollTop={scrollTop}
            visibleEdgeRoutes={visibleEdgeRoutes}
            visibleRowPositions={visibleRowPositions}
            visibleRows={visibleRows}
          />
        </div>
      </div>
    </Panel>
  );
}
