import type {
  ContextObservabilityModel,
  LaneContextSummary,
} from "../../../entities/run";
import { formatTokens } from "../../../shared/lib/format";

const MIN_TIMELINE_BAR_RATIO = 0.18;
const TIMELINE_BAR_COUNT = 28;

export interface ContextTimelineBar {
  heightRatio: number;
  isActive: boolean;
  isPast: boolean;
  key: string;
  tone: "default" | "warning" | "danger";
}

interface BuildTimelineBarArgs {
  observability: ContextObservabilityModel;
  activeIndex: number;
  barIndex: number;
  bucketSize: number;
  peakWindowTokens: number;
}

export function formatShare(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatTokenMetric(value: number) {
  return value > 0 ? formatTokens(value) : "0";
}

export function resolveBarTone(ratio: number | null) {
  if (ratio === null) {
    return "bg-[color:var(--color-active)]/55";
  }

  if (ratio >= 0.85) {
    return "bg-[color:var(--color-failed)]";
  }

  if (ratio >= 0.65) {
    return "bg-[color:var(--color-waiting)]";
  }

  return "bg-[color:var(--color-active)]";
}

export function buildUsageLabel(observability: ContextObservabilityModel) {
  if (!observability.maxContextWindowTokens) {
    return "Window limit unavailable";
  }

  const ratio = observability.activeContextWindowTokens / observability.maxContextWindowTokens;
  return `${Math.round(ratio * 100)}% of ${formatTokens(observability.maxContextWindowTokens)}`;
}

export function buildContextRatio(observability: ContextObservabilityModel) {
  if (!observability.maxContextWindowTokens || observability.maxContextWindowTokens <= 0) {
    return null;
  }

  return Math.min(
    observability.activeContextWindowTokens / observability.maxContextWindowTokens,
    1,
  );
}

export function resolveProgressWidth(
  ratio: number | null,
  activeContextWindowTokens: number,
) {
  return `${Math.max((ratio ?? 0) * 100, activeContextWindowTokens > 0 ? 4 : 0)}%`;
}

export function buildActiveFocusLabel(observability: ContextObservabilityModel) {
  switch (observability.activeSource) {
    case "selection":
      return "Selected event";
    case "viewport":
      return "Visible in graph";
    default:
      return "Latest event";
  }
}

export function buildActiveEventProgressLabel(
  observability: ContextObservabilityModel,
) {
  const activeIndex = findActivePointIndex(observability);
  const totalCount = observability.timelinePoints.length;

  if (activeIndex < 0 || totalCount === 0) {
    return null;
  }

  return `${activeIndex + 1} / ${totalCount} events`;
}

export function buildTimelineBars(
  observability: ContextObservabilityModel,
): ContextTimelineBar[] {
  const { timelinePoints } = observability;
  if (timelinePoints.length === 0) {
    return [];
  }

  const barCount = Math.min(TIMELINE_BAR_COUNT, timelinePoints.length);
  const bucketSize = Math.ceil(timelinePoints.length / barCount);
  const activeIndex = findActivePointIndex(observability);
  const peakWindowTokens = Math.max(observability.peakContextWindowTokens, 1);

  return Array.from({ length: barCount }, (_, index) =>
    buildTimelineBar({
      observability,
      activeIndex,
      barIndex: index,
      bucketSize,
      peakWindowTokens,
    }),
  );
}

export function resolveTimelineBarTone(bar: ContextTimelineBar) {
  if (bar.isActive) {
    return "bg-[color:var(--color-active)]";
  }

  if (bar.isPast) {
    switch (bar.tone) {
      case "danger":
        return "bg-[color:var(--color-failed)]/85";
      case "warning":
        return "bg-[color:var(--color-waiting)]/80";
      default:
        return "bg-[color:var(--color-active)]/55";
    }
  }

  switch (bar.tone) {
    case "danger":
      return "bg-[color:var(--color-failed)]/35";
    case "warning":
      return "bg-[color:var(--color-waiting)]/35";
    default:
      return "bg-white/12";
  }
}

export function buildLaneSummaryToggleCopy(
  lanes: LaneContextSummary[],
  open: boolean,
) {
  if (lanes.length === 0) {
    return open ? "No active lanes" : "No lane summaries";
  }

  const selectedLane = lanes.find((lane) => lane.isSelected);
  if (selectedLane) {
    return open
      ? `${selectedLane.laneName} selected`
      : `${selectedLane.laneName} highlighted`;
  }

  return open ? `${lanes.length} lanes expanded` : `${lanes.length} lanes`;
}

function findActivePointIndex(observability: ContextObservabilityModel) {
  return observability.timelinePoints.findIndex(
    (point) => point.eventId === observability.activeEventId,
  );
}

function resolveBucketRiskRatio(
  observability: ContextObservabilityModel,
  peakBucketTokens: number,
) {
  if (!observability.maxContextWindowTokens || observability.maxContextWindowTokens <= 0) {
    return null;
  }

  return peakBucketTokens / observability.maxContextWindowTokens;
}

function buildTimelineBar(args: BuildTimelineBarArgs) {
  const startIndex = args.barIndex * args.bucketSize;
  const endIndex = Math.min(startIndex + args.bucketSize, args.observability.timelinePoints.length);
  const bucket = args.observability.timelinePoints.slice(startIndex, endIndex);
  const peakBucketTokens = Math.max(...bucket.map((point) => point.contextWindowTokens), 0);
  const tone = resolveTimelineTone(resolveBucketRiskRatio(args.observability, peakBucketTokens));

  return {
    heightRatio: Math.max(peakBucketTokens / args.peakWindowTokens, MIN_TIMELINE_BAR_RATIO),
    isActive: args.activeIndex >= startIndex && args.activeIndex < endIndex,
    isPast: endIndex - 1 < args.activeIndex,
    key: bucket[bucket.length - 1]?.eventId ?? `bar-${args.barIndex}`,
    tone,
  } satisfies ContextTimelineBar;
}

function resolveTimelineTone(ratio: number | null): ContextTimelineBar["tone"] {
  if (ratio === null) {
    return "default";
  }

  if (ratio >= 0.85) {
    return "danger";
  }

  if (ratio >= 0.65) {
    return "warning";
  }

  return "default";
}
