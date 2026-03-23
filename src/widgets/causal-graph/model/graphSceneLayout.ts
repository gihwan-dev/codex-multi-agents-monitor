import type { GraphSceneModel } from "../../../entities/run";
import { buildEdgeRouteLayouts } from "./graphEdgeRouting";
import type {
  EventLayout,
  GraphLayoutSnapshot,
  LaneMetrics,
  RowPosition,
} from "./graphLayoutTypes";

export const TIME_GUTTER = 148;
export const EVENT_ROW_HEIGHT = 132;
export const GAP_ROW_HEIGHT = 36;
export const ROW_GAP = 16;

const MIN_LANE_WIDTH = 304;
const CARD_WIDTH_MIN = 272;
const CARD_WIDTH_RATIO = 0.8;
const CARD_HEIGHT = 80;

function buildLaneAxisMaps(scene: GraphSceneModel, laneMetrics: LaneMetrics) {
  const laneCenterById = new Map<string, number>();
  const laneIndexById = new Map<string, number>();

  scene.lanes.forEach((lane, index) => {
    laneCenterById.set(
      lane.laneId,
      laneMetrics.timeGutter + index * laneMetrics.laneWidth + laneMetrics.laneWidth / 2,
    );
    laneIndexById.set(lane.laneId, index);
  });

  return { laneCenterById, laneIndexById };
}

function buildRowPosition(options: {
  index: number;
  topY: number;
  height: number;
  kind: RowPosition["kind"];
}) {
  return {
    rowIndex: options.index,
    topY: options.topY,
    height: options.height,
    kind: options.kind,
  } satisfies RowPosition;
}

function buildEventLayout(options: {
  eventId: string;
  laneId: string;
  topY: number;
  height: number;
  laneMetrics: LaneMetrics;
  laneCenterById: Map<string, number>;
  laneIndexById: Map<string, number>;
}): EventLayout {
  const laneCenter =
    options.laneCenterById.get(options.laneId) ?? options.laneMetrics.timeGutter;
  const rowAnchorY = options.topY + options.height / 2;

  return {
    eventId: options.eventId,
    laneId: options.laneId,
    laneIndex: options.laneIndexById.get(options.laneId) ?? -1,
    rowTop: options.topY,
    rowHeight: options.height,
    rowAnchorY,
    cardRect: {
      x: laneCenter - options.laneMetrics.cardWidth / 2,
      y: rowAnchorY - CARD_HEIGHT / 2,
      width: options.laneMetrics.cardWidth,
      height: CARD_HEIGHT,
    },
  };
}

function advanceCursorY(cursorY: number, height: number, hasMoreRows: boolean) {
  return cursorY + height + (hasMoreRows ? ROW_GAP : 0);
}

function appendRowLayout(
  buffers: {
    eventById: Map<string, EventLayout>;
    laneCenterById: Map<string, number>;
    laneIndexById: Map<string, number>;
    rowGuideYByEventId: Map<string, number>;
    rowPositions: RowPosition[];
  },
  options: {
    row: GraphSceneModel["rows"][number];
    index: number;
    cursorY: number;
    laneMetrics: LaneMetrics;
  },
) {
  const height = options.row.kind === "gap" ? GAP_ROW_HEIGHT : EVENT_ROW_HEIGHT;
  buffers.rowPositions.push(
    buildRowPosition({
      index: options.index,
      topY: options.cursorY,
      height,
      kind: options.row.kind === "gap" ? "gap" : "event",
    }),
  );
  if (options.row.kind !== "event") {
    return height;
  }

  const layout = buildEventLayout({
    eventId: options.row.eventId,
    laneId: options.row.laneId,
    topY: options.cursorY,
    height,
    laneMetrics: options.laneMetrics,
    laneCenterById: buffers.laneCenterById,
    laneIndexById: buffers.laneIndexById,
  });
  buffers.eventById.set(options.row.eventId, layout);
  buffers.rowGuideYByEventId.set(options.row.eventId, layout.rowAnchorY);
  return height;
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

  return {
    timeGutter: TIME_GUTTER,
    laneWidth,
    contentWidth,
    cardWidth: Math.max(CARD_WIDTH_MIN, Math.floor(laneWidth * CARD_WIDTH_RATIO)),
  };
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
  const { laneCenterById, laneIndexById } = buildLaneAxisMaps(scene, laneMetrics);
  const layoutState = {
    eventById: new Map<string, EventLayout>(),
    rowGuideYByEventId: new Map<string, number>(),
    rowPositions: [] as RowPosition[],
  };
  let cursorY = 0;

  for (const [index, row] of scene.rows.entries()) {
    const height = appendRowLayout(
      { ...layoutState, laneCenterById, laneIndexById },
      { row, index, cursorY, laneMetrics },
    );
    cursorY = advanceCursorY(cursorY, height, index < scene.rows.length - 1);
  }

  return {
    contentHeight: Math.max(cursorY, EVENT_ROW_HEIGHT),
    laneCenterById,
    ...layoutState,
  };
}

export function buildGraphLayoutSnapshot(
  scene: GraphSceneModel,
  viewportWidth: number,
): GraphLayoutSnapshot {
  const laneMetrics = computeLaneMetrics(viewportWidth, scene.lanes.length);
  const { contentHeight, laneCenterById, eventById, rowGuideYByEventId, rowPositions } =
    buildEventRects(scene, laneMetrics);

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
