import type {
  AnomalyJump,
  EventRecord,
  GapSegment,
  LaneDisplay,
  LaneDisplayItem,
  MapNode,
  RunDataset,
  RunFilters,
  RunGroup,
  SelectionState,
  SummaryMetrics,
  WaterfallSegment,
} from "./types.js";

const GAP_THRESHOLD_MS = 90_000;
const LARGE_RUN_EVENT_THRESHOLD = 120;
const LARGE_RUN_LANE_THRESHOLD = 8;

function eventMatchesFilters(event: EventRecord, filters: RunFilters): boolean {
  if (filters.agentId && event.agentId !== filters.agentId) {
    return false;
  }

  if (filters.eventType !== "all" && event.eventType !== filters.eventType) {
    return false;
  }

  if (filters.errorOnly && event.status !== "failed" && event.eventType !== "error") {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const query = filters.search.toLowerCase();
  return [
    event.title,
    event.outputPreview ?? "",
    event.inputPreview ?? "",
    event.waitReason ?? "",
    event.errorMessage ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

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

export function calculateSummaryMetrics(dataset: RunDataset): SummaryMetrics {
  const events = dataset.events;
  const totalTokens = events.reduce((acc, event) => acc + event.tokensIn + event.tokensOut, 0);
  const activeTimeMs = events.reduce(
    (acc, event) =>
      acc + (["llm.started", "llm.finished", "tool.started", "tool.finished"].includes(event.eventType) ? event.durationMs : 0),
    0,
  );
  const errorCount = events.filter(
    (event) => event.status === "failed" || event.eventType === "error",
  ).length;
  const timePoints = events.flatMap((event) => [event.startTs, event.endTs ?? event.startTs]);
  const peakParallelism = calculatePeakParallelism(events);
  const durationMs =
    dataset.run.durationMs ||
    Math.max(...timePoints) - Math.min(...timePoints);

  return {
    totalDurationMs: durationMs,
    activeTimeMs,
    idleTimeMs: Math.max(durationMs - activeTimeMs, 0),
    agentCount: dataset.lanes.length,
    peakParallelism,
    llmCalls: events.filter((event) => event.eventType === "llm.finished").length,
    toolCalls: events.filter((event) => event.eventType === "tool.finished").length,
    tokens: totalTokens,
    costUsd: Number(events.reduce((acc, event) => acc + event.costUsd, 0).toFixed(2)),
    errorCount,
  };
}

export function buildAnomalyJumps(dataset: RunDataset): AnomalyJump[] {
  const events = [...dataset.events].sort((a, b) => a.startTs - b.startTs);
  const firstError = events.find((event) => event.status === "failed" || event.eventType === "error");
  const waitingEvent = [...events]
    .filter((event) => ["waiting", "blocked", "interrupted"].includes(event.status))
    .sort((a, b) => b.durationMs - a.durationMs)[0];
  const lastHandoff = [...dataset.edges]
    .filter((edge) => edge.edgeType === "handoff")
    .sort((a, b) => {
      const sourceA = events.find((event) => event.eventId === a.sourceEventId)?.startTs ?? 0;
      const sourceB = events.find((event) => event.eventId === b.sourceEventId)?.startTs ?? 0;
      return sourceB - sourceA;
    })[0];
  const finalArtifact = dataset.artifacts.find(
    (artifact) => artifact.artifactId === dataset.run.finalArtifactId,
  );
  const expensive = [...events].sort((a, b) => b.costUsd - a.costUsd)[0];

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

export function groupRuns(datasets: RunDataset[]): RunGroup[] {
  const sorted = [...datasets].sort((a, b) => {
    const priority = (dataset: RunDataset) => {
      if (dataset.run.liveMode === "live") {
        return 0;
      }

      if (["waiting", "blocked", "interrupted"].includes(dataset.run.status)) {
        return 1;
      }

      if (dataset.run.status === "failed") {
        return 2;
      }

      return 3;
    };

    return priority(a) - priority(b) || b.run.startTs - a.run.startTs;
  });

  const running = sorted.filter(
    (dataset) =>
      dataset.run.liveMode === "live" &&
      ["running", "stale", "disconnected"].includes(dataset.run.status),
  );
  const waiting = sorted.filter((dataset) =>
    ["waiting", "blocked", "interrupted"].includes(dataset.run.status),
  );
  const recent = sorted.filter(
    (dataset) => !running.includes(dataset) && !waiting.includes(dataset),
  );

  return [
    {
      title: "Running",
      runs: running,
    },
    {
      title: "Waiting",
      runs: waiting,
    },
    {
      title: "Recent",
      runs: recent,
    },
  ];
}

function buildGaps(
  events: EventRecord[],
  laneId: string,
): Array<{ event: EventRecord } | { gap: GapSegment; events: EventRecord[] }> {
  const sorted = [...events].sort((a, b) => a.startTs - b.startTs);
  const items: ({ event: EventRecord } | { gap: GapSegment; events: EventRecord[] })[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = sorted[index - 1];
    if (previous) {
      const delta = current.startTs - (previous.endTs ?? previous.startTs);
      if (delta >= GAP_THRESHOLD_MS) {
        items.push({
          gap: {
            gapId: `${laneId}-${previous.eventId}-${current.eventId}`,
            laneId,
            startTs: previous.endTs ?? previous.startTs,
            endTs: current.startTs,
            durationMs: delta,
            hiddenCount: 1,
            idleLaneCount: 1,
          },
          events: [current],
        });
      }
    }

    items.push({ event: current });
  }

  return items;
}

export function buildLaneDisplays(
  dataset: RunDataset,
  filters: RunFilters,
  collapsedGapIds: Set<string>,
): LaneDisplay[] {
  const largeRun = dataset.events.length > LARGE_RUN_EVENT_THRESHOLD || dataset.lanes.length > LARGE_RUN_LANE_THRESHOLD;
  const anomalies = new Set(
    buildAnomalyJumps(dataset)
      .filter((item) => item.selection.kind === "event")
      .map((item) => item.selection.id),
  );

  return dataset.lanes.map((lane, laneIndex) => {
    const filteredEvents = dataset.events.filter(
      (event) => event.laneId === lane.laneId && eventMatchesFilters(event, filters),
    );
    const items: LaneDisplayItem[] = buildGaps(filteredEvents, lane.laneId).reduce(
      (acc, item) => {
      if ("gap" in item) {
        if (collapsedGapIds.has(item.gap.gapId)) {
            acc.push({ kind: "gap", gap: item.gap, events: item.events });
            return acc;
        }

          item.events.forEach((event) => {
            acc.push({ kind: "event", event });
          });
          return acc;
      }

        acc.push({ kind: "event", event: item.event });
        return acc;
      },
      [] as LaneDisplayItem[],
    );

    const hiddenByDegradation =
      largeRun &&
      laneIndex >= LARGE_RUN_LANE_THRESHOLD &&
      lane.laneStatus === "done" &&
      !filteredEvents.some((event) => anomalies.has(event.eventId));

    return {
      lane,
      items,
      hiddenByDegradation,
    };
  });
}

export function buildWaterfallSegments(dataset: RunDataset): WaterfallSegment[] {
  const start = dataset.run.startTs;
  const totalDuration = Math.max(dataset.run.durationMs, 1);

  return dataset.events.map((event) => ({
    eventId: event.eventId,
    laneId: event.laneId,
    title: event.title,
    leftPercent: ((event.startTs - start) / totalDuration) * 100,
    widthPercent: Math.max((event.durationMs / totalDuration) * 100, 2),
    status: event.status,
  }));
}

export function buildMapNodes(dataset: RunDataset): MapNode[] {
  return dataset.lanes.map((lane) => {
    const laneEvents = dataset.events.filter((event) => event.laneId === lane.laneId);
    return {
      lane,
      statusCount: laneEvents.length,
      blockedCount: laneEvents.filter((event) => event.status === "blocked").length,
      waitingCount: laneEvents.filter((event) => event.status === "waiting").length,
      doneCount: laneEvents.filter((event) => event.status === "done").length,
    };
  });
}

export function findSelectionDetails(
  dataset: RunDataset,
  selection: SelectionState | null,
): EventRecord | RunDataset["edges"][number] | RunDataset["artifacts"][number] | null {
  if (!selection) {
    return null;
  }

  if (selection.kind === "event") {
    return dataset.events.find((event) => event.eventId === selection.id) ?? null;
  }

  if (selection.kind === "edge") {
    return dataset.edges.find((edge) => edge.edgeId === selection.id) ?? null;
  }

  return dataset.artifacts.find((artifact) => artifact.artifactId === selection.id) ?? null;
}

export function defaultCollapsedGapIds(dataset: RunDataset): Set<string> {
  const ids = new Set<string>();
  for (const lane of dataset.lanes) {
    const laneEvents = dataset.events.filter((event) => event.laneId === lane.laneId);
    for (const item of buildGaps(laneEvents, lane.laneId)) {
      if ("gap" in item) {
        ids.add(item.gap.gapId);
      }
    }
  }
  return ids;
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
