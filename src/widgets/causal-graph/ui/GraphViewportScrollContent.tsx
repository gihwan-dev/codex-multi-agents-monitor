import type {
  GraphSceneModel,
  SelectionState,
} from "../../../entities/run";
import { CausalGraphCanvas } from "./CausalGraphCanvas";
import { CausalGraphLaneStrip } from "./CausalGraphLaneStrip";
import type { useCausalGraphViewModel } from "./useCausalGraphViewModel";

interface GraphViewportScrollContentProps {
  graphSnapshot: ReturnType<typeof useCausalGraphViewModel>["graphSnapshot"];
  handleScroll: ReturnType<typeof useCausalGraphViewModel>["handleScroll"];
  onSelect: (selection: SelectionState) => void;
  onSelectEdge: (edgeId: string) => void;
  routeMarkerId: string;
  scene: GraphSceneModel;
  viewportState: ReturnType<typeof useCausalGraphViewModel>["viewportState"];
}

export function GraphViewportScrollContent({
  graphSnapshot,
  handleScroll,
  onSelect,
  onSelectEdge,
  routeMarkerId,
  scene,
  viewportState,
}: GraphViewportScrollContentProps) {
  return (
    <div
      ref={viewportState.scrollRef}
      data-slot="graph-scroll"
      className="h-full min-h-0 min-w-0 overflow-auto border-t border-[color:var(--color-chrome-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
