import { type CSSProperties, useId } from "react";
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
  const {
    availableCanvasHeight,
    handleScroll,
    laneStripRef,
    scrollRef,
    scrollTop,
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
