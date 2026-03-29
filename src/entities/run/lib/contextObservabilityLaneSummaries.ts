import type {
  AgentLane,
  ContextTimelinePoint,
  EventRecord,
  LaneContextSummary,
  RunDataset,
} from "../model/types.js";
import { buildReturnedEventIdsByLane } from "./contextObservabilityReturnedEvents.js";
import {
  classifyLaneKind,
  compareLaneSummaries,
  isCompactionEvent,
  resolveFallbackReturnedTokens,
  resolveMeasuredContextWindowTokens,
  resolveTotalTokens,
  shouldIncludeLaneSummary,
} from "./contextObservabilityShared.js";

interface LaneAccumulator {
  lane: AgentLane;
  compactionCount: number;
  contextImportedTokens: number;
  contextReturnedTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface BuildLaneAccumulatorArgs {
  lane: AgentLane;
  orderedEvents: EventRecord[];
  pointsByEventId: Map<string, ContextTimelinePoint>;
  returnedEventIds: Set<string> | undefined;
}

interface LaneEventMetrics {
  compactionCount: number;
  contextImportedTokens: number;
  contextReturnedTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface SummarizeLaneEventsArgs {
  laneEvents: EventRecord[];
  pointsByEventId: Map<string, ContextTimelinePoint>;
  returnedEventIds: Set<string> | undefined;
}

interface AccumulateLaneEventArgs {
  metrics: LaneEventMetrics;
  event: EventRecord;
  pointsByEventId: Map<string, ContextTimelinePoint>;
  returnedEventIds: Set<string> | undefined;
}

export function buildLaneSummaries(
  dataset: RunDataset,
  orderedEvents: EventRecord[],
  pointsByEventId: Map<string, ContextTimelinePoint>,
): Omit<LaneContextSummary, "isSelected">[] {
  const totalContextTokens =
    dataset.run.summaryMetrics.tokens ||
    orderedEvents.reduce((sum, event) => sum + resolveTotalTokens(event), 0);
  const returnedEventIdsByLane = buildReturnedEventIdsByLane(dataset);

  return dataset.lanes
    .map((lane) =>
      buildLaneAccumulator({
        lane,
        orderedEvents,
        pointsByEventId,
        returnedEventIds: returnedEventIdsByLane.get(lane.laneId),
      }),
    )
    .filter((lane) => shouldIncludeLaneSummary(lane))
    .map((lane) => buildLaneSummary(lane, totalContextTokens))
    .sort(compareLaneSummaries);
}

function buildLaneAccumulator({
  lane,
  orderedEvents,
  pointsByEventId,
  returnedEventIds,
}: BuildLaneAccumulatorArgs): LaneAccumulator {
  const laneEvents = orderedEvents.filter((event) => event.laneId === lane.laneId);
  const metrics = summarizeLaneEvents({
    laneEvents,
    pointsByEventId,
    returnedEventIds,
  });

  return {
    lane,
    ...finalizeLaneMetrics(lane, laneEvents, metrics),
  };
}

function summarizeLaneEvents({
  laneEvents,
  pointsByEventId,
  returnedEventIds,
}: SummarizeLaneEventsArgs): LaneEventMetrics {
  return laneEvents.reduce(
    (metrics, event) =>
      accumulateLaneEvent({
        metrics,
        event,
        pointsByEventId,
        returnedEventIds,
      }),
    createLaneEventMetrics(),
  );
}

function accumulateLaneEvent({
  metrics,
  event,
  pointsByEventId,
  returnedEventIds,
}: AccumulateLaneEventArgs): LaneEventMetrics {
  const point = pointsByEventId.get(event.eventId);

  return {
    compactionCount: metrics.compactionCount + (isCompactionEvent(event) ? 1 : 0),
    contextImportedTokens:
      metrics.contextImportedTokens || resolveMeasuredContextWindowTokens(event),
    contextReturnedTokens:
      metrics.contextReturnedTokens + (returnedEventIds?.has(event.eventId) ? event.tokensOut : 0),
    inputTokens: metrics.inputTokens + event.tokensIn,
    outputTokens: metrics.outputTokens + event.tokensOut,
    totalTokens: metrics.totalTokens + (point?.totalTokens ?? resolveTotalTokens(event)),
  };
}

function finalizeLaneMetrics(
  lane: AgentLane,
  laneEvents: EventRecord[],
  metrics: LaneEventMetrics,
): LaneEventMetrics {
  if (metrics.contextReturnedTokens > 0 || lane.role === "session") {
    return metrics;
  }

  return {
    ...metrics,
    contextReturnedTokens: resolveFallbackReturnedTokens(laneEvents),
  };
}

function createLaneEventMetrics(): LaneEventMetrics {
  return {
    compactionCount: 0,
    contextImportedTokens: 0,
    contextReturnedTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

function buildLaneSummary(
  lane: LaneAccumulator,
  totalContextTokens: number,
): Omit<LaneContextSummary, "isSelected"> {
  return {
    laneId: lane.lane.laneId,
    laneName: lane.lane.name,
    laneRole: lane.lane.role,
    laneKind: classifyLaneKind(lane.lane),
    inputTokens: lane.inputTokens,
    outputTokens: lane.outputTokens,
    totalTokens: lane.totalTokens,
    contextImportedTokens: lane.contextImportedTokens,
    contextReturnedTokens: lane.contextReturnedTokens,
    compactionCount: lane.compactionCount,
    shareOfTotalContext: totalContextTokens > 0 ? lane.totalTokens / totalContextTokens : 0,
    estimatedMainContextSaved:
      lane.lane.role === "session"
        ? 0
        : Math.max(lane.outputTokens - lane.contextReturnedTokens, 0),
  };
}
