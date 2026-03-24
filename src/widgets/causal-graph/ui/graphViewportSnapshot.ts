import type { GraphSceneModel } from "../../../entities/run";
import {
  buildContinuationGuideYs,
  buildGraphLayoutSnapshot,
  computeRenderedContentHeight,
  TIME_GUTTER,
} from "../model/graphLayout";
import { buildGraphViewportVisibility } from "./graphViewportVisibility";

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
  const visibility = buildGraphViewportVisibility({
    availableCanvasHeight,
    layout,
    scene,
    scrollTop,
  });

  return {
    bundleById,
    continuationGuideYs,
    gridTemplateColumns: `${TIME_GUTTER}px repeat(${scene.lanes.length || 1}, ${layout.laneMetrics.laneWidth}px)`,
    layout,
    renderedContentHeight,
    ...visibility,
  };
}
