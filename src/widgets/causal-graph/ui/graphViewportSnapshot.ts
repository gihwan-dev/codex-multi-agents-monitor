import type { GraphSceneModel } from "../../../entities/run";
import {
  buildContinuationGuideYs,
  buildGraphLayoutSnapshot,
  computeRenderedContentHeight,
  computeVisibleEdgeRoutes,
  computeVisibleRowRange,
  TIME_GUTTER,
} from "../model/graphLayout";

interface BuildGraphViewportSnapshotOptions {
  availableCanvasHeight: number;
  scene: GraphSceneModel;
  scrollTop: number;
  viewportWidth: number;
}

export function buildGraphViewportSnapshot(
  options: BuildGraphViewportSnapshotOptions,
) {
  const { availableCanvasHeight, scene, scrollTop, viewportWidth } = options;
  const layout = buildGraphLayoutSnapshot(scene, viewportWidth);
  const bundleById = new Map(scene.edgeBundles.map((bundle) => [bundle.id, bundle]));
  const renderedContentHeight = computeRenderedContentHeight(
    layout.contentHeight,
    availableCanvasHeight,
  );
  const continuationGuideYs = buildContinuationGuideYs(
    layout.contentHeight,
    renderedContentHeight,
  );
  const visibleRange = computeVisibleRowRange({
    rowPositions: layout.rowPositions,
    scrollTop,
    viewportHeight: availableCanvasHeight,
    overscanCount: 4,
  });

  return {
    bundleById,
    continuationGuideYs,
    gridTemplateColumns: `${TIME_GUTTER}px repeat(${scene.lanes.length || 1}, ${layout.laneMetrics.laneWidth}px)`,
    layout,
    renderedContentHeight,
    visibleEdgeRoutes: computeVisibleEdgeRoutes({
      edgeRoutes: layout.edgeRoutes,
      scrollTop,
      viewportHeight: availableCanvasHeight,
      overscanPx: 500,
    }),
    visibleRowPositions: layout.rowPositions.slice(
      visibleRange.startIndex,
      visibleRange.endIndex,
    ),
    visibleRows: scene.rows.slice(visibleRange.startIndex, visibleRange.endIndex),
  };
}
