import type { CSSProperties } from "react";
import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import {
  EVENT_ROW_HEIGHT,
  GAP_ROW_HEIGHT,
  ROW_GAP,
  TIME_GUTTER,
} from "../model/graphLayout";
import { CausalGraphCanvas } from "./CausalGraphCanvas";
import { CausalGraphLaneStrip } from "./CausalGraphLaneStrip";
import type { useCausalGraphViewModel } from "./useCausalGraphViewModel";

interface CausalGraphViewportSurfaceProps {
  onSelect: (selection: SelectionState) => void;
  onSelectEdge: (edgeId: string) => void;
  scene: GraphSceneModel;
  viewModel: ReturnType<typeof useCausalGraphViewModel>;
}

export function CausalGraphViewportSurface({
  onSelect,
  onSelectEdge,
  scene,
  viewModel,
}: CausalGraphViewportSurfaceProps) {
  const { graphSnapshot, handleScroll, routeMarkerId, viewportState } = viewModel;

  return (
    <div
      ref={viewportState.viewportRef}
      data-slot="graph"
      className="grid min-h-0 flex-1 gap-3"
      style={buildGraphViewportStyle(graphSnapshot.layout.laneMetrics)}
    >
      <GraphViewportScrollArea
        graphSnapshot={graphSnapshot}
        handleScroll={handleScroll}
        onSelect={onSelect}
        onSelectEdge={onSelectEdge}
        routeMarkerId={routeMarkerId}
        scene={scene}
        viewportState={viewportState}
      />
    </div>
  );
}

interface GraphViewportScrollAreaProps {
  graphSnapshot: ReturnType<typeof useCausalGraphViewModel>["graphSnapshot"];
  handleScroll: ReturnType<typeof useCausalGraphViewModel>["handleScroll"];
  onSelect: (selection: SelectionState) => void;
  onSelectEdge: (edgeId: string) => void;
  routeMarkerId: string;
  scene: GraphSceneModel;
  viewportState: ReturnType<typeof useCausalGraphViewModel>["viewportState"];
}

function GraphViewportScrollArea({
  graphSnapshot,
  handleScroll,
  onSelect,
  onSelectEdge,
  routeMarkerId,
  scene,
  viewportState,
}: GraphViewportScrollAreaProps) {
  return (
    <div
      ref={viewportState.scrollRef}
      data-slot="graph-scroll"
      className="h-full min-h-0 overflow-auto border-t border-[color:var(--color-chrome-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onScroll={handleScroll}
    >
      <CausalGraphLaneStrip
        gridTemplateColumns={graphSnapshot.gridTemplateColumns}
        laneStripRef={viewportState.laneStripRef}
        layout={graphSnapshot.layout}
        scene={scene}
      />
      <CausalGraphCanvas
        availableCanvasHeight={viewportState.availableCanvasHeight}
        bundleById={graphSnapshot.bundleById}
        continuationGuideYs={graphSnapshot.continuationGuideYs}
        gridTemplateColumns={graphSnapshot.gridTemplateColumns}
        layout={graphSnapshot.layout}
        onSelect={onSelect}
        onSelectEdge={onSelectEdge}
        renderedContentHeight={graphSnapshot.renderedContentHeight}
        routeMarkerId={routeMarkerId}
        scene={scene}
        scrollTop={viewportState.scrollTop}
        visibleEdgeRoutes={graphSnapshot.visibleEdgeRoutes}
        visibleRowPositions={graphSnapshot.visibleRowPositions}
        visibleRows={graphSnapshot.visibleRows}
      />
    </div>
  );
}

function buildGraphViewportStyle(
  laneMetrics: ReturnType<typeof useCausalGraphViewModel>["graphSnapshot"]["layout"]["laneMetrics"],
): CSSProperties {
  return {
    ["--graph-time-gutter" as string]: `${TIME_GUTTER}px`,
    ["--graph-lane-width" as string]: `${laneMetrics.laneWidth}px`,
    ["--graph-card-width" as string]: `${laneMetrics.cardWidth}px`,
    ["--graph-event-row-height" as string]: `${EVENT_ROW_HEIGHT}px`,
    ["--graph-gap-row-height" as string]: `${GAP_ROW_HEIGHT}px`,
    ["--graph-row-gap" as string]: `${ROW_GAP}px`,
  };
}
