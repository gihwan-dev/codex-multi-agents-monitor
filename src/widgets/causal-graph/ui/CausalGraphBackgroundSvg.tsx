import type { GraphSceneEdgeBundle, GraphSceneModel } from "../../../entities/run";
import type {
  EdgeRouteLayout,
  GraphLayoutSnapshot,
} from "../model/graphLayout";
import { renderGraphRowGuide } from "./CausalGraphRowGuide";
import {
  buildLaneIds,
  GraphContinuationGuides,
  GraphLaneLines,
  GraphRouteMarkerDefs,
} from "./GraphBackgroundDecorations";
import { GraphEdgeRoute } from "./GraphEdgeRoute";

interface CausalGraphBackgroundSvgProps {
  availableCanvasHeight: number;
  bundleById: Map<string, GraphSceneEdgeBundle>;
  continuationGuideYs: number[];
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
  routeMarkerId: string;
  scene: GraphSceneModel;
  scrollTop: number;
  visibleEdgeRoutes: EdgeRouteLayout[];
  visibleRows: GraphSceneModel["rows"];
}

export function CausalGraphBackgroundSvg({
  availableCanvasHeight,
  bundleById,
  continuationGuideYs,
  layout,
  renderedContentHeight,
  routeMarkerId,
  scene,
  scrollTop,
  visibleEdgeRoutes,
  visibleRows,
}: CausalGraphBackgroundSvgProps) {
  const laneIds = buildLaneIds(scene);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${layout.contentWidth} ${renderedContentHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <GraphRouteMarkerDefs routeMarkerId={routeMarkerId} />
      <GraphLaneLines
        laneIds={laneIds}
        layout={layout}
        renderedContentHeight={renderedContentHeight}
      />
      {visibleRows.map((row) => renderGraphRowGuide(row, layout))}
      <GraphContinuationGuides
        availableCanvasHeight={availableCanvasHeight}
        contentWidth={layout.contentWidth}
        continuationGuideYs={continuationGuideYs}
        scrollTop={scrollTop}
      />
      {visibleEdgeRoutes.map((route) => (
        <GraphEdgeRoute
          key={route.bundleId}
          bundle={bundleById.get(route.bundleId)}
          route={route}
          routeMarkerId={routeMarkerId}
        />
      ))}
    </svg>
  );
}
