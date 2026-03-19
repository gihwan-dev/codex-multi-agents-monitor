import type { GraphSceneEdgeBundle, GraphSceneModel } from "../../../shared/domain";

export const TIME_GUTTER = 148;
export const EVENT_ROW_HEIGHT = 132;
export const GAP_ROW_HEIGHT = 36;
export const ROW_GAP = 16;

const MIN_LANE_WIDTH = 280;
const CARD_WIDTH_MIN = 256;
const CARD_WIDTH_RATIO = 0.8;
const CARD_HEIGHT = 80;
const PORT_SLOT_SPACING = 12;
const PORT_EDGE_PADDING = 12;
const PORT_STUB_LENGTH = 16;
const ROUTE_NUDGE_SPACING = 10;

type RouteOrientation = "horizontal" | "vertical";

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PendingRoute {
  bundle: GraphSceneEdgeBundle;
  orientation: RouteOrientation;
  source: EventLayout;
  target: EventLayout;
  sourceSide: PortSide;
  targetSide: PortSide;
  groupKey: string;
}

export type PortSide = "top" | "right" | "bottom" | "left";

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

export function computeRenderedContentHeight(
  contentHeight: number,
  availableCanvasHeight: number,
): number {
  return Math.max(contentHeight, Math.max(EVENT_ROW_HEIGHT, availableCanvasHeight));
}

export function buildContinuationGuideYs(
  contentHeight: number,
  renderedContentHeight: number,
): number[] {
  const guideYs: number[] = [];
  const firstGuideY = contentHeight + ROW_GAP + EVENT_ROW_HEIGHT / 2;
  const cadence = EVENT_ROW_HEIGHT + ROW_GAP;

  for (let guideY = firstGuideY; guideY <= renderedContentHeight; guideY += cadence) {
    guideYs.push(guideY);
  }

  return guideYs;
}

export function computeLaneMetrics(viewportWidth: number, laneCount: number): LaneMetrics {
  const safeLaneCount = Math.max(laneCount, 1);
  const availableWidth = Math.max(viewportWidth - TIME_GUTTER, 0);
  const laneFloorWidth = Math.max(
    MIN_LANE_WIDTH,
    Math.floor(availableWidth / safeLaneCount),
  );
  const minimumContentWidth = TIME_GUTTER + laneFloorWidth * safeLaneCount;
  const contentWidth = Math.max(viewportWidth, minimumContentWidth);
  const laneWidth = (contentWidth - TIME_GUTTER) / safeLaneCount;
  const cardWidth = Math.max(CARD_WIDTH_MIN, Math.floor(laneWidth * CARD_WIDTH_RATIO));

  return {
    timeGutter: TIME_GUTTER,
    laneWidth,
    contentWidth,
    cardWidth,
  };
}

export function buildEventRects(
  scene: GraphSceneModel,
  laneMetrics: LaneMetrics,
): {
  contentHeight: number;
  laneCenterById: Map<string, number>;
  eventById: Map<string, EventLayout>;
  rowGuideYByEventId: Map<string, number>;
  rowPositions: RowPosition[];
} {
  const laneCenterById = new Map<string, number>();
  const laneIndexById = new Map<string, number>();
  const eventById = new Map<string, EventLayout>();
  const rowGuideYByEventId = new Map<string, number>();
  const rowPositions: RowPosition[] = [];

  scene.lanes.forEach((lane, index) => {
    laneCenterById.set(
      lane.laneId,
      laneMetrics.timeGutter + index * laneMetrics.laneWidth + laneMetrics.laneWidth / 2,
    );
    laneIndexById.set(lane.laneId, index);
  });

  let cursorY = 0;
  scene.rows.forEach((row, index) => {
    const height = row.kind === "gap" ? GAP_ROW_HEIGHT : EVENT_ROW_HEIGHT;
    rowPositions.push({
      rowIndex: index,
      topY: cursorY,
      height,
      kind: row.kind === "gap" ? "gap" : "event",
    });
    if (row.kind === "event") {
      const laneIndex = laneIndexById.get(row.laneId) ?? -1;
      const laneCenter = laneCenterById.get(row.laneId) ?? laneMetrics.timeGutter;
      const rowAnchorY = cursorY + height / 2;
      eventById.set(row.eventId, {
        eventId: row.eventId,
        laneId: row.laneId,
        laneIndex,
        rowTop: cursorY,
        rowHeight: height,
        rowAnchorY,
        cardRect: {
          x: laneCenter - laneMetrics.cardWidth / 2,
          y: rowAnchorY - CARD_HEIGHT / 2,
          width: laneMetrics.cardWidth,
          height: CARD_HEIGHT,
        },
      });
      rowGuideYByEventId.set(row.eventId, rowAnchorY);
    }

    cursorY += height;
    if (index < scene.rows.length - 1) {
      cursorY += ROW_GAP;
    }
  });

  return {
    contentHeight: Math.max(cursorY, EVENT_ROW_HEIGHT),
    laneCenterById,
    eventById,
    rowGuideYByEventId,
    rowPositions,
  };
}

export function choosePortPair(
  sourceRect: Rect,
  targetRect: Rect,
): {
  orientation: RouteOrientation;
  sourceSide: PortSide;
  targetSide: PortSide;
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

export function assignPortSlots(routes: PendingRoute[]): Map<string, number> {
  const assignments = new Map<string, number>();
  const groups = new Map<string, Array<{ routeKey: string; axis: number }>>();

  routes.forEach((route) => {
    addPortGroupEntry(
      groups,
      `${route.source.eventId}:${route.sourceSide}`,
      `${route.bundle.id}:source`,
      getSortAxis(route.target.cardRect, route.sourceSide),
    );
    addPortGroupEntry(
      groups,
      `${route.target.eventId}:${route.targetSide}`,
      `${route.bundle.id}:target`,
      getSortAxis(route.source.cardRect, route.targetSide),
    );
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

export function buildOrthogonalRoute(
  sourcePort: RoutePort,
  targetPort: RoutePort,
  trunkNudge: number,
): string {
  const sourceStub = movePoint(sourcePort, sourcePort.side, PORT_STUB_LENGTH);
  const targetStub = movePoint(targetPort, targetPort.side, PORT_STUB_LENGTH);

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

export function buildGraphLayoutSnapshot(
  scene: GraphSceneModel,
  viewportWidth: number,
): GraphLayoutSnapshot {
  const laneMetrics = computeLaneMetrics(viewportWidth, scene.lanes.length);
  const { contentHeight, laneCenterById, eventById, rowGuideYByEventId, rowPositions } = buildEventRects(scene, laneMetrics);

  const pendingRoutes = scene.edgeBundles.flatMap((bundle) => {
    const source = eventById.get(bundle.sourceEventId);
    const target = eventById.get(bundle.targetEventId);
    if (!source || !target) {
      return [];
    }

    const portPair = choosePortPair(source.cardRect, target.cardRect);

    return [
      {
        bundle,
        orientation: portPair.orientation,
        source,
        target,
        sourceSide: portPair.sourceSide,
        targetSide: portPair.targetSide,
        groupKey: `${portPair.orientation}:${source.laneIndex}:${target.laneIndex}`,
      } satisfies PendingRoute,
    ];
  });

  const portSlots = assignPortSlots(pendingRoutes);
  const routeNudges = assignRouteNudges(pendingRoutes);

  const edgeRoutes = pendingRoutes.map((route) => {
    const sourcePort = buildRoutePort(
      route.source,
      route.sourceSide,
      portSlots.get(`${route.bundle.id}:source`) ?? 0,
    );
    const targetPort = buildRoutePort(
      route.target,
      route.targetSide,
      portSlots.get(`${route.bundle.id}:target`) ?? 0,
    );

    return {
      bundleId: route.bundle.id,
      edgeType: route.bundle.edgeType,
      path: buildOrthogonalRoute(sourcePort, targetPort, routeNudges.get(route.bundle.id) ?? 0),
      sourcePort,
      targetPort,
    } satisfies EdgeRouteLayout;
  });

  return {
    contentWidth: laneMetrics.contentWidth,
    contentHeight,
    laneMetrics,
    laneCenterById,
    eventById,
    rowGuideYByEventId,
    edgeRoutes,
    rowPositions,
  };
}

export function computeVisibleRowRange(
  rowPositions: RowPosition[],
  scrollTop: number,
  viewportHeight: number,
  overscanCount: number,
): VisibleRowRange {
  if (rowPositions.length === 0) {
    return { startIndex: 0, endIndex: 0, topPadding: 0, bottomPadding: 0 };
  }

  const viewportEnd = scrollTop + viewportHeight;

  let lo = 0;
  let hi = rowPositions.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const row = rowPositions[mid];
    if (row.topY + row.height <= scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  let startIndex = lo;

  lo = startIndex;
  hi = rowPositions.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rowPositions[mid].topY < viewportEnd) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  let endIndex = lo;

  startIndex = Math.max(0, startIndex - overscanCount);
  endIndex = Math.min(rowPositions.length, endIndex + overscanCount);

  const topPadding = startIndex > 0 ? rowPositions[startIndex].topY : 0;
  const lastVisible = endIndex > 0 ? rowPositions[endIndex - 1] : undefined;
  const lastRow = rowPositions[rowPositions.length - 1];
  const totalHeight = lastRow.topY + lastRow.height;
  const bottomPadding = lastVisible
    ? Math.max(0, totalHeight - (lastVisible.topY + lastVisible.height))
    : 0;

  return { startIndex, endIndex, topPadding, bottomPadding };
}

export function computeVisibleEdgeRoutes(
  edgeRoutes: EdgeRouteLayout[],
  scrollTop: number,
  viewportHeight: number,
  overscanPx: number,
): EdgeRouteLayout[] {
  const visibleTop = scrollTop - overscanPx;
  const visibleBottom = scrollTop + viewportHeight + overscanPx;

  return edgeRoutes.filter((route) => {
    const minY = Math.min(route.sourcePort.y, route.targetPort.y);
    const maxY = Math.max(route.sourcePort.y, route.targetPort.y);
    return maxY >= visibleTop && minY <= visibleBottom;
  });
}

function addPortGroupEntry(
  groups: Map<string, Array<{ routeKey: string; axis: number }>>,
  groupKey: string,
  routeKey: string,
  axis: number,
) {
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

function buildRoutePort(layout: EventLayout, side: PortSide, offset: number): RoutePort {
  const centerX = rectCenterX(layout.cardRect);
  const centerY = rectCenterY(layout.cardRect);

  if (side === "top" || side === "bottom") {
    return {
      eventId: layout.eventId,
      side,
      x: clamp(
        centerX + offset,
        layout.cardRect.x + PORT_EDGE_PADDING,
        layout.cardRect.x + layout.cardRect.width - PORT_EDGE_PADDING,
      ),
      y: side === "top" ? layout.cardRect.y : layout.cardRect.y + layout.cardRect.height,
      offset,
    };
  }

  return {
    eventId: layout.eventId,
    side,
    x: side === "left" ? layout.cardRect.x : layout.cardRect.x + layout.cardRect.width,
    y: clamp(
      centerY + offset,
      layout.cardRect.y + PORT_EDGE_PADDING,
      layout.cardRect.y + layout.cardRect.height - PORT_EDGE_PADDING,
    ),
    offset,
  };
}

function getSortAxis(rect: Rect, side: PortSide): number {
  return side === "top" || side === "bottom" ? rectCenterX(rect) : rectCenterY(rect);
}

function movePoint(point: Point, side: PortSide, distance: number): Point {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - distance };
    case "right":
      return { x: point.x + distance, y: point.y };
    case "bottom":
      return { x: point.x, y: point.y + distance };
    case "left":
      return { x: point.x - distance, y: point.y };
  }
}

function simplifyOrthogonalPoints(points: Point[]): Point[] {
  const result: Point[] = [];

  points.forEach((point) => {
    const previous = result[result.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) {
      return;
    }

    result.push(point);

    if (result.length < 3) {
      return;
    }

    const a = result[result.length - 3];
    const b = result[result.length - 2];
    const c = result[result.length - 1];

    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
      result.splice(result.length - 2, 1);
    }
  });

  return result;
}

function toSvgPath(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function rectCenterX(rect: Rect) {
  return rect.x + rect.width / 2;
}

function rectCenterY(rect: Rect) {
  return rect.y + rect.height / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
