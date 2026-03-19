import {
  formatDuration,
  formatRelativeTime,
  formatTimestamp,
  truncateId,
} from "./format.js";
import type {
  AnomalyJump,
  EventRecord,
  GapSegment,
  GraphSceneEdgeBundle,
  GraphSceneModel,
  GraphSceneRow,
  InspectorCausalSummary,
  InspectorJump,
  QuickFilterSummary,
  RunDataset,
  RunFilters,
  SelectionPath,
  SelectionState,
  SummaryFact,
  SummaryMetrics,
  WorkspaceIdentityOverrideMap,
  WorkspaceRunRow,
  WorkspaceThreadGroup,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "./types.js";

const GAP_THRESHOLD_MS = 30_000;
const LARGE_RUN_LANE_THRESHOLD = 8;

function formatGapLabel(durationMs: number, idleLaneCount: number) {
  return `// ${formatDuration(durationMs)} hidden · ${idleLaneCount} lanes idle //`;
}

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

function sortEvents(events: EventRecord[]) {
  return [...events].sort((left, right) => left.startTs - right.startTs);
}

function sanitizeSidebarRunTitle(value: string) {
  return value
    .replace(/^(prompt|input|user(?:\s+message)?)(?:\s+preview)?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveWorkspaceRunTitle(dataset: RunDataset, orderedEvents: EventRecord[]) {
  const firstInputPreview = orderedEvents
    .map((event) => sanitizeSidebarRunTitle(event.inputPreview ?? ""))
    .find((value) => value.length > 0);

  if (firstInputPreview) {
    return firstInputPreview;
  }

  const sessionTitle = dataset.session.title.trim();
  if (sessionTitle.length > 0) {
    return sessionTitle;
  }

  return dataset.run.title;
}

function buildEdgeMaps(dataset: RunDataset) {
  const incomingByEventId = new Map<string, RunDataset["edges"]>();
  const outgoingByEventId = new Map<string, RunDataset["edges"]>();

  dataset.edges.forEach((edge) => {
    incomingByEventId.set(edge.targetEventId, [
      ...(incomingByEventId.get(edge.targetEventId) ?? []),
      edge,
    ]);
    outgoingByEventId.set(edge.sourceEventId, [
      ...(outgoingByEventId.get(edge.sourceEventId) ?? []),
      edge,
    ]);
  });

  return {
    incomingByEventId,
    outgoingByEventId,
  };
}

function buildLaneEventMaps(dataset: RunDataset) {
  const orderedByLaneId = new Map<string, EventRecord[]>();

  dataset.lanes.forEach((lane) => {
    orderedByLaneId.set(
      lane.laneId,
      sortEvents(dataset.events.filter((event) => event.laneId === lane.laneId)),
    );
  });

  const previousByEventId = new Map<string, EventRecord>();
  const nextByEventId = new Map<string, EventRecord>();

  orderedByLaneId.forEach((events) => {
    events.forEach((event, index) => {
      const previous = events[index - 1];
      const next = events[index + 1];
      if (previous) {
        previousByEventId.set(event.eventId, previous);
      }
      if (next) {
        nextByEventId.set(event.eventId, next);
      }
    });
  });

  return {
    orderedByLaneId,
    previousByEventId,
    nextByEventId,
  };
}

function resolveBaseEventIds(dataset: RunDataset, selection: SelectionState | null) {
  if (!selection) {
    return dataset.run.selectedByDefaultId ? [dataset.run.selectedByDefaultId] : [];
  }

  if (selection.kind === "event") {
    return [selection.id];
  }

  if (selection.kind === "edge") {
    const edge = dataset.edges.find((item) => item.edgeId === selection.id);
    return edge ? [edge.sourceEventId, edge.targetEventId] : [];
  }

  const artifact = dataset.artifacts.find((item) => item.artifactId === selection.id);
  return artifact ? [artifact.producerEventId] : [];
}

export function calculateSummaryMetrics(dataset: RunDataset): SummaryMetrics {
  const events = dataset.events;
  const totalTokens = events.reduce((acc, event) => acc + event.tokensIn + event.tokensOut, 0);
  const activeTimeMs = events.reduce(
    (acc, event) =>
      acc +
      (["llm.started", "llm.finished", "tool.started", "tool.finished"].includes(event.eventType)
        ? event.durationMs
        : 0),
    0,
  );
  const errorCount = events.filter(
    (event) => event.status === "failed" || event.eventType === "error",
  ).length;
  const timePoints = events.flatMap((event) => [event.startTs, event.endTs ?? event.startTs]);
  const peakParallelism = calculatePeakParallelism(events);
  const durationMs =
    dataset.run.durationMs || Math.max(...timePoints) - Math.min(...timePoints);

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
  const events = sortEvents(dataset.events);
  const firstError = events.find(
    (event) => event.status === "failed" || event.eventType === "error",
  );
  const waitingEvent = [...events]
    .filter((event) => ["waiting", "blocked", "interrupted"].includes(event.status))
    .sort((left, right) => right.durationMs - left.durationMs)[0];
  const lastHandoff = [...dataset.edges]
    .filter((edge) => edge.edgeType === "handoff")
    .sort((left, right) => {
      const sourceA = events.find((event) => event.eventId === left.sourceEventId)?.startTs ?? 0;
      const sourceB = events.find((event) => event.eventId === right.sourceEventId)?.startTs ?? 0;
      return sourceB - sourceA;
    })[0];
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

function buildGaps(
  events: EventRecord[],
  laneId: string,
): Array<{ event: EventRecord } | { gap: GapSegment; events: EventRecord[] }> {
  const sorted = sortEvents(events);
  const items: Array<{ event: EventRecord } | { gap: GapSegment; events: EventRecord[] }> = [];

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

export function buildSelectionPath(
  dataset: RunDataset,
  selection: SelectionState | null,
): SelectionPath {
  const maxDepth = 3;
  const baseEventIds = resolveBaseEventIds(dataset, selection);
  const eventIds = new Set<string>(baseEventIds);
  const edgeIds = new Set<string>();
  const laneIds = new Set<string>();
  const visited = new Set<string>();
  const queue = baseEventIds.map((eventId) => ({ eventId, depth: 0 }));
  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const { previousByEventId, nextByEventId } = buildLaneEventMaps(dataset);
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));

  while (queue.length && visited.size < 24) {
    const current = queue.shift();
    if (!current || visited.has(current.eventId)) {
      continue;
    }

    visited.add(current.eventId);
    const event = eventsById.get(current.eventId);
    if (!event) {
      continue;
    }

    eventIds.add(event.eventId);
    laneIds.add(event.laneId);

    if (current.depth >= maxDepth) {
      continue;
    }

    const enqueue = (eventId: string | null | undefined) => {
      if (!eventId || visited.has(eventId)) {
        return;
      }
      queue.push({ eventId, depth: current.depth + 1 });
    };

    enqueue(previousByEventId.get(event.eventId)?.eventId);
    enqueue(nextByEventId.get(event.eventId)?.eventId);
    enqueue(event.parentId);

    dataset.events
      .filter((candidate) => candidate.parentId === event.eventId)
      .forEach((candidate) => {
        enqueue(candidate.eventId);
      });

    (incomingByEventId.get(event.eventId) ?? []).forEach((edge) => {
      edgeIds.add(edge.edgeId);
      enqueue(edge.sourceEventId);
    });

    (outgoingByEventId.get(event.eventId) ?? []).forEach((edge) => {
      edgeIds.add(edge.edgeId);
      enqueue(edge.targetEventId);
    });
  }

  // Always include spawn topology in the selection path.
  // Spawn edges create parallel execution branches that BFS
  // may not reach when the source event is far from the selection origin.
  const spawnTargetLaneIds = new Set<string>();
  dataset.edges
    .filter((edge) => edge.edgeType === "spawn")
    .forEach((edge) => {
      edgeIds.add(edge.edgeId);
      eventIds.add(edge.sourceEventId);
      eventIds.add(edge.targetEventId);
      const targetEvent = eventsById.get(edge.targetEventId);
      if (targetEvent) {
        spawnTargetLaneIds.add(targetEvent.laneId);
      }
    });

  dataset.events.forEach((event) => {
    if (spawnTargetLaneIds.has(event.laneId)) {
      eventIds.add(event.eventId);
    }
  });

  // Always include merge topology in the selection path.
  // Merge edges represent join points where subagent results flow back
  // to the parent, completing the fork-join causal graph.
  dataset.edges
    .filter((edge) => edge.edgeType === "merge")
    .forEach((edge) => {
      edgeIds.add(edge.edgeId);
      eventIds.add(edge.sourceEventId);
      eventIds.add(edge.targetEventId);
    });

  dataset.events
    .filter((event) => eventIds.has(event.eventId))
    .forEach((event) => {
      laneIds.add(event.laneId);
    });

  return {
    eventIds: sortEvents(dataset.events)
      .filter((event) => eventIds.has(event.eventId))
      .map((event) => event.eventId),
    edgeIds: dataset.edges
      .filter(
        (edge) =>
          edgeIds.has(edge.edgeId) ||
          (eventIds.has(edge.sourceEventId) && eventIds.has(edge.targetEventId)),
      )
      .map((edge) => edge.edgeId),
    laneIds: dataset.lanes
      .filter((lane) => laneIds.has(lane.laneId))
      .map((lane) => lane.laneId),
  };
}

function latestActivityTimestamp(dataset: RunDataset) {
  return Math.max(
    dataset.run.endTs ?? dataset.run.startTs,
    ...dataset.events.map((event) => event.endTs ?? event.startTs),
  );
}

function matchesQuickFilter(dataset: RunDataset, filter: QuickFilterSummary["key"]) {
  if (filter === "all") {
    return true;
  }
  if (filter === "live") {
    return dataset.run.liveMode === "live";
  }
  if (filter === "waiting") {
    return ["waiting", "blocked", "interrupted"].includes(dataset.run.status);
  }
  return dataset.run.status === "failed";
}

function buildWorkspaceRunRow(dataset: RunDataset, referenceTimestamp: number): WorkspaceRunRow {
  const orderedEvents = sortEvents(dataset.events);
  const latestEvent = orderedEvents[orderedEvents.length - 1] ?? null;

  return {
    id: dataset.run.traceId,
    title: deriveWorkspaceRunTitle(dataset, orderedEvents),
    status: dataset.run.status,
    lastEventSummary:
      latestEvent?.waitReason ??
      latestEvent?.outputPreview ??
      latestEvent?.inputPreview ??
      latestEvent?.title ??
      "No event summary yet.",
    relativeTime: formatRelativeTime(latestActivityTimestamp(dataset), referenceTimestamp),
    liveMode: dataset.run.liveMode,
  };
}

export function buildWorkspaceTreeModel(
  datasets: RunDataset[],
  search: string,
  quickFilter: QuickFilterSummary["key"],
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap = {},
): WorkspaceTreeModel {
  const referenceTimestamp = Math.max(...datasets.map((dataset) => latestActivityTimestamp(dataset)));
  const normalizedSearch = search.trim().toLowerCase();
  const quickFilters: QuickFilterSummary[] = [
    { key: "all", label: "All", count: datasets.length },
    {
      key: "live",
      label: "Live",
      count: datasets.filter((dataset) => matchesQuickFilter(dataset, "live")).length,
    },
    {
      key: "waiting",
      label: "Waiting",
      count: datasets.filter((dataset) => matchesQuickFilter(dataset, "waiting")).length,
    },
    {
      key: "failed",
      label: "Failed",
      count: datasets.filter((dataset) => matchesQuickFilter(dataset, "failed")).length,
    },
  ];

  const workspaceMap = new Map<string, WorkspaceTreeItem>();
  datasets
    .filter((dataset) => matchesQuickFilter(dataset, quickFilter))
    .forEach((dataset) => {
      const runRow = buildWorkspaceRunRow(dataset, referenceTimestamp);
      const workspaceIdentity = resolveWorkspaceIdentity(dataset, workspaceIdentityOverrides);
      const searchTarget = [
        workspaceIdentity.displayName,
        dataset.project.name,
        dataset.project.repoPath,
        dataset.project.badge ?? "",
        runRow.title,
        dataset.session.title,
        dataset.run.title,
        runRow.lastEventSummary,
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !searchTarget.includes(normalizedSearch)) {
        return;
      }

      const workspace =
        workspaceMap.get(workspaceIdentity.id) ??
        ({
          id: workspaceIdentity.id,
          name: workspaceIdentity.displayName,
          repoPath: workspaceIdentity.originPath,
          badge: dataset.project.badge ?? null,
          runCount: 0,
          threads: [],
        } satisfies WorkspaceTreeItem);

      const thread =
        workspace.threads.find((item) => item.id === dataset.session.sessionId) ??
        ({
          id: dataset.session.sessionId,
          title: dataset.session.title,
          runs: [],
        } satisfies WorkspaceThreadGroup);

      if (!workspace.threads.some((item) => item.id === thread.id)) {
        workspace.threads.push(thread);
      }

      thread.runs.push(runRow);
      thread.runs.sort((left, right) => right.relativeTime.localeCompare(left.relativeTime));
      workspace.runCount += 1;
      workspaceMap.set(workspaceIdentity.id, workspace);
    });

  return {
    quickFilters,
    workspaces: [...workspaceMap.values()]
      .map((workspace) => ({
        ...workspace,
        threads: workspace.threads
          .map((thread) => ({
            ...thread,
            runs: [...thread.runs].sort((left, right) => right.title.localeCompare(left.title)),
          }))
          .sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function resolveWorkspaceIdentity(
  dataset: RunDataset,
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap,
) {
  const workspaceIdentity = workspaceIdentityOverrides[dataset.project.repoPath];
  return {
    id: workspaceIdentity?.originPath ?? dataset.project.projectId,
    displayName: workspaceIdentity?.displayName ?? dataset.project.name,
    originPath: workspaceIdentity?.originPath ?? dataset.project.repoPath,
  };
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

  const lastHandoff = [...dataset.edges]
    .filter((edge) => edge.edgeType === "handoff")
    .sort((left, right) => {
      const sourceA = orderedEvents.find((event) => event.eventId === left.sourceEventId)?.startTs ?? 0;
      const sourceB = orderedEvents.find((event) => event.eventId === right.sourceEventId)?.startTs ?? 0;
      return sourceB - sourceA;
    })[0];
  const firstFailure = orderedEvents.find(
    (event) => event.status === "failed" || event.eventType === "error",
  );
  const blockerLaneName = blockerEvent
    ? dataset.lanes.find((lane) => lane.laneId === blockerEvent.laneId)?.name ?? blockerEvent.title
    : "n/a";
  const lastHandoffLabel = lastHandoff
    ? (() => {
        const source = dataset.lanes.find((lane) => lane.agentId === lastHandoff.sourceAgentId)?.name ?? "Unknown";
        const target = dataset.lanes.find((lane) => lane.agentId === lastHandoff.targetAgentId)?.name ?? "Unknown";
        return `${source} -> ${target}`;
      })()
    : "n/a";

  return [
    { label: "Blocked by", value: blockerLaneName, emphasis: blockerEvent ? "warning" : "default" },
    { label: "Affected", value: `${affectedLaneIds.size}`, emphasis: affectedLaneIds.size ? "accent" : "default" },
    { label: "Last handoff", value: lastHandoffLabel, emphasis: lastHandoff ? "accent" : "default" },
    { label: "Longest gap", value: formatDuration(dataset.run.summaryMetrics.idleTimeMs), emphasis: "default" },
    { label: "First failure", value: firstFailure?.title ?? "None", emphasis: firstFailure ? "danger" : "default" },
  ];
}

function buildGraphLanes(dataset: RunDataset) {
  const visibleLanes = dataset.lanes.filter(
    (lane, index) =>
      lane.role === "user" || index < LARGE_RUN_LANE_THRESHOLD || lane.laneStatus !== "done",
  );

  return {
    lanes: visibleLanes.map((lane) => ({
      laneId: lane.laneId,
      name: lane.name,
      role: lane.role,
      model: lane.model,
      badge: lane.badge,
      status: lane.laneStatus,
    })),
    hiddenLaneCount: Math.max(dataset.lanes.length - visibleLanes.length, 0),
  };
}

function buildGraphVisibleEvents(
  dataset: RunDataset,
  filters: RunFilters,
  selectionPath: SelectionPath,
) {
  const pathEventIds = new Set(selectionPath.eventIds);
  return sortEvents(dataset.events).filter((event) => {
    return pathEventIds.has(event.eventId) || eventMatchesFilters(event, filters);
  });
}

export function buildGraphSceneModel(
  dataset: RunDataset,
  filters: RunFilters,
  selection: SelectionState | null,
): GraphSceneModel {
  const selectionPath = buildSelectionPath(dataset, selection);
  const selectionPathEventIds = new Set(selectionPath.eventIds);
  const selectionPathEdgeIds = new Set(selectionPath.edgeIds);
  const visibleEvents = buildGraphVisibleEvents(dataset, filters, selectionPath);
  const hasMultiAgentTopology = dataset.lanes.length > 1 && dataset.edges.length > 0;
  const graphLanes = buildGraphLanes(dataset);
  const visibleLanes = graphLanes.lanes;
  const laneIds = new Set(visibleLanes.map((lane) => lane.laneId));
  const rows: GraphSceneRow[] = [];
  const visibleRowsByEventId = new Map<string, string>();
  const seenEventIds = new Set<string>();
  const visibleEventIdSet = new Set(visibleEvents.map((e) => e.eventId));

  visibleEvents.forEach((event, index) => {
    const previous = visibleEvents[index - 1];
    const previousEnd = previous ? previous.endTs ?? previous.startTs : null;
    const gap = previousEnd ? event.startTs - previousEnd : 0;
    if (gap >= GAP_THRESHOLD_MS && previousEnd !== null) {
      const gapStart = previousEnd;
      const gapEnd = event.startTs;
      const hiddenEventIds = dataset.events
        .filter((e) => e.startTs >= gapStart && e.startTs < gapEnd && !visibleEventIdSet.has(e.eventId))
        .map((e) => e.eventId);
      rows.push({
        kind: "gap",
        id: `graph-gap-${previous?.eventId ?? "start"}-${event.eventId}`,
        label: formatGapLabel(gap, visibleLanes.length || 1),
        idleLaneCount: visibleLanes.length || 1,
        durationMs: gap,
        hiddenEventIds,
      });
    }

    if (!laneIds.has(event.laneId)) {
      return;
    }

    if (seenEventIds.has(event.eventId)) {
      return;
    }
    seenEventIds.add(event.eventId);

    const rowId = `graph-row-${event.eventId}`;
    visibleRowsByEventId.set(event.eventId, rowId);
    rows.push({
      kind: "event",
      id: rowId,
      eventId: event.eventId,
      laneId: event.laneId,
      title: event.title,
      summary: event.waitReason ?? event.outputPreview ?? event.inputPreview ?? "n/a",
      status: event.status,
      waitReason: event.waitReason,
      timeLabel: formatTimestamp(event.startTs),
      durationLabel: formatDuration(event.durationMs),
      inPath: hasMultiAgentTopology && selectionPathEventIds.has(event.eventId),
      selected: selection?.kind === "event" && selection.id === event.eventId,
      eventType: event.eventType,
      toolName: event.toolName,
    });
  });

  const visibleEventIds = new Set(
    rows.flatMap((row) => (row.kind === "event" ? [row.eventId] : [])),
  );
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));
  const edgeBundleMap = new Map<string, GraphSceneEdgeBundle>();

  dataset.edges
    .filter(
      (edge) =>
        visibleEventIds.has(edge.sourceEventId) &&
        visibleEventIds.has(edge.targetEventId) &&
        visibleRowsByEventId.has(edge.sourceEventId) &&
        visibleRowsByEventId.has(edge.targetEventId),
    )
    .forEach((edge) => {
      const sourceEvent = eventsById.get(edge.sourceEventId);
      const targetEvent = eventsById.get(edge.targetEventId);
      if (!sourceEvent || !targetEvent) {
        return;
      }

      const bundleKey = [
        edge.sourceEventId,
        edge.targetEventId,
        edge.edgeType,
        sourceEvent.laneId,
        targetEvent.laneId,
      ].join(":");
      const existing = edgeBundleMap.get(bundleKey);

      if (existing) {
        existing.edgeIds.push(edge.edgeId);
        existing.bundleCount += 1;
        existing.selected = existing.selected || (selection?.kind === "edge" && selection.id === edge.edgeId);
        if (!existing.label && edge.payloadPreview) {
          existing.label = edge.payloadPreview;
        }
        return;
      }

      edgeBundleMap.set(bundleKey, {
        id: bundleKey,
        primaryEdgeId: edge.edgeId,
        edgeIds: [edge.edgeId],
        sourceEventId: edge.sourceEventId,
        targetEventId: edge.targetEventId,
        sourceLaneId: sourceEvent.laneId,
        targetLaneId: targetEvent.laneId,
        edgeType: edge.edgeType,
        label: edge.payloadPreview ?? edge.edgeType,
        bundleCount: 1,
        inPath: hasMultiAgentTopology && (
          selectionPathEdgeIds.has(edge.edgeId) ||
          (selectionPathEventIds.has(edge.sourceEventId) &&
            selectionPathEventIds.has(edge.targetEventId))),
        selected: selection?.kind === "edge" && selection.id === edge.edgeId,
      });
    });

  const edgeBundles = [...edgeBundleMap.values()].map((bundle) => ({
    ...bundle,
    label:
      bundle.bundleCount > 1
        ? `${bundle.bundleCount} ${bundle.edgeType} events`
        : bundle.label,
  }));

  return {
    lanes: visibleLanes,
    rows,
    edgeBundles: edgeBundles.filter(
      (bundle) => laneIds.has(bundle.sourceLaneId) && laneIds.has(bundle.targetLaneId),
    ),
    selectionPath,
    hiddenLaneCount: graphLanes.hiddenLaneCount,
    latestVisibleEventId:
      [...rows]
        .reverse()
        .find((row) => row.kind === "event")
        ?.eventId ?? null,
  };
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

export function buildInspectorCausalSummary(
  dataset: RunDataset,
  selection: SelectionState | null,
  rawEnabled: boolean,
): InspectorCausalSummary | null {
  const details = findSelectionDetails(dataset, selection);
  if (!details) {
    return null;
  }

  const { incomingByEventId, outgoingByEventId } = buildEdgeMaps(dataset);
  const eventsById = new Map(dataset.events.map((event) => [event.eventId, event]));
  const { previousByEventId } = buildLaneEventMaps(dataset);
  const buildEventJump = (eventId: string, label: string, description: string): InspectorJump => ({
    label,
    description,
    selection: { kind: "event", id: eventId },
  });

  if ("eventId" in details) {
    const upstream = [
      ...(details.parentId
        ? [buildEventJump(details.parentId, "Parent event", "Jump to the upstream event context.")]
        : []),
      ...(incomingByEventId.get(details.eventId) ?? []).map((edge) =>
        buildEventJump(
          edge.sourceEventId,
          `${edge.edgeType} source`,
          edge.payloadPreview ?? "Jump to the upstream source event.",
        ),
      ),
    ];

    let downstream = [
      ...dataset.events
        .filter((event) => event.parentId === details.eventId)
        .map((event) =>
          buildEventJump(
            event.eventId,
            event.title,
            event.outputPreview ?? event.inputPreview ?? "Jump to the downstream event.",
          ),
        ),
      ...(outgoingByEventId.get(details.eventId) ?? []).map((edge) =>
        buildEventJump(
          edge.targetEventId,
          `${edge.edgeType} target`,
          edge.payloadPreview ?? "Jump to the downstream target event.",
        ),
      ),
    ];

    if (!downstream.length && ["blocked", "waiting", "interrupted"].includes(details.status)) {
      const previous = previousByEventId.get(details.eventId);
      if (previous) {
        downstream = [
          ...(outgoingByEventId.get(previous.eventId) ?? []).map((edge) =>
            buildEventJump(
              edge.targetEventId,
              `${edge.edgeType} target`,
              edge.payloadPreview ?? "Jump to the downstream target event.",
            ),
          ),
        ];
      }
    }

    const affectedStatuses = downstream
      .map((item) => ("selection" in item ? eventsById.get(item.selection.id) : null))
      .filter(Boolean) as EventRecord[];
    const whyBlocked =
      details.status === "blocked" || details.status === "waiting" || details.status === "interrupted"
        ? details.waitReason ?? "reason unavailable"
        : null;
    const nextAction =
      affectedStatuses.find((event) => ["waiting", "blocked", "interrupted"].includes(event.status))
        ?.waitReason ??
      downstream[0]?.description ??
      null;

    const downstreamAgentIds = new Set(
      downstream
        .map((item) => eventsById.get(item.selection.id))
        .filter(Boolean)
        .map((event) => (event as EventRecord).agentId),
    );
    const downstreamWaitingCount = affectedStatuses.filter((event) =>
      ["waiting", "blocked", "interrupted"].includes(event.status),
    ).length;

    return {
      title: details.title,
      preview: details.outputPreview ?? details.inputPreview ?? "n/a",
      facts: [
        { label: "Status", value: details.status },
        { label: "Started", value: formatTimestamp(details.startTs) },
        { label: "Duration", value: formatDuration(details.durationMs) },
      ],
      whyBlocked,
      upstream,
      downstream,
      nextAction,
      payloadPreview: details.outputPreview ?? details.inputPreview ?? "n/a",
      rawStatusLabel:
        rawEnabled && (details.rawInput || details.rawOutput) ? "Raw available in drawer." : "Raw gated by default.",
      affectedAgentCount: downstreamAgentIds.size,
      downstreamWaitingCount,
    };
  }

  if ("edgeId" in details) {
    return {
      title: details.edgeType,
      preview: details.payloadPreview ?? "n/a",
      facts: [
        { label: "Source", value: truncateId(details.sourceEventId) },
        { label: "Target", value: truncateId(details.targetEventId) },
        { label: "Artifact", value: details.artifactId ? truncateId(details.artifactId) : "n/a" },
      ],
      whyBlocked: null,
      upstream: [buildEventJump(details.sourceEventId, "Source event", "Jump to the upstream event.")],
      downstream: [buildEventJump(details.targetEventId, "Target event", "Jump to the downstream event.")],
      nextAction: details.payloadPreview ?? null,
      payloadPreview: details.payloadPreview ?? "n/a",
      rawStatusLabel: "Edge payload is summarized in the drawer log view.",
      affectedAgentCount: 0,
      downstreamWaitingCount: 0,
    };
  }

  return {
    title: details.title,
    preview: details.preview,
    facts: [
      { label: "Artifact", value: truncateId(details.artifactId) },
      { label: "Producer", value: truncateId(details.producerEventId) },
      { label: "Raw", value: rawEnabled && details.rawContent ? "available" : "redacted" },
    ],
    whyBlocked: null,
    upstream: [
      buildEventJump(
        details.producerEventId,
        "Producer event",
        "Jump to the event that created this artifact.",
      ),
    ],
    downstream: [],
    nextAction: "Open artifacts or raw drawer for the full payload.",
    payloadPreview: details.preview,
    rawStatusLabel:
      rawEnabled && details.rawContent ? "Raw available in drawer." : "Raw gated by default.",
    affectedAgentCount: 0,
    downstreamWaitingCount: 0,
  };
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
