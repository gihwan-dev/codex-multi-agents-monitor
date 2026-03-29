import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import { GraphViewportScrollArea } from "./GraphViewportScrollArea";
import { buildGraphViewportStyle } from "./graphViewportStyle";
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
      className="grid min-h-0 min-w-0 flex-1 gap-3"
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
