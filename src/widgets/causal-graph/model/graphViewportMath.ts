import type {
  EventLayout,
  RowPosition,
  VisibleRowRange,
} from "./graphLayoutTypes";
import { EVENT_ROW_HEIGHT } from "./graphSceneLayout";

interface FollowLiveViewport {
  scrollTop: number;
  scrollLeft: number;
  viewportHeight: number;
  viewportWidth: number;
  stickyTop: number;
  stickyLeft: number;
  contentHeight: number;
  contentWidth: number;
}

function clampScrollOffset(value: number, max: number) {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

function resolveFollowLiveTop(eventLayout: EventLayout, viewport: FollowLiveViewport) {
  const visibleHeight = Math.max(viewport.viewportHeight - viewport.stickyTop, 0);
  const bottomAlignedTop = viewport.contentHeight - visibleHeight;

  return eventLayout.cardRect.height > visibleHeight ? eventLayout.cardRect.y : bottomAlignedTop;
}

function resolveFollowLiveLeft(eventLayout: EventLayout, viewport: FollowLiveViewport) {
  const visibleWidth = Math.max(viewport.viewportWidth - viewport.stickyLeft, 0);
  const visibleLeft = viewport.scrollLeft + viewport.stickyLeft;
  const visibleRight = viewport.scrollLeft + viewport.viewportWidth;
  const cardRight = eventLayout.cardRect.x + eventLayout.cardRect.width;

  if (eventLayout.cardRect.width > visibleWidth || eventLayout.cardRect.x < visibleLeft) {
    return eventLayout.cardRect.x - viewport.stickyLeft;
  }

  return cardRight > visibleRight ? cardRight - viewport.viewportWidth : viewport.scrollLeft;
}

export function computeRenderedContentHeight(
  contentHeight: number,
  availableCanvasHeight: number,
): number {
  return Math.max(contentHeight, Math.max(EVENT_ROW_HEIGHT, availableCanvasHeight));
}

export function resolveFollowLiveScrollTarget(
  eventLayout: EventLayout,
  viewport: FollowLiveViewport,
) {
  const visibleHeight = Math.max(viewport.viewportHeight - viewport.stickyTop, 0);

  return {
    top: clampScrollOffset(
      resolveFollowLiveTop(eventLayout, viewport),
      viewport.contentHeight - visibleHeight,
    ),
    left: clampScrollOffset(
      resolveFollowLiveLeft(eventLayout, viewport),
      viewport.contentWidth - viewport.viewportWidth,
    ),
  };
}

function findBoundaryIndex(options: {
  rowPositions: RowPosition[];
  lo?: number;
  shouldAdvance: (row: RowPosition) => boolean;
}) {
  let lo = options.lo ?? 0;
  let hi = options.rowPositions.length;

  while (lo < hi) {
    ({ hi, lo } = resolveBoundarySearchStep(options, lo, hi));
  }

  return lo;
}

function resolveBoundarySearchStep(
  options: {
    rowPositions: RowPosition[];
    shouldAdvance: (row: RowPosition) => boolean;
  },
  lo: number,
  hi: number,
) {
  const mid = (lo + hi) >>> 1;
  const row = options.rowPositions[mid];

  return options.shouldAdvance(row) ? { lo: mid + 1, hi } : { lo, hi: mid };
}

function findFirstVisibleRowIndex(rowPositions: RowPosition[], scrollTop: number) {
  return findBoundaryIndex({
    rowPositions,
    shouldAdvance: (row) => row.topY + row.height <= scrollTop,
  });
}

function findFirstRowAfterViewport(
  rowPositions: RowPosition[],
  viewportEnd: number,
  startIndex: number,
) {
  return findBoundaryIndex({
    rowPositions,
    lo: startIndex,
    shouldAdvance: (row) => row.topY < viewportEnd,
  });
}

function resolveVisibleRowBounds(options: {
  rowPositions: RowPosition[];
  scrollTop: number;
  viewportHeight: number;
  overscanCount: number;
}) {
  const viewportEnd = options.scrollTop + options.viewportHeight;
  const unclampedStart = findFirstVisibleRowIndex(options.rowPositions, options.scrollTop);
  const unclampedEnd = findFirstRowAfterViewport(
    options.rowPositions,
    viewportEnd,
    unclampedStart,
  );

  return {
    startIndex: Math.max(0, unclampedStart - options.overscanCount),
    endIndex: Math.min(options.rowPositions.length, unclampedEnd + options.overscanCount),
  };
}

function buildVisibleRowPadding(rowPositions: RowPosition[], endIndex: number, startIndex: number) {
  const topPadding = startIndex > 0 ? rowPositions[startIndex].topY : 0;
  const lastVisible = endIndex > 0 ? rowPositions[endIndex - 1] : undefined;
  const lastRow = rowPositions[rowPositions.length - 1];
  const totalHeight = lastRow.topY + lastRow.height;

  return {
    topPadding,
    bottomPadding: lastVisible
      ? Math.max(0, totalHeight - (lastVisible.topY + lastVisible.height))
      : 0,
  };
}

export type ComputeVisibleRowRangeOptions = {
  rowPositions: RowPosition[];
  scrollTop: number;
  viewportHeight: number;
  overscanCount: number;
};

export function computeVisibleRowRange(
  options: ComputeVisibleRowRangeOptions,
): VisibleRowRange {
  if (options.rowPositions.length === 0) {
    return { startIndex: 0, endIndex: 0, topPadding: 0, bottomPadding: 0 };
  }

  const { endIndex, startIndex } = resolveVisibleRowBounds(options);
  const { topPadding, bottomPadding } = buildVisibleRowPadding(
    options.rowPositions,
    endIndex,
    startIndex,
  );

  return { startIndex, endIndex, topPadding, bottomPadding };
}
