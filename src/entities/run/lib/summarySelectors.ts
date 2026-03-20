import { formatDuration } from "../../../shared/lib/format";
import type {
  AnomalyJump,
  EventRecord,
  RunDataset,
  SelectionPath,
  SummaryFact,
  SummaryMetrics,
} from "../model/types.js";
import { sortEvents } from "./selectorShared.js";

function calculatePeakParallelism(events: EventRecord[]): number {
  const points = events.flatMap((event) => {
    const endTs = event.endTs ?? event.startTs;
    return [
      { ts: event.startTs, laneId: event.laneId, delta: 1 as const },
      { ts: endTs, laneId: event.laneId, delta: -1 as const },
    ];
  });

  points.sort((left, right) => {
    if (left.ts !== right.ts) {
      return left.ts - right.ts;
    }
    return left.delta - right.delta;
  });

  const activeByLane = new Map<string, number>();
  let peak = 0;

  for (const point of points) {
    const current = activeByLane.get(point.laneId) ?? 0;
    const next = current + point.delta;
    if (next <= 0) {
      activeByLane.delete(point.laneId);
    } else {
      activeByLane.set(point.laneId, next);
    }
    peak = Math.max(peak, activeByLane.size);
  }

  return peak || 1;
}

function calculateLongestGap(events: EventRecord[]) {
  const orderedEvents = sortEvents(events);
  let longestGapMs = 0;

  for (let index = 1; index < orderedEvents.length; index += 1) {
    const previous = orderedEvents[index - 1];
    const current = orderedEvents[index];
    if (!previous || !current) {
      continue;
    }

    const previousEndTs = previous.endTs ?? previous.startTs;
    longestGapMs = Math.max(longestGapMs, current.startTs - previousEndTs);
  }

  return Math.max(longestGapMs, 0);
}

function hasTokenUsage(event: EventRecord) {
  return event.tokensIn > 0 || event.tokensOut > 0 || event.reasoningTokens > 0;
}

function countsAsLlmCall(event: EventRecord) {
  if (event.eventType === "llm.finished") {
    return true;
  }

  // Session logs often attach token_count to the assistant note instead of
  // emitting an explicit llm.finished event. Count those outputs once so the
  // summary stays aligned with the visible token totals.
  return event.eventType === "note" && hasTokenUsage(event);
}

function findLastHandoff(dataset: RunDataset, orderedEvents: EventRecord[]) {
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
    (acc, event) => acc + event.tokensIn + event.tokensOut + event.reasoningTokens,
    0,
  );
  const activeTimeMs = events.reduce(
    (acc, event) =>
      acc +
      (["llm.started", "llm.finished", "tool.started", "tool.finished"].includes(
        event.eventType,
      )
        ? event.durationMs
        : 0),
    0,
  );
  const errorCount = events.filter(
    (event) => event.status === "failed" || event.eventType === "error",
  ).length;
  const timePoints = events.flatMap((event) => [event.startTs, event.endTs ?? event.startTs]);
  const peakParallelism = calculatePeakParallelism(events);
  const longestGapMs = calculateLongestGap(events);
  const derivedDurationMs =
    timePoints.length > 0 ? Math.max(...timePoints) - Math.min(...timePoints) : 0;
  const durationMs = dataset.run.durationMs || derivedDurationMs;

  return {
    totalDurationMs: durationMs,
    activeTimeMs,
    idleTimeMs: Math.max(durationMs - activeTimeMs, 0),
    longestGapMs,
    agentCount: dataset.lanes.length,
    peakParallelism,
    llmCalls: events.filter(countsAsLlmCall).length,
    toolCalls: events.filter((event) => event.eventType === "tool.finished").length,
    tokens: totalTokens,
    costUsd: Number(events.reduce((acc, event) => acc + event.costUsd, 0).toFixed(2)),
    errorCount,
  };
}

export function buildAnomalyJumps(dataset: RunDataset): AnomalyJump[] {
  const events = sortEvents(dataset.events);
  const firstError = events.find(
    (event) => event.status === "failed" || event.eventType === "error",
  );
  const waitingEvent = [...events]
    .filter((event) => ["waiting", "blocked", "interrupted"].includes(event.status))
    .sort((left, right) => right.durationMs - left.durationMs)[0];
  const lastHandoff = findLastHandoff(dataset, events);
  const finalArtifact = dataset.artifacts.find(
    (artifact) => artifact.artifactId === dataset.run.finalArtifactId,
  );
  const expensive = [...events].sort((left, right) => right.costUsd - left.costUsd)[0];

  return [
    waitingEvent && {
      label: "Longest wait",
      selection: { kind: "event" as const, id: waitingEvent.eventId },
      emphasis: "warning" as const,
    },
    firstError && {
      label: "First error",
      selection: { kind: "event" as const, id: firstError.eventId },
      emphasis: "danger" as const,
    },
    expensive && {
      label: "Most expensive",
      selection: { kind: "event" as const, id: expensive.eventId },
      emphasis: "accent" as const,
    },
    lastHandoff && {
      label: "Last handoff",
      selection: { kind: "edge" as const, id: lastHandoff.edgeId },
      emphasis: "accent" as const,
    },
    finalArtifact && {
      label: "Final artifact",
      selection: { kind: "artifact" as const, id: finalArtifact.artifactId },
      emphasis: "default" as const,
    },
  ].filter(Boolean) as AnomalyJump[];
}

export function buildSummaryFacts(
  dataset: RunDataset,
  selectionPath: SelectionPath,
): SummaryFact[] {
  const orderedEvents = sortEvents(dataset.events);
  const blockerEvent =
    orderedEvents.find((event) => event.status === "blocked") ??
    orderedEvents.find((event) => event.status === "waiting") ??
    orderedEvents.find((event) => event.status === "interrupted") ??
    null;
  const selectionEventIdSet = new Set(selectionPath.eventIds);
  const affectedLaneIds = new Set(
    orderedEvents
      .filter(
        (event) =>
          selectionEventIdSet.has(event.eventId) &&
          ["waiting", "blocked", "interrupted", "failed"].includes(event.status),
      )
      .map((event) => event.laneId),
  );
  if (blockerEvent) {
    affectedLaneIds.delete(blockerEvent.laneId);
  }

  const lastHandoff = findLastHandoff(dataset, orderedEvents);
  const firstFailure = orderedEvents.find(
    (event) => event.status === "failed" || event.eventType === "error",
  );
  const blockerLaneName = blockerEvent
    ? dataset.lanes.find((lane) => lane.laneId === blockerEvent.laneId)?.name ?? blockerEvent.title
    : "n/a";
  const lastHandoffLabel = lastHandoff
    ? (() => {
        const source =
          dataset.lanes.find((lane) => lane.agentId === lastHandoff.sourceAgentId)?.name ??
          "Unknown";
        const target =
          dataset.lanes.find((lane) => lane.agentId === lastHandoff.targetAgentId)?.name ??
          "Unknown";
        return `${source} -> ${target}`;
      })()
    : "n/a";

  return [
    {
      label: "Blocked by",
      value: blockerLaneName,
      emphasis: blockerEvent ? "warning" : "default",
    },
    {
      label: "Affected",
      value: `${affectedLaneIds.size}`,
      emphasis: affectedLaneIds.size ? "accent" : "default",
    },
    {
      label: "Last handoff",
      value: lastHandoffLabel,
      emphasis: lastHandoff ? "accent" : "default",
    },
    {
      label: "Longest gap",
      value: formatDuration(dataset.run.summaryMetrics.longestGapMs),
      emphasis: "default",
    },
    {
      label: "First failure",
      value: firstFailure?.title ?? "None",
      emphasis: firstFailure ? "danger" : "default",
    },
  ];
}

export function hasRawPayload(dataset: RunDataset): boolean {
  if (dataset.run.rawIncluded) {
    return true;
  }

  return (
    dataset.events.some((event) => Boolean(event.rawInput || event.rawOutput)) ||
    dataset.artifacts.some((artifact) => Boolean(artifact.rawContent))
  );
}
