import type {
  ContextObservabilityModel,
  ContextTimelinePoint,
} from "../../../entities/run";
import {
  formatDeltaLabel,
  formatTokenValue,
  resolveChangeTone,
  resolveRailTone,
} from "./graphContextRailHelpers";

export interface GraphContextRailPresentation {
  activeEventLabel: string;
  activeValueLabel: string;
  changeDeltaLabel: string;
  changeEventLabel: string;
  changeTone: "default" | "warning" | "danger" | "success";
  cumulativeValueLabel: string;
  fillRatio: number;
  hasLimit: boolean;
  hasUsage: boolean;
  maxValueLabel: string;
  progressLabel: string;
  tone: "default" | "warning" | "danger";
}

interface BuildGraphContextRailPresentationArgs {
  observability: ContextObservabilityModel;
}

export function buildGraphContextRailPresentation(
  args: BuildGraphContextRailPresentationArgs,
) {
  const { observability } = args;
  if (observability.timelinePoints.length === 0 || !observability.activeEventId) {
    return null;
  }

  const state = resolveGraphContextRailState(observability);
  if (!state) {
    return null;
  }

  return {
    activeEventLabel: state.activePoint.eventTitle,
    activeValueLabel: formatTokenValue(state.activePoint.contextWindowTokens),
    changeDeltaLabel: formatDeltaLabel(
      state.latestChangeDelta,
      state.latestChangePoint.hasCompaction,
    ),
    changeEventLabel: state.latestChangePoint.eventTitle,
    changeTone: resolveChangeTone(
      state.latestChangeDelta,
      state.latestChangePoint.hasCompaction,
    ),
    cumulativeValueLabel: formatTokenValue(state.activePoint.cumulativeContextTokens),
    fillRatio: state.fillRatio,
    hasLimit: observability.maxContextWindowTokens !== null,
    hasUsage: state.activePoint.contextWindowTokens > 0,
    maxValueLabel: state.maxValueLabel,
    progressLabel: resolveProgressLabel(
      state.activePoint,
      observability.maxContextWindowTokens,
      state.maxValueLabel,
    ),
    tone: resolveRailTone(observability, state.fillRatio),
  } satisfies GraphContextRailPresentation;
}

function resolveActivePoint(
  observability: ContextObservabilityModel,
  activeEventId: string | null,
) {
  return activeEventId ? observability.pointsByEventId.get(activeEventId) ?? null : null;
}

function resolveLatestChangePoint(
  observability: ContextObservabilityModel,
  activeEventId: string,
) {
  const activeIndex = observability.timelinePoints.findIndex((point) => point.eventId === activeEventId);
  if (activeIndex < 0) {
    return null;
  }

  const visibleHistory = observability.timelinePoints.slice(0, activeIndex + 1).reverse();
  return (
    visibleHistory.find((point) => hasMeaningfulContextChange(observability, point)) ??
    observability.timelinePoints[activeIndex] ??
    null
  );
}

function resolveEventDelta(
  observability: ContextObservabilityModel,
  eventId: string | null,
) {
  if (!eventId) {
    return 0;
  }

  const activeIndex = observability.timelinePoints.findIndex((point) => point.eventId === eventId);
  if (activeIndex < 0) {
    return 0;
  }

  const currentPoint = observability.timelinePoints[activeIndex];
  const previousPoint = observability.timelinePoints[activeIndex - 1];
  return currentPoint.contextWindowTokens - (previousPoint?.contextWindowTokens ?? 0);
}

function resolveFillRatio(
  maxContextWindowTokens: number | null,
  activePoint: ContextTimelinePoint,
) {
  if (!maxContextWindowTokens) {
    return 0;
  }

  return Math.min(Math.max(activePoint.contextWindowTokens / maxContextWindowTokens, 0), 1);
}

function resolveProgressLabel(
  activePoint: ContextTimelinePoint,
  maxContextWindowTokens: number | null,
  maxValueLabel: string,
) {
  const currentValueLabel = formatTokenValue(activePoint.contextWindowTokens);
  return maxContextWindowTokens ? `${currentValueLabel} of ${maxValueLabel}` : currentValueLabel;
}

function hasMeaningfulContextChange(
  observability: ContextObservabilityModel,
  point: ContextTimelinePoint,
) {
  return point.hasCompaction || resolveEventDelta(observability, point.eventId) !== 0;
}

function resolveGraphContextRailState(observability: ContextObservabilityModel) {
  const activePoint = resolveActivePoint(observability, observability.activeEventId);
  if (!activePoint) {
    return null;
  }

  const latestChangePoint =
    resolveLatestChangePoint(observability, activePoint.eventId) ?? activePoint;
  const latestChangeDelta = resolveEventDelta(observability, latestChangePoint.eventId);

  return {
    activePoint,
    fillRatio: resolveFillRatio(observability.maxContextWindowTokens, activePoint),
    latestChangeDelta,
    latestChangePoint,
    maxValueLabel: formatTokenValue(observability.maxContextWindowTokens ?? 0),
  };
}
