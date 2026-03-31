import type { ContextObservabilityModel } from "../../../entities/run";
import { formatTokenValue } from "./graphContextRailHelpers";

export interface GraphContextRailPresentation {
  activeEventLabel: string;
  causeEventLabel: string;
  cumulativeValueLabel: string;
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
    causeEventLabel: state.latestMeasuredPoint.eventTitle,
    cumulativeValueLabel: formatTokenValue(state.activePoint.cumulativeContextTokens),
  } satisfies GraphContextRailPresentation;
}

function resolveGraphContextRailState(observability: ContextObservabilityModel) {
  const activePoint = resolveActivePoint(observability);
  if (!canRenderMeasuredCard(activePoint)) {
    return null;
  }

  return {
    activePoint,
    latestMeasuredPoint:
      resolveLatestMeasuredPoint(observability, activePoint.eventId) ?? activePoint,
  };
}

function resolveActivePoint(observability: ContextObservabilityModel) {
  return observability.activeEventId
    ? observability.pointsByEventId.get(observability.activeEventId) ?? null
    : null;
}

function canRenderMeasuredCard(
  activePoint: ContextObservabilityModel["timelinePoints"][number] | null,
): activePoint is ContextObservabilityModel["timelinePoints"][number] {
  return activePoint?.hasMeasuredContextState === true;
}

function resolveLatestMeasuredPoint(
  observability: ContextObservabilityModel,
  activeEventId: string,
) {
  const activeIndex = observability.timelinePoints.findIndex(
    (point) => point.eventId === activeEventId,
  );
  if (activeIndex < 0) {
    return null;
  }

  return observability.timelinePoints
    .slice(0, activeIndex + 1)
    .reverse()
    .find((point) => point.hasMeasuredRuntimeUsage);
}
