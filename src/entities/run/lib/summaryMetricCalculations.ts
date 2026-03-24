import type {
  EventRecord,
  RunDataset,
  SummaryMetrics,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";

type ParallelismPoint = {
  ts: number;
  laneId: string;
  delta: 1 | -1;
};

function buildParallelismPoints(events: EventRecord[]): ParallelismPoint[] {
  return events.flatMap((event) => {
    const endTs = event.endTs ?? event.startTs;
    return [
      { ts: event.startTs, laneId: event.laneId, delta: 1 as const },
      { ts: endTs, laneId: event.laneId, delta: -1 as const },
    ];
  });
}

function sortParallelismPoints(points: ParallelismPoint[]) {
  points.sort((left, right) => {
    if (left.ts !== right.ts) {
      return left.ts - right.ts;
    }

    return left.delta - right.delta;
  });
}

function applyParallelismPoint(
  activeByLane: Map<string, number>,
  point: ParallelismPoint,
) {
  const nextCount = (activeByLane.get(point.laneId) ?? 0) + point.delta;
  if (nextCount <= 0) {
    activeByLane.delete(point.laneId);
    return;
  }

  activeByLane.set(point.laneId, nextCount);
}

function calculatePeakParallelism(events: EventRecord[]): number {
  const activeByLane = new Map<string, number>();
  const points = buildParallelismPoints(events);
  let peak = 0;

  sortParallelismPoints(points);
  for (const point of points) {
    applyParallelismPoint(activeByLane, point);
    peak = Math.max(peak, activeByLane.size);
  }

  return peak || 1;
}

function calculateLongestGap(events: EventRecord[]) {
  const orderedEvents = sortEvents(events);
  const longestGapMs = orderedEvents.slice(1).reduce((longestGap, current, index) => {
    const previous = orderedEvents[index];
    const previousEndTs = previous?.endTs ?? previous?.startTs ?? current.startTs;
    return Math.max(longestGap, current.startTs - previousEndTs);
  }, 0);

  return Math.max(longestGapMs, 0);
}

function hasTokenUsage(event: EventRecord) {
  return event.tokensIn > 0 || event.tokensOut > 0 || event.reasoningTokens > 0;
}

function countsAsLlmCall(event: EventRecord) {
  if (event.eventType === "llm.finished") {
    return true;
  }

  return event.eventType === "note" && hasTokenUsage(event);
}

function isTrackedActiveEvent(event: EventRecord) {
  return ["llm.started", "llm.finished", "tool.started", "tool.finished"].includes(event.eventType);
}

function calculateActiveTime(events: EventRecord[]) {
  return events.reduce(
    (activeTimeMs, event) => activeTimeMs + (isTrackedActiveEvent(event) ? event.durationMs : 0),
    0,
  );
}

function calculateDerivedDuration(events: EventRecord[]) {
  const timePoints = events.flatMap((event) => [event.startTs, event.endTs ?? event.startTs]);
  return timePoints.length > 0 ? Math.max(...timePoints) - Math.min(...timePoints) : 0;
}

export function findLastHandoff(dataset: RunDataset, orderedEvents: EventRecord[]) {
  return (
    [...dataset.edges]
      .filter((edge) => edge.edgeType === "handoff")
      .sort((left, right) => {
        const sourceA =
          orderedEvents.find((event) => event.eventId === left.sourceEventId)?.startTs ?? 0;
        const sourceB =
          orderedEvents.find((event) => event.eventId === right.sourceEventId)?.startTs ?? 0;
        return sourceB - sourceA;
      })[0] ?? null
  );
}

export function calculateSummaryMetrics(dataset: RunDataset): SummaryMetrics {
  const events = dataset.events;
  const totalTokens = events.reduce(
    (tokenCount, event) => tokenCount + event.tokensIn + event.tokensOut + event.reasoningTokens,
    0,
  );
  const activeTimeMs = calculateActiveTime(events);
  const durationMs = dataset.run.durationMs || calculateDerivedDuration(events);

  return {
    totalDurationMs: durationMs,
    activeTimeMs,
    idleTimeMs: Math.max(durationMs - activeTimeMs, 0),
    longestGapMs: calculateLongestGap(events),
    agentCount: dataset.lanes.length,
    peakParallelism: calculatePeakParallelism(events),
    llmCalls: events.filter(countsAsLlmCall).length,
    toolCalls: events.filter((event) => event.eventType === "tool.finished").length,
    tokens: totalTokens,
    costUsd: Number(events.reduce((cost, event) => cost + event.costUsd, 0).toFixed(2)),
    errorCount: events.filter(
      (event) => event.status === "failed" || event.eventType === "error",
    ).length,
  };
}
