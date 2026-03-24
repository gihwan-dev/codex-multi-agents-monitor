import type {
  GraphSceneEdgeBundle,
  GraphSceneModel,
  SelectionState,
} from "../../../entities/run";
import type {
  EdgeRouteLayout,
  GraphLayoutSnapshot,
  RowPosition,
} from "../model/graphLayout";
import { CausalGraphBackdropSvg } from "./CausalGraphBackdropSvg";
import { CausalGraphEdgeHitTargets } from "./CausalGraphEdgeHitTargets";
import { CausalGraphRows } from "./CausalGraphRows";

interface CausalGraphCanvasProps {
  availableCanvasHeight: number;
  bundleById: Map<string, GraphSceneEdgeBundle>;
  continuationGuideYs: number[];
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  onSelectEdge: (edgeId: string) => void;
  renderedContentHeight: number;
  routeMarkerId: string;
  scene: GraphSceneModel;
  scrollTop: number;
  visibleEdgeRoutes: EdgeRouteLayout[];
  visibleRowPositions: RowPosition[];
  visibleRows: GraphSceneModel["rows"];
}

export function CausalGraphCanvas({
  availableCanvasHeight,
  bundleById,
  continuationGuideYs,
  gridTemplateColumns,
  layout,
  onSelect,
  onSelectEdge,
  renderedContentHeight,
  routeMarkerId,
  scene,
  scrollTop,
  visibleEdgeRoutes,
  visibleRowPositions,
  visibleRows,
}: CausalGraphCanvasProps) {
  return (
    <div
      className="relative"
      style={{ width: layout.contentWidth, minHeight: renderedContentHeight }}
    >
      <CausalGraphBackdropSvg
        availableCanvasHeight={availableCanvasHeight}
        bundleById={bundleById}
        continuationGuideYs={continuationGuideYs}
        layout={layout}
        renderedContentHeight={renderedContentHeight}
        routeMarkerId={routeMarkerId}
        scene={scene}
        scrollTop={scrollTop}
        visibleEdgeRoutes={visibleEdgeRoutes}
        visibleRows={visibleRows}
      />

      <CausalGraphRows
        gridTemplateColumns={gridTemplateColumns}
        layout={layout}
        onSelect={onSelect}
        renderedContentHeight={renderedContentHeight}
        sceneLanes={scene.lanes}
        visibleRowPositions={visibleRowPositions}
        visibleRows={visibleRows}
      />

      <CausalGraphEdgeHitTargets
        bundleById={bundleById}
        layout={layout}
        onSelectEdge={onSelectEdge}
        renderedContentHeight={renderedContentHeight}
        visibleEdgeRoutes={visibleEdgeRoutes}
      />
    </div>
  );
}
