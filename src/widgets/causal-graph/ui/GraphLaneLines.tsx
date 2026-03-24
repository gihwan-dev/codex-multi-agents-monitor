import type { GraphLayoutSnapshot } from "../model/graphLayout";

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
