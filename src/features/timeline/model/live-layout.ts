import type {
  TimelineActivationSegment,
  TimelineGapFold,
  TimelineItemView,
  TimelineLiveLayout,
  TimelineProjection,
  TimelineTurnHeaderRow,
} from "./types";

const LIVE_LAYOUT_TOP_PADDING = 28;
const LIVE_LAYOUT_BOTTOM_PADDING = 48;
const TURN_HEADER_HEIGHT = 52;
const SEGMENT_MIN_HEIGHT = 82;
const SEGMENT_TOP_PADDING = 14;
const SEGMENT_BOTTOM_PADDING = 16;
const SEGMENT_ITEM_STEP = 28;
const REGULAR_SEGMENT_GAP = 18;
const GAP_FOLD_HEIGHT = 40;
const GAP_FOLD_THRESHOLD_MS = 45_000;

function byTime<T extends { endedAtMs?: number | null; startedAtMs: number }>(left: T, right: T) {
  return (
    left.startedAtMs - right.startedAtMs ||
    (left.endedAtMs ?? left.startedAtMs) - (right.endedAtMs ?? right.startedAtMs)
  );
}

function isPromptItem(item: TimelineItemView) {
  return item.sourceEvents.some((event) => event.kind === "user_message");
}

function isLiveVisibleItem(item: TimelineItemView) {
  if (isPromptItem(item)) {
    return false;
  }

  return item.kind === "status" || item.kind === "error" || item.kind === "message";
}

function formatGapLabel(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `+${seconds}s idle gap`;
  }

  if (seconds === 0) {
    return `+${minutes}m idle gap`;
  }

  return `+${minutes}m ${seconds}s idle gap`;
}

function segmentDurationPadding(segment: TimelineActivationSegment) {
  const durationMs = Math.max(segment.endedAtMs - segment.startedAtMs, 0);

  if (durationMs < 60_000) {
    return 0;
  }

  return Math.min(Math.ceil(durationMs / 60_000) * 8, 40);
}

function nearestVisibleItem(
  items: TimelineItemView[],
  visibleItems: TimelineItemView[],
  item: TimelineItemView,
) {
  if (visibleItems.length === 0) {
    return item;
  }

  const itemIndex = items.findIndex((candidate) => candidate.itemId === item.itemId);
  let closest = visibleItems[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of visibleItems) {
    const candidateIndex = items.findIndex((entry) => entry.itemId === candidate.itemId);
    const distance = Math.abs(candidateIndex - itemIndex);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  return closest;
}

function ensureRenderableItems(
  items: TimelineItemView[],
  terminalItemId: string,
) {
  const visibleItems = items.filter(isLiveVisibleItem);
  if (visibleItems.length > 0) {
    return visibleItems;
  }

  const terminalItem = items.find((item) => item.itemId === terminalItemId) ?? items[items.length - 1];
  return terminalItem ? [terminalItem] : [];
}

function segmentItems(projection: TimelineProjection, segment: TimelineActivationSegment) {
  return segment.itemIds
    .map((itemId) => projection.itemsById[itemId])
    .filter((item): item is TimelineItemView => Boolean(item))
    .sort(byTime);
}

function segmentBounds(
  cursorY: number,
  segment: TimelineActivationSegment,
  renderItems: TimelineItemView[],
) {
  const intrinsicHeight =
    SEGMENT_TOP_PADDING +
    SEGMENT_BOTTOM_PADDING +
    Math.max(renderItems.length - 1, 0) * SEGMENT_ITEM_STEP +
    18;

  const height = Math.max(
    SEGMENT_MIN_HEIGHT + segmentDurationPadding(segment),
    intrinsicHeight,
  );

  return {
    bottom: cursorY + height,
    height,
    top: cursorY,
  };
}

function distributeItemY(
  bounds: { top: number; height: number },
  items: TimelineItemView[],
) {
  if (items.length === 0) {
    return {};
  }

  if (items.length === 1) {
    return {
      [items[0].itemId]: bounds.top + bounds.height / 2,
    };
  }

  const usableHeight = bounds.height - SEGMENT_TOP_PADDING - SEGMENT_BOTTOM_PADDING;
  const step = Math.max(usableHeight / (items.length - 1), SEGMENT_ITEM_STEP);
  const startY = bounds.top + SEGMENT_TOP_PADDING;

  return Object.fromEntries(
    items.map((item, index) => [item.itemId, startY + step * index]),
  ) as Record<string, number>;
}

function regularGapHeight(durationMs: number) {
  if (durationMs <= 0) {
    return REGULAR_SEGMENT_GAP;
  }

  return Math.max(
    REGULAR_SEGMENT_GAP,
    Math.min(Math.round(durationMs / 8_000), 28),
  );
}

export function buildTimelineLiveLayout(
  projection: TimelineProjection,
): TimelineLiveLayout {
  const orderedSegments = [...projection.activationSegments].sort(byTime);
  const turnHeaders: TimelineTurnHeaderRow[] = [];
  const gapFolds: TimelineGapFold[] = [];
  const segmentBoundsById: TimelineLiveLayout["segmentBoundsById"] = {};
  const segmentEntryYById: TimelineLiveLayout["segmentEntryYById"] = {};
  const segmentExitYById: TimelineLiveLayout["segmentExitYById"] = {};
  const itemYById: TimelineLiveLayout["itemYById"] = {};
  const renderItemIdsBySegmentId: TimelineLiveLayout["renderItemIdsBySegmentId"] = {};
  const turnBoundsById: TimelineLiveLayout["turnBoundsById"] = {};
  const firstSegmentIdsByTurn = new Map<string, string>();

  for (const segment of orderedSegments) {
    if (!firstSegmentIdsByTurn.has(segment.turnBandId)) {
      firstSegmentIdsByTurn.set(segment.turnBandId, segment.segmentId);
    }
  }

  let cursorY = LIVE_LAYOUT_TOP_PADDING;
  let previousSegment: TimelineActivationSegment | null = null;

  for (const segment of orderedSegments) {
    const turnBand = projection.turnBandsById[segment.turnBandId];
    const isFirstInTurn = firstSegmentIdsByTurn.get(segment.turnBandId) === segment.segmentId;

    if (isFirstInTurn) {
      if (previousSegment) {
        const turnGapMs = Math.max(turnBand.startedAtMs - previousSegment.endedAtMs, 0);

        if (turnGapMs > GAP_FOLD_THRESHOLD_MS) {
          gapFolds.push({
            gapId: `gap:${previousSegment.segmentId}:${segment.segmentId}`,
            height: GAP_FOLD_HEIGHT,
            hiddenDurationMs: turnGapMs,
            label: formatGapLabel(turnGapMs),
            sourceSegmentId: previousSegment.segmentId,
            targetSegmentId: segment.segmentId,
            top: cursorY,
          });
          cursorY += GAP_FOLD_HEIGHT;
        } else {
          cursorY += regularGapHeight(turnGapMs);
        }
      }

      const headerTop = cursorY;
      turnHeaders.push({
        headerId: `turn-header:${turnBand.turnBandId}`,
        height: TURN_HEADER_HEIGHT,
        startedAtMs: turnBand.startedAtMs,
        summary: turnBand.summary,
        top: headerTop,
        turnBandId: turnBand.turnBandId,
        userItemId: turnBand.userItemId,
      });
      turnBoundsById[turnBand.turnBandId] = {
        bottom: headerTop + TURN_HEADER_HEIGHT,
        height: TURN_HEADER_HEIGHT,
        top: headerTop,
      };
      cursorY += TURN_HEADER_HEIGHT;
    } else if (previousSegment) {
      const gapMs = Math.max(segment.startedAtMs - previousSegment.endedAtMs, 0);
      if (gapMs > GAP_FOLD_THRESHOLD_MS) {
        gapFolds.push({
          gapId: `gap:${previousSegment.segmentId}:${segment.segmentId}`,
          height: GAP_FOLD_HEIGHT,
          hiddenDurationMs: gapMs,
          label: formatGapLabel(gapMs),
          sourceSegmentId: previousSegment.segmentId,
          targetSegmentId: segment.segmentId,
          top: cursorY,
        });
        cursorY += GAP_FOLD_HEIGHT;
      } else {
        cursorY += regularGapHeight(gapMs);
      }
    }

    const items = segmentItems(projection, segment);
    const renderItems = ensureRenderableItems(items, segment.terminalItemId);
    const bounds = segmentBounds(cursorY, segment, renderItems);
    const renderItemY = distributeItemY(bounds, renderItems);

    segmentBoundsById[segment.segmentId] = bounds;
    renderItemIdsBySegmentId[segment.segmentId] = renderItems.map((item) => item.itemId);

    for (const item of items) {
      const visibleItem = renderItems.find((candidate) => candidate.itemId === item.itemId);
      const anchorItem = visibleItem ?? nearestVisibleItem(items, renderItems, item);
      itemYById[item.itemId] = renderItemY[anchorItem.itemId];
    }

    const entryItem = items[0];
    const exitItem =
      projection.itemsById[segment.anchorItemId] ??
      projection.itemsById[segment.terminalItemId] ??
      items[items.length - 1];

    segmentEntryYById[segment.segmentId] =
      entryItem != null ? itemYById[entryItem.itemId] : bounds.top + bounds.height / 2;
    segmentExitYById[segment.segmentId] =
      exitItem != null ? itemYById[exitItem.itemId] : bounds.top + bounds.height / 2;

    const turnBounds = turnBoundsById[segment.turnBandId];
    if (turnBounds) {
      turnBounds.bottom = bounds.bottom;
      turnBounds.height = bounds.bottom - turnBounds.top;
    }

    cursorY = bounds.bottom;
    previousSegment = segment;
  }

  return {
    contentHeight: cursorY + LIVE_LAYOUT_BOTTOM_PADDING,
    gapFolds,
    itemYById,
    renderItemIdsBySegmentId,
    renderMode: "live-compact",
    segmentBoundsById,
    segmentEntryYById,
    segmentExitYById,
    turnBoundsById,
    turnHeaders,
  };
}
