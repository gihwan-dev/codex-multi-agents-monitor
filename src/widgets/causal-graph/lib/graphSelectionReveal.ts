import type { GraphSelectionRevealTarget } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";

export interface GraphRevealRange {
  top: number;
  bottom: number;
  anchorY: number;
}

export function clampGraphScrollTop(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isRevealRangeVisible(
  revealRange: GraphRevealRange,
  visibleTop: number,
  visibleBottom: number,
) {
  return revealRange.top >= visibleTop && revealRange.bottom <= visibleBottom;
}

export function resolveSelectionRevealScrollTop(
  revealRange: GraphRevealRange,
  availableCanvasHeight: number,
  renderedContentHeight: number,
) {
  const maxScrollTop = Math.max(0, renderedContentHeight - availableCanvasHeight);
  return clampGraphScrollTop(
    revealRange.anchorY - availableCanvasHeight / 2,
    0,
    maxScrollTop,
  );
}

export function resolveSelectionRevealRange(
  selectionRevealTarget: GraphSelectionRevealTarget | null,
  layout: GraphLayoutSnapshot,
) {
  if (!selectionRevealTarget) {
    return null;
  }

  if (selectionRevealTarget.kind === "event") {
    return resolveEventRevealRange(layout, selectionRevealTarget.eventId);
  }

  if (selectionRevealTarget.kind === "artifact") {
    return resolveEventRevealRange(layout, selectionRevealTarget.producerEventId);
  }

  const sourceRange = resolveEventRevealRange(layout, selectionRevealTarget.sourceEventId);
  const targetRange = resolveEventRevealRange(layout, selectionRevealTarget.targetEventId);
  if (!sourceRange || !targetRange) {
    return null;
  }

  const top = Math.min(sourceRange.top, targetRange.top);
  const bottom = Math.max(sourceRange.bottom, targetRange.bottom);
  return {
    top,
    bottom,
    anchorY: top + (bottom - top) / 2,
  };
}

function resolveEventRevealRange(layout: GraphLayoutSnapshot, eventId: string) {
  const eventLayout = layout.eventById.get(eventId);
  if (!eventLayout) {
    return null;
  }

  return {
    top: eventLayout.cardRect.y,
    bottom: eventLayout.cardRect.y + eventLayout.cardRect.height,
    anchorY: eventLayout.rowAnchorY,
  };
}
