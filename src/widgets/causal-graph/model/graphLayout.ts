import type { GraphSceneModel } from "../../../entities/run";
import {
  assignPortSlots,
  buildEdgeRouteLayouts,
  buildOrthogonalRoute,
  choosePortPair,
  computeVisibleEdgeRoutes,
} from "./graphEdgeRouting";
import type {
  EventLayout,
  GraphLayoutSnapshot,
  LaneMetrics,
  RowPosition,
  VisibleRowRange,
} from "./graphLayoutTypes";

export { assignPortSlots, buildOrthogonalRoute, choosePortPair, computeVisibleEdgeRoutes };
export type {
  EdgeRouteLayout,
  EventLayout,
  GraphLayoutSnapshot,
  LaneMetrics,
  PortSide,
  RoutePort,
  RowPosition,
  VisibleRowRange,
} from "./graphLayoutTypes";

export const TIME_GUTTER = 148;
export const EVENT_ROW_HEIGHT = 132;
export const GAP_ROW_HEIGHT = 36;
export const ROW_GAP = 16;

const MIN_LANE_WIDTH = 280;
const CARD_WIDTH_MIN = 256;
const CARD_WIDTH_RATIO = 0.8;
const CARD_HEIGHT = 80;

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

export function buildGraphLayoutSnapshot(
  scene: GraphSceneModel,
  viewportWidth: number,
): GraphLayoutSnapshot {
  const laneMetrics = computeLaneMetrics(viewportWidth, scene.lanes.length);
  const {
    contentHeight,
    laneCenterById,
    eventById,
    rowGuideYByEventId,
    rowPositions,
  } = buildEventRects(scene, laneMetrics);

  return {
    contentWidth: laneMetrics.contentWidth,
    contentHeight,
    laneMetrics,
    laneCenterById,
    eventById,
    rowGuideYByEventId,
    edgeRoutes: buildEdgeRouteLayouts(scene.edgeBundles, eventById),
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
