import type {
  ContextObservabilityFocusSource,
  ContextObservabilityModel,
  ContextTimelinePoint,
  EventRecord,
  LaneContextSummary,
  RunDataset,
  SelectionState,
} from "../model/types.js";
import { buildLaneSummaries } from "./contextObservabilityLaneSummaries.js";
import {
  resolveActiveEventId,
  resolveActiveEventTitle,
} from "./contextObservabilitySelection.js";
import {
  isCompactionEvent,
  resolveMeasuredContextWindowTokens,
  resolveTotalTokens,
} from "./contextObservabilityShared.js";
import { sortEvents } from "./selectorShared.js";

export interface ContextObservabilityBase {
  laneSummaries: Omit<LaneContextSummary, "isSelected">[];
  maxContextWindowTokens: number | null;
  peakContextWindowTokens: number;
  peakCumulativeContextTokens: number;
  timelinePoints: ContextTimelinePoint[];
  pointsByEventId: Map<string, ContextTimelinePoint>;
}

interface ResolveContextObservabilityArgs {
  dataset: RunDataset;
  base: ContextObservabilityBase;
  selection: SelectionState | null;
  fallbackEventId: string | null;
}

interface ActiveContextState {
  activeEventId: string | null;
  activeEventTitle: string | null;
  activeLaneId: string | null;
  activeSource: ContextObservabilityFocusSource;
  activeContextWindowTokens: number;
  activeCumulativeContextTokens: number;
}

interface ContextTimelineState {
  cumulativeContextTokens: number;
  currentContextWindowTokens: number;
  pointsByEventId: Map<string, ContextTimelinePoint>;
}
export function buildContextObservabilityBase(dataset: RunDataset): ContextObservabilityBase {
  const orderedEvents = sortEvents(dataset.events);
  const pointsByEventId = buildPointsByEventId(orderedEvents);
  const timelinePoints = [...pointsByEventId.values()];

  return {
    laneSummaries: buildLaneSummaries(dataset, orderedEvents, pointsByEventId),
    maxContextWindowTokens: dataset.run.maxContextWindowTokens ?? null,
    peakContextWindowTokens: Math.max(
      ...timelinePoints.map((point) => point.contextWindowTokens),
      0,
    ),
    peakCumulativeContextTokens: Math.max(
      ...timelinePoints.map((point) => point.cumulativeContextTokens),
      0,
    ),
    timelinePoints,
    pointsByEventId,
  };
}

export function resolveContextObservability(
  args: ResolveContextObservabilityArgs,
): ContextObservabilityModel {
  const { dataset, base, selection, fallbackEventId } = args;
  const activeContext = resolveActiveContextState({
    dataset,
    base,
    fallbackEventId,
    selection,
  });

  return {
    ...activeContext,
    peakContextWindowTokens: base.peakContextWindowTokens,
    peakCumulativeContextTokens: base.peakCumulativeContextTokens,
    maxContextWindowTokens: base.maxContextWindowTokens,
    laneSummaries: buildSelectedLaneSummaries(base.laneSummaries, activeContext.activeLaneId),
    timelinePoints: base.timelinePoints,
    pointsByEventId: base.pointsByEventId,
  };
}
export function focusContextObservability(args: {
  observability: ContextObservabilityModel;
  activeEventId: string | null;
  activeSource: ContextObservabilityFocusSource;
}) {
  const { observability, activeEventId, activeSource } = args;
  const activePoint = resolveActivePoint(observability.pointsByEventId, activeEventId);

  return {
    ...observability,
    activeEventId: activePoint?.eventId ?? null,
    activeEventTitle: activePoint?.eventTitle ?? null,
    activeLaneId: resolveActiveLaneId(activePoint),
    activeSource,
    ...resolveActivePointMetrics(activePoint),
    laneSummaries: buildSelectedLaneSummaries(
      observability.laneSummaries,
      resolveActiveLaneId(activePoint),
    ),
  } satisfies ContextObservabilityModel;
}
function buildPointsByEventId(events: EventRecord[]) {
  return events.reduce(advanceContextTimelineState, createContextTimelineState()).pointsByEventId;
}

function createContextTimelineState(): ContextTimelineState {
  return {
    cumulativeContextTokens: 0,
    currentContextWindowTokens: 0,
    pointsByEventId: new Map<string, ContextTimelinePoint>(),
  };
}
function advanceContextTimelineState(state: ContextTimelineState, event: EventRecord) {
  const totalTokens = resolveTotalTokens(event);
  const contextWindowTokens = resolveNextContextWindowTokens(
    state.currentContextWindowTokens,
    event,
  );

  state.cumulativeContextTokens += totalTokens;
  state.currentContextWindowTokens = contextWindowTokens;
  state.pointsByEventId.set(
    event.eventId,
    buildContextTimelinePoint(event, totalTokens, state),
  );

  return state;
}
function buildContextTimelinePoint(
  event: EventRecord,
  totalTokens: number,
  state: Pick<ContextTimelineState, "cumulativeContextTokens" | "currentContextWindowTokens">,
): ContextTimelinePoint {
  return {
    eventId: event.eventId,
    eventTitle: event.title,
    laneId: event.laneId,
    inputTokens: event.tokensIn,
    outputTokens: event.tokensOut,
    totalTokens,
    cumulativeContextTokens: state.cumulativeContextTokens,
    contextWindowTokens: state.currentContextWindowTokens,
    hasCompaction: isCompactionEvent(event),
  };
}
function resolveNextContextWindowTokens(currentContextWindowTokens: number, event: EventRecord) {
  const measuredContextWindowTokens = resolveMeasuredContextWindowTokens(event);
  return measuredContextWindowTokens > 0 ? measuredContextWindowTokens : currentContextWindowTokens;
}

function resolveActiveContextState(args: ResolveContextObservabilityArgs): ActiveContextState {
  const activeEventId = resolveActiveEventId({
    dataset: args.dataset,
    fallbackEventId: args.fallbackEventId,
    pointsByEventId: args.base.pointsByEventId,
    selection: args.selection,
  });
  const activePoint = resolveActivePoint(args.base.pointsByEventId, activeEventId);
  const activeSource = args.selection ? "selection" : "latest";

  return {
    activeEventId,
    activeEventTitle:
      activePoint?.eventTitle ?? resolveActiveEventTitle(args.dataset, activeEventId),
    activeLaneId: resolveActiveLaneId(activePoint),
    activeSource,
    ...resolveActivePointMetrics(activePoint),
  };
}
function resolveActivePoint(
  pointsByEventId: Map<string, ContextTimelinePoint>,
  activeEventId: string | null,
) {
  if (!activeEventId) {
    return null;
  }

  return pointsByEventId.get(activeEventId) ?? null;
}
function resolveActiveLaneId(activePoint: ContextTimelinePoint | null) {
  return activePoint?.laneId ?? null;
}

function resolveActivePointMetrics(activePoint: ContextTimelinePoint | null) {
  return {
    activeContextWindowTokens: activePoint?.contextWindowTokens ?? 0,
    activeCumulativeContextTokens: activePoint?.cumulativeContextTokens ?? 0,
  };
}

function buildSelectedLaneSummaries(
  laneSummaries: ContextObservabilityBase["laneSummaries"],
  activeLaneId: string | null,
) {
  return laneSummaries.map((lane) => ({
    ...lane,
    isSelected: lane.laneId === activeLaneId,
  }));
}
