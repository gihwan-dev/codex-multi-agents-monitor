import type {
  TimelineLiveLayout,
  TimelineMode,
  TimelineProjection,
  TimelineViewportState,
} from "./types";

const MAX_PIXELS_PER_MS = 0.2;
const MIN_PIXELS_PER_MS = 0.0009;
const LIVE_ZOOM_MULTIPLIER = 2.8;
const TIMELINE_PADDING = 40;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fitPixelsPerMs(projection: TimelineProjection, viewportHeight: number) {
  return clamp(
    (viewportHeight - TIMELINE_PADDING * 2) / projection.timeRangeMs,
    MIN_PIXELS_PER_MS,
    MAX_PIXELS_PER_MS,
  );
}

export function timelineContentHeight(
  projection: TimelineProjection,
  pixelsPerMs: number,
  liveLayout?: TimelineLiveLayout | null,
) {
  if (liveLayout) {
    return liveLayout.contentHeight;
  }

  return Math.max(
    viewportHeightFloor(),
    projection.timeRangeMs * pixelsPerMs + TIMELINE_PADDING * 2,
  );
}

function viewportHeightFloor() {
  return 520;
}

export function createInitialTimelineViewport(
  projection: TimelineProjection,
  mode: TimelineMode,
  viewportHeight = viewportHeightFloor(),
  liveLayout?: TimelineLiveLayout | null,
): TimelineViewportState {
  if (mode === "live" && liveLayout) {
    return {
      followLatest: true,
      mode,
      pixelsPerMs: 0,
      renderMode: "live-compact",
      scrollTop: Math.max(liveLayout.contentHeight - viewportHeight, 0),
    };
  }

  const fitScale = fitPixelsPerMs(projection, viewportHeight);
  const pixelsPerMs =
    mode === "live"
      ? clamp(fitScale * LIVE_ZOOM_MULTIPLIER, MIN_PIXELS_PER_MS, MAX_PIXELS_PER_MS)
      : fitScale;
  const contentHeight = timelineContentHeight(projection, pixelsPerMs);
  const scrollTop =
    mode === "live" ? Math.max(contentHeight - viewportHeight, 0) : 0;

  return {
    followLatest: mode === "live",
    mode,
    pixelsPerMs,
    renderMode: "archive-absolute",
    scrollTop,
  };
}

export function disableTimelineFollow(
  viewport: TimelineViewportState,
  nextScrollTop = viewport.scrollTop,
) {
  return {
    ...viewport,
    followLatest: false,
    scrollTop: nextScrollTop,
  };
}

export function refollowLatest(
  projection: TimelineProjection,
  viewport: TimelineViewportState,
  viewportHeight = viewportHeightFloor(),
  liveLayout?: TimelineLiveLayout | null,
) {
  const contentHeight = timelineContentHeight(
    projection,
    viewport.pixelsPerMs,
    viewport.renderMode === "live-compact" ? liveLayout : null,
  );

  return {
    ...viewport,
    followLatest: true,
    scrollTop: Math.max(contentHeight - viewportHeight, 0),
  };
}

export function zoomTimelineViewport(options: {
  anchorY: number;
  deltaY: number;
  projection: TimelineProjection;
  viewport: TimelineViewportState;
  viewportHeight?: number;
}) {
  const { anchorY, deltaY, projection, viewport, viewportHeight = viewportHeightFloor() } =
    options;
  if (viewport.renderMode === "live-compact") {
    return disableTimelineFollow(viewport);
  }

  const currentScrollTop = viewport.scrollTop;
  const currentPixelsPerMs = viewport.pixelsPerMs;
  const nextPixelsPerMs = clamp(
    currentPixelsPerMs * (deltaY > 0 ? 0.88 : 1.14),
    MIN_PIXELS_PER_MS,
    MAX_PIXELS_PER_MS,
  );
  const anchorTimeOffsetMs =
    (currentScrollTop + anchorY - TIMELINE_PADDING) / currentPixelsPerMs;
  const contentHeight = timelineContentHeight(projection, nextPixelsPerMs);
  const unclampedScrollTop =
    anchorTimeOffsetMs * nextPixelsPerMs - anchorY + TIMELINE_PADDING;

  return {
    followLatest: false,
    mode: viewport.mode,
    pixelsPerMs: nextPixelsPerMs,
    renderMode: "archive-absolute",
    scrollTop: clamp(unclampedScrollTop, 0, Math.max(contentHeight - viewportHeight, 0)),
  } satisfies TimelineViewportState;
}

export function timelineItemPosition(
  projection: TimelineProjection,
  startedAtMs: number,
  pixelsPerMs: number,
) {
  return TIMELINE_PADDING + (startedAtMs - projection.startedAtMs) * pixelsPerMs;
}

export function timelineSpanHeight(
  durationMs: number | null,
  pixelsPerMs: number,
) {
  if (!durationMs || durationMs <= 0) {
    return 14;
  }

  return Math.max(durationMs * pixelsPerMs, 18);
}

export function timelineTickLabels(
  projection: TimelineProjection,
  tickCount = 5,
) {
  if (tickCount <= 1) {
    return [projection.startedAtMs];
  }

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    return projection.startedAtMs + projection.timeRangeMs * ratio;
  });
}
