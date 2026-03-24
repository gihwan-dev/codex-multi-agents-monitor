import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout, EventLayout, PortSide, Rect, RoutePort } from "./graphLayoutTypes";
import {
  buildRoutePort,
  getSortAxis,
  movePoint,
  rectCenterX, rectCenterY,
  simplifyOrthogonalPoints,
  toSvgPath,
} from "./graphRouteGeometry";

const PORT_SLOT_SPACING = 12;
const PORT_EDGE_PADDING = 12;
const PORT_STUB_LENGTH = 16;
const ROUTE_NUDGE_SPACING = 10;
type RouteOrientation = "horizontal" | "vertical";
interface PendingRoute {
  bundle: GraphSceneEdgeBundle;
  orientation: RouteOrientation;
  source: EventLayout;
  target: EventLayout;
  sourceSide: PortSide;
  targetSide: PortSide;
  groupKey: string;
}

interface BuildEdgeRouteLayoutsOptions {
  edgeBundles: GraphSceneEdgeBundle[];
  eventById: Map<string, EventLayout>;
}

interface ComputeVisibleEdgeRoutesOptions {
  edgeRoutes: EdgeRouteLayout[];
  scrollTop: number;
  viewportHeight: number;
  overscanPx: number;
}

interface BuildPendingRouteOptions {
  bundle: GraphSceneEdgeBundle;
  source: EventLayout;
  target: EventLayout;
}

interface AddPortGroupEntryOptions {
  groups: Map<string, Array<{ routeKey: string; axis: number }>>;
  groupKey: string;
  routeKey: string;
  axis: number;
}
export function choosePortPair(sourceRect: Rect, targetRect: Rect): {
  orientation: RouteOrientation; sourceSide: PortSide; targetSide: PortSide;
} {
  const dx = rectCenterX(targetRect) - rectCenterX(sourceRect);
  const dy = rectCenterY(targetRect) - rectCenterY(sourceRect);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { orientation: "horizontal", sourceSide: "right", targetSide: "left" }
      : { orientation: "horizontal", sourceSide: "left", targetSide: "right" };
  }
  return dy >= 0
    ? { orientation: "vertical", sourceSide: "bottom", targetSide: "top" }
    : { orientation: "vertical", sourceSide: "top", targetSide: "bottom" };
}
function assignPortSlots(routes: PendingRoute[]): Map<string, number> {
  const assignments = new Map<string, number>();
  const groups = new Map<string, Array<{ routeKey: string; axis: number }>>();
  routes.forEach((route) => {
    addPortGroupEntry({
      groups,
      groupKey: `${route.source.eventId}:${route.sourceSide}`,
      routeKey: `${route.bundle.id}:source`,
      axis: getSortAxis(route.target.cardRect, route.sourceSide),
    });
    addPortGroupEntry({
      groups,
      groupKey: `${route.target.eventId}:${route.targetSide}`,
      routeKey: `${route.bundle.id}:target`,
      axis: getSortAxis(route.source.cardRect, route.targetSide),
    });
  });
  groups.forEach((entries) => {
    entries
      .sort((left, right) => left.axis - right.axis || left.routeKey.localeCompare(right.routeKey))
      .forEach((entry, index, list) => {
        assignments.set(entry.routeKey, (index - (list.length - 1) / 2) * PORT_SLOT_SPACING);
      });
  });
  return assignments;
}
function buildOrthogonalRoute(
  sourcePort: RoutePort,
  targetPort: RoutePort,
  trunkNudge: number,
): string {
  const sourceStub = movePoint({
    point: sourcePort,
    side: sourcePort.side,
    distance: PORT_STUB_LENGTH,
  });
  const targetStub = movePoint({
    point: targetPort,
    side: targetPort.side,
    distance: PORT_STUB_LENGTH,
  });
  const points =
    sourcePort.side === "left" || sourcePort.side === "right"
      ? [
          { x: sourcePort.x, y: sourcePort.y },
          sourceStub,
          { x: (sourceStub.x + targetStub.x) / 2 + trunkNudge, y: sourceStub.y },
          { x: (sourceStub.x + targetStub.x) / 2 + trunkNudge, y: targetStub.y },
          targetStub,
          { x: targetPort.x, y: targetPort.y },
        ]
      : [
          { x: sourcePort.x, y: sourcePort.y },
          sourceStub,
          { x: sourceStub.x, y: (sourceStub.y + targetStub.y) / 2 + trunkNudge },
          { x: targetStub.x, y: (sourceStub.y + targetStub.y) / 2 + trunkNudge },
          targetStub,
          { x: targetPort.x, y: targetPort.y },
        ];
  return toSvgPath(simplifyOrthogonalPoints(points));
}
export function buildEdgeRouteLayouts(
  options: BuildEdgeRouteLayoutsOptions,
): EdgeRouteLayout[] {
  const { edgeBundles, eventById } = options;
  const pendingRoutes = buildPendingRoutes(edgeBundles, eventById);
  const portSlots = assignPortSlots(pendingRoutes);
  const routeNudges = assignRouteNudges(pendingRoutes);
  return pendingRoutes.map((route) => buildEdgeRouteLayout(route, portSlots, routeNudges));
}
function buildPendingRoutes(edgeBundles: GraphSceneEdgeBundle[], eventById: Map<string, EventLayout>) {
  return edgeBundles.flatMap((bundle) => {
    const source = eventById.get(bundle.sourceEventId);
    const target = eventById.get(bundle.targetEventId);
    return source && target ? [buildPendingRoute({ bundle, source, target })] : [];
  });
}
export function computeVisibleEdgeRoutes(
  options: ComputeVisibleEdgeRoutesOptions,
): EdgeRouteLayout[];
export function computeVisibleEdgeRoutes(
  options: ComputeVisibleEdgeRoutesOptions,
): EdgeRouteLayout[] {
  const { edgeRoutes, scrollTop, viewportHeight, overscanPx } = options;
  const visibleTop = scrollTop - overscanPx;
  const visibleBottom = scrollTop + viewportHeight + overscanPx;
  return edgeRoutes.filter((route) => {
    const minY = Math.min(route.sourcePort.y, route.targetPort.y);
    const maxY = Math.max(route.sourcePort.y, route.targetPort.y);
      return maxY >= visibleTop && minY <= visibleBottom;
  });
}
function addPortGroupEntry(
  options: AddPortGroupEntryOptions,
) {
  const { groups, groupKey, routeKey, axis } = options;
  let group = groups.get(groupKey);
  if (!group) {
    group = [];
    groups.set(groupKey, group);
  }
  group.push({ routeKey, axis });
}
function assignRouteNudges(routes: PendingRoute[]): Map<string, number> {
  const nudges = new Map<string, number>();
  const groups = new Map<string, PendingRoute[]>();
  routes.forEach((route) => {
    let group = groups.get(route.groupKey);
    if (!group) {
      group = [];
      groups.set(route.groupKey, group);
    }
    group.push(route);
  });
  groups.forEach((group) => {
    group
      .sort((left, right) => {
        const leftAxis =
          left.orientation === "horizontal"
            ? (rectCenterY(left.source.cardRect) + rectCenterY(left.target.cardRect)) / 2
            : (rectCenterX(left.source.cardRect) + rectCenterX(left.target.cardRect)) / 2;
        const rightAxis =
          right.orientation === "horizontal"
            ? (rectCenterY(right.source.cardRect) + rectCenterY(right.target.cardRect)) / 2
            : (rectCenterX(right.source.cardRect) + rectCenterX(right.target.cardRect)) / 2;

        return leftAxis - rightAxis || left.bundle.id.localeCompare(right.bundle.id);
      })
      .forEach((route, index, list) => {
        nudges.set(route.bundle.id, (index - (list.length - 1) / 2) * ROUTE_NUDGE_SPACING);
      });
  });
  return nudges;
}
function buildPendingRoute(options: BuildPendingRouteOptions): PendingRoute {
  const { bundle, source, target } = options;
  const portPair = choosePortPair(source.cardRect, target.cardRect);
  return {
    bundle,
    orientation: portPair.orientation,
    source,
    target,
    sourceSide: portPair.sourceSide,
    targetSide: portPair.targetSide,
    groupKey: `${portPair.orientation}:${source.laneIndex}:${target.laneIndex}`,
  };
}
function buildEdgeRouteLayout(
  route: PendingRoute,
  portSlots: Map<string, number>,
  routeNudges: Map<string, number>,
): EdgeRouteLayout {
  const sourcePort = buildRoutePort({
    layout: route.source,
    side: route.sourceSide,
    offset: portSlots.get(`${route.bundle.id}:source`) ?? 0,
    edgePadding: PORT_EDGE_PADDING,
  });
  const targetPort = buildRoutePort({
    layout: route.target,
    side: route.targetSide,
    offset: portSlots.get(`${route.bundle.id}:target`) ?? 0,
    edgePadding: PORT_EDGE_PADDING,
  });
  return {
    bundleId: route.bundle.id,
    edgeType: route.bundle.edgeType,
    path: buildOrthogonalRoute(sourcePort, targetPort, routeNudges.get(route.bundle.id) ?? 0),
    sourcePort,
    targetPort,
  };
}
