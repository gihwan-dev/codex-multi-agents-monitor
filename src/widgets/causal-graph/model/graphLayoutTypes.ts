import type { GraphSceneEdgeBundle } from "../../../entities/run";

export type PortSide = "top" | "right" | "bottom" | "left";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaneMetrics {
  timeGutter: number;
  laneWidth: number;
  contentWidth: number;
  cardWidth: number;
}

export interface EventLayout {
  eventId: string;
  laneId: string;
  laneIndex: number;
  rowTop: number;
  rowHeight: number;
  rowAnchorY: number;
  cardRect: Rect;
}

export interface RoutePort {
  eventId: string;
  side: PortSide;
  x: number;
  y: number;
  offset: number;
}

export interface EdgeRouteLayout {
  bundleId: string;
  edgeType: GraphSceneEdgeBundle["edgeType"];
  path: string;
  sourcePort: RoutePort;
  targetPort: RoutePort;
}

export interface RowPosition {
  rowIndex: number;
  topY: number;
  height: number;
  kind: "event" | "gap";
}

export interface VisibleRowRange {
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
}

export interface GraphLayoutSnapshot {
  contentWidth: number;
  contentHeight: number;
  laneMetrics: LaneMetrics;
  laneCenterById: Map<string, number>;
  eventById: Map<string, EventLayout>;
  rowGuideYByEventId: Map<string, number>;
  edgeRoutes: EdgeRouteLayout[];
  rowPositions: RowPosition[];
}
