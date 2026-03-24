import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout, EventLayout, PortSide } from "./graphLayoutTypes";

export const PORT_SLOT_SPACING = 12;
export const PORT_EDGE_PADDING = 12;
export const PORT_STUB_LENGTH = 16;
export const ROUTE_NUDGE_SPACING = 10;

export type RouteOrientation = "horizontal" | "vertical";

export interface PendingRoute {
  bundle: GraphSceneEdgeBundle;
  orientation: RouteOrientation;
  source: EventLayout;
  target: EventLayout;
  sourceSide: PortSide;
  targetSide: PortSide;
  groupKey: string;
}

export interface BuildEdgeRouteLayoutsOptions {
  edgeBundles: GraphSceneEdgeBundle[];
  eventById: Map<string, EventLayout>;
}

export interface ComputeVisibleEdgeRoutesOptions {
  edgeRoutes: EdgeRouteLayout[];
  scrollTop: number;
  viewportHeight: number;
  overscanPx: number;
}

export interface BuildPendingRouteOptions {
  bundle: GraphSceneEdgeBundle;
  source: EventLayout;
  target: EventLayout;
}

export interface AddPortGroupEntryOptions {
  groups: Map<string, Array<{ routeKey: string; axis: number }>>;
  groupKey: string;
  routeKey: string;
  axis: number;
}
