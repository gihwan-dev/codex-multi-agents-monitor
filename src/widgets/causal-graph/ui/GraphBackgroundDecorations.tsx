import type { GraphSceneModel } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { TIME_GUTTER } from "../model/graphLayout";

interface GraphRouteMarkerDefsProps {
  routeMarkerId: string;
}

export function GraphRouteMarkerDefs({ routeMarkerId }: GraphRouteMarkerDefsProps) {
  return (
    <defs>
      <marker
        id={routeMarkerId}
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
      </marker>
    </defs>
  );
}

interface GraphLaneLinesProps {
  laneIds: string[];
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
}

export function GraphLaneLines({
  laneIds,
  layout,
  renderedContentHeight,
}: GraphLaneLinesProps) {
  return laneIds.map((laneId) => (
    <line
      key={laneId}
      x1={layout.laneCenterById.get(laneId) ?? 0}
      y1={0}
      x2={layout.laneCenterById.get(laneId) ?? 0}
      y2={renderedContentHeight}
      stroke="var(--color-graph-lane-line)"
      strokeWidth={2}
      strokeDasharray="3 8"
    />
  ));
}

interface GraphContinuationGuidesProps {
  availableCanvasHeight: number;
  contentWidth: number;
  continuationGuideYs: number[];
  scrollTop: number;
}

export function GraphContinuationGuides({
  availableCanvasHeight,
  contentWidth,
  continuationGuideYs,
  scrollTop,
}: GraphContinuationGuidesProps) {
  return continuationGuideYs
    .filter((guideY) => isVisibleContinuationGuide(guideY, scrollTop, availableCanvasHeight))
    .map((guideY) => (
      <line
        key={`continuation-guide-${guideY}`}
        data-slot="graph-row-guide"
        data-guide-kind="continuation"
        x1={TIME_GUTTER}
        y1={guideY}
        x2={contentWidth}
        y2={guideY}
        stroke="var(--color-graph-guide-continuation)"
        strokeWidth={1}
        strokeDasharray="2 7"
      />
    ));
}

function isVisibleContinuationGuide(
  guideY: number,
  scrollTop: number,
  availableCanvasHeight: number,
) {
  return guideY >= scrollTop - 500 && guideY <= scrollTop + availableCanvasHeight + 500;
}

export function buildLaneIds(scene: GraphSceneModel) {
  return scene.lanes.map((lane) => lane.laneId);
}
