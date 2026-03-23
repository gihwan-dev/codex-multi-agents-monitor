import type { GraphSelectionRevealTarget } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";

export function resolveSelectionRevealRange(
  selectionRevealTarget: GraphSelectionRevealTarget | null,
  layout: GraphLayoutSnapshot,
) {
  if (!selectionRevealTarget) {
    return null;
  }

  if (selectionRevealTarget.kind === "event") {
    return getEventRevealRange(layout, selectionRevealTarget.eventId);
  }

  if (selectionRevealTarget.kind === "artifact") {
    return getEventRevealRange(layout, selectionRevealTarget.producerEventId);
  }

  return buildEdgeRevealRange(
    layout,
    selectionRevealTarget.sourceEventId,
    selectionRevealTarget.targetEventId,
  );
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildEdgeRevealRange(
  layout: GraphLayoutSnapshot,
  sourceEventId: string,
  targetEventId: string,
) {
  const sourceRange = getEventRevealRange(layout, sourceEventId);
  const targetRange = getEventRevealRange(layout, targetEventId);
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

function getEventRevealRange(layout: GraphLayoutSnapshot, eventId: string) {
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
