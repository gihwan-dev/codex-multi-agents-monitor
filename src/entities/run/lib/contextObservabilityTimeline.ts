import type { ContextTimelinePoint, EventRecord } from "../model/types.js";
import {
  isCompactionEvent,
  resolveMeasuredContextWindowTokens,
  resolveMeasuredCumulativeTokens,
  resolveTotalTokens,
} from "./contextObservabilityShared.js";

interface ContextTimelineState {
  cumulativeContextTokens: number;
  currentContextWindowTokens: number;
  hasMeasuredContextState: boolean;
  pointsByEventId: Map<string, ContextTimelinePoint>;
}

export function buildContextTimelinePoints(events: EventRecord[]) {
  return events.reduce(advanceContextTimelineState, createContextTimelineState()).pointsByEventId;
}

function createContextTimelineState(): ContextTimelineState {
  return {
    cumulativeContextTokens: 0,
    currentContextWindowTokens: 0,
    hasMeasuredContextState: false,
    pointsByEventId: new Map(),
  };
}

function advanceContextTimelineState(state: ContextTimelineState, event: EventRecord) {
  const nextState = buildNextTimelineState(state, event);
  state.cumulativeContextTokens = nextState.cumulativeContextTokens;
  state.currentContextWindowTokens = nextState.currentContextWindowTokens;
  state.hasMeasuredContextState = nextState.hasMeasuredContextState;
  state.pointsByEventId.set(event.eventId, buildContextTimelinePoint(event, nextState));
  return state;
}

function buildContextTimelinePoint(
  event: EventRecord,
  state: Pick<
    ContextTimelineState,
    | "cumulativeContextTokens"
    | "currentContextWindowTokens"
    | "hasMeasuredContextState"
    | "pointsByEventId"
  >,
): ContextTimelinePoint {
  return {
    eventId: event.eventId,
    eventTitle: event.title,
    laneId: event.laneId,
    inputTokens: event.tokensIn,
    outputTokens: event.tokensOut,
    totalTokens: resolveTotalTokens(event),
    cumulativeContextTokens: state.cumulativeContextTokens,
    contextWindowTokens: state.currentContextWindowTokens,
    hasMeasuredContextState: state.hasMeasuredContextState,
    hasMeasuredRuntimeUsage: hasMeasuredRuntimeUsage(event),
    hasCompaction: isCompactionEvent(event),
  };
}

function buildNextTimelineState(state: ContextTimelineState, event: EventRecord) {
  return {
    ...state,
    cumulativeContextTokens: resolveNextCumulativeContextTokens(
      state.cumulativeContextTokens,
      event,
    ),
    currentContextWindowTokens: resolveNextContextWindowTokens(
      state.currentContextWindowTokens,
      event,
    ),
    hasMeasuredContextState: resolveHasMeasuredContextState(state, event),
  };
}

function resolveNextContextWindowTokens(currentContextWindowTokens: number, event: EventRecord) {
  const measuredContextWindowTokens = resolveMeasuredContextWindowTokens(event);
  if (measuredContextWindowTokens != null) {
    return measuredContextWindowTokens;
  }

  if (isCompactionEvent(event)) {
    return 0;
  }

  return currentContextWindowTokens;
}

function resolveNextCumulativeContextTokens(
  currentCumulativeContextTokens: number,
  event: EventRecord,
) {
  return resolveMeasuredCumulativeTokens(event) ?? currentCumulativeContextTokens;
}

function resolveHasMeasuredContextState(
  state: ContextTimelineState,
  event: EventRecord,
) {
  return state.hasMeasuredContextState || hasMeasuredRuntimeUsage(event);
}

function hasMeasuredRuntimeUsage(event: EventRecord) {
  return (
    resolveMeasuredContextWindowTokens(event) != null ||
    resolveMeasuredCumulativeTokens(event) != null
  );
}
