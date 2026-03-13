import type { TimelineLiveDagView, TimelineRowView } from "../../model/live-dag";

const STAGE_TOP_PADDING = 18;
const STAGE_BOTTOM_PADDING = 24;
const DEFAULT_GRAPH_PADDING = 20;
const COMPACT_GRAPH_PADDING = 16;
const NARROW_GRAPH_PADDING = 12;

export interface LiveDagStageMetrics {
  annotationWidth: number;
  graphPadding: number;
  graphWidth: number;
  gutterWidth: number;
  headerHeight: number;
  isCompact: boolean;
  isNarrow: boolean;
  rowGap: number;
  totalWidth: number;
  trackWidth: number;
}

export interface LiveDagRowLayout {
  centerY: number;
  height: number;
  top: number;
}

export interface LiveDagStageLayout {
  contentHeight: number;
  metrics: LiveDagStageMetrics;
  rowLayoutById: Record<string, LiveDagRowLayout>;
  trackCenterById: Record<string, number>;
}

function rowHeight(row: TimelineRowView, metrics: LiveDagStageMetrics) {
  if (row.kind === "turn-header") {
    return metrics.isNarrow ? 60 : 72;
  }

  if (row.kind === "gap") {
    return metrics.isNarrow ? 44 : 48;
  }

  return metrics.isNarrow ? 58 : metrics.isCompact ? 62 : 68;
}

export function resolveLiveDagStageMetrics(
  viewportWidth: number,
  trackCount: number,
): LiveDagStageMetrics {
  const isNarrow = viewportWidth < 520;
  const isCompact = viewportWidth < 980;
  const gutterWidth = isNarrow ? 104 : isCompact ? 116 : 132;
  const annotationWidth = isNarrow ? 296 : isCompact ? 336 : 388;
  const trackWidth = isNarrow ? 78 : isCompact ? 94 : 112;
  const graphPadding = isNarrow
    ? NARROW_GRAPH_PADDING
    : isCompact
      ? COMPACT_GRAPH_PADDING
      : DEFAULT_GRAPH_PADDING;
  const graphWidth = Math.max(trackCount, 1) * trackWidth + graphPadding * 2;
  const totalWidth = gutterWidth + graphWidth + annotationWidth;

  return {
    annotationWidth,
    graphPadding,
    graphWidth,
    gutterWidth,
    headerHeight: isNarrow ? 52 : 60,
    isCompact,
    isNarrow,
    rowGap: isNarrow ? 10 : 12,
    totalWidth,
    trackWidth,
  };
}

export function buildLiveDagStageLayout(
  dag: TimelineLiveDagView,
  viewportWidth: number,
): LiveDagStageLayout {
  const metrics = resolveLiveDagStageMetrics(viewportWidth, dag.tracks.length);
  const rowLayoutById: Record<string, LiveDagRowLayout> = {};
  const trackCenterById: Record<string, number> = {};
  let cursorY = STAGE_TOP_PADDING;

  for (const row of dag.rows) {
    const height = rowHeight(row, metrics);
    rowLayoutById[row.rowId] = {
      centerY: cursorY + height / 2,
      height,
      top: cursorY,
    };
    cursorY += height + metrics.rowGap;
  }

  dag.tracks.forEach((track, index) => {
    trackCenterById[track.trackId] =
      metrics.gutterWidth +
      metrics.graphPadding +
      index * metrics.trackWidth +
      metrics.trackWidth / 2;
  });

  return {
    contentHeight: cursorY - metrics.rowGap + STAGE_BOTTOM_PADDING,
    metrics,
    rowLayoutById,
    trackCenterById,
  };
}

export function measureLiveDagContentHeight(
  dag: TimelineLiveDagView,
  viewportWidth: number,
) {
  return buildLiveDagStageLayout(dag, viewportWidth).contentHeight;
}
