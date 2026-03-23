import type { GraphSceneEdgeBundle, GraphSceneModel } from "../../../entities/run";
import type {
  EdgeRouteLayout,
  GraphLayoutSnapshot,
} from "../model/graphLayout";
import { TIME_GUTTER } from "../model/graphLayout";
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
      {visibleRows.map((row) => renderRowGuide(row, layout))}
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

function renderRowGuide(
  row: GraphSceneModel["rows"][number],
  layout: GraphLayoutSnapshot,
) {
  if (row.kind !== "event") {
    return null;
  }

  const guideY = layout.rowGuideYByEventId.get(row.eventId);
  if (guideY === undefined) {
    return null;
  }

  return (
    <line
      key={`guide-${row.eventId}`}
      data-slot="graph-row-guide"
      data-guide-kind={row.selected ? "selected" : row.inPath ? "active" : "default"}
      data-event-id={row.eventId}
      x1={TIME_GUTTER}
      y1={guideY}
      x2={layout.contentWidth}
      y2={guideY}
      stroke={resolveGuideColor(row.selected, row.inPath)}
      strokeWidth={row.selected || row.inPath ? 1.25 : 1}
      strokeDasharray="2 6"
    />
  );
}

function resolveGuideColor(selected: boolean, inPath: boolean) {
  if (selected) {
    return "var(--color-graph-guide-selected)";
  }

  return inPath
    ? "var(--color-graph-guide-active)"
    : "var(--color-graph-guide-default)";
}
