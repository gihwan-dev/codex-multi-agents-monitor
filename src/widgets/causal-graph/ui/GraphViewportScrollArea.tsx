import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import { GraphContextRail } from "./GraphContextRail";
import { GraphViewportScrollContent } from "./GraphViewportScrollContent";
import { useViewportGraphContextObservability } from "./graphViewportContextObservability";
import type { useCausalGraphViewModel } from "./useCausalGraphViewModel";

interface GraphViewportScrollAreaProps {
  graphSnapshot: ReturnType<typeof useCausalGraphViewModel>["graphSnapshot"];
  handleScroll: ReturnType<typeof useCausalGraphViewModel>["handleScroll"];
  onSelect: (selection: SelectionState) => void;
  onSelectEdge: (edgeId: string) => void;
  routeMarkerId: string;
  scene: GraphSceneModel;
  viewportState: ReturnType<typeof useCausalGraphViewModel>["viewportState"];
}

export function GraphViewportScrollArea(props: GraphViewportScrollAreaProps) {
  const { graphSnapshot, scene, viewportState } = props;
  const focusedObservability = useViewportGraphContextObservability({
    availableCanvasHeight: viewportState.availableCanvasHeight,
    scene,
    scrollTop: viewportState.scrollTop,
    visibleRowPositions: graphSnapshot.visibleRowPositions,
    visibleRows: graphSnapshot.visibleRows,
  });

  return (
    <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
      <GraphViewportScrollContent {...props} />
      <GraphContextRail observability={focusedObservability} />
    </div>
  );
}
