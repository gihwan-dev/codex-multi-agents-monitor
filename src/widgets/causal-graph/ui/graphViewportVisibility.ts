import type { GraphSceneModel } from "../../../entities/run";
import {
  computeVisibleEdgeRoutes,
  computeVisibleRowRange,
  type GraphLayoutSnapshot,
} from "../model/graphLayout";

interface BuildGraphViewportVisibilityOptions {
  availableCanvasHeight: number;
  layout: GraphLayoutSnapshot;
  scene: GraphSceneModel;
  scrollTop: number;
}

export function buildGraphViewportVisibility(
  options: BuildGraphViewportVisibilityOptions,
) {
  const visibleRange = computeVisibleRowRange({
    rowPositions: options.layout.rowPositions,
    scrollTop: options.scrollTop,
    viewportHeight: options.availableCanvasHeight,
    overscanCount: 4,
  });
  const visibleEdgeRoutes = computeVisibleEdgeRoutes({
    edgeRoutes: options.layout.edgeRoutes,
    scrollTop: options.scrollTop,
    viewportHeight: options.availableCanvasHeight,
    overscanPx: 500,
  });

  return {
    visibleEdgeRoutes,
    visibleRowPositions: options.layout.rowPositions.slice(
      visibleRange.startIndex,
      visibleRange.endIndex,
    ),
    visibleRows: options.scene.rows.slice(
      visibleRange.startIndex,
      visibleRange.endIndex,
    ),
  };
}
