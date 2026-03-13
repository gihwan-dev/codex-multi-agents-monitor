import type { TimelineConnector, TimelineItemView, TimelineProjection } from "../types";

import type {
  TimelineEdgeView,
  TimelineEventRowView,
  TimelineGapRowView,
  TimelineLiveDagView,
  TimelineRowView,
  TimelineTrackOccupancy,
  TimelineTrackView,
  TimelineTurnHeaderRowView,
} from "./types";

const GAP_THRESHOLD_MS = 45_000;
const USER_TRACK_ID = "track:user";
const MAIN_TRACK_ID = "track:main";
const TEXT_ENCODER = new TextEncoder();
const TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type SemanticRow = TimelineTurnHeaderRowView | TimelineEventRowView;

type TrackAllocatorState = {
  activeTrackIdBySessionId: Map<string, string>;
  branchTracksById: Map<string, TimelineTrackView>;
  freeSlots: number[];
  nextSlot: number;
  trackIdBySessionId: Record<string, string>;
};

function itemEndedAtMs(item: TimelineItemView) {
  return item.endedAtMs ?? item.startedAtMs;
}

function isPromptItem(item: TimelineItemView) {
  return item.sourceEvents.some((event) => event.kind === "user_message");
}

function isTerminalChildRow(projection: TimelineProjection, row: TimelineEventRowView) {
  const item = projection.itemsById[row.itemId];

  return (
    row.ownerSessionId !== projection.rootSessionId &&
    item?.sourceEvents.some(
      (event) => event.kind === "agent_complete" || event.kind === "turn_aborted",
    )
  );
}

function semanticRowOrder(left: SemanticRow, right: SemanticRow) {
  const leftRank = left.kind === "turn-header" ? 0 : 1;
  const rightRank = right.kind === "turn-header" ? 0 : 1;

  return (
    left.startedAtMs - right.startedAtMs ||
    leftRank - rightRank ||
    (left.endedAtMs ?? left.startedAtMs) - (right.endedAtMs ?? right.startedAtMs) ||
    left.rowId.localeCompare(right.rowId)
  );
}

function formatHiddenDuration(durationMs: number) {
  const totalSeconds = Math.max(Math.round(durationMs / 1_000), 1);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return `// ${parts.join(" ")} hidden //`;
}

function formatTimeLabel(startedAtMs: number) {
  return TIME_FORMATTER.format(new Date(startedAtMs));
}

function previewSize(...values: Array<string | null | undefined>) {
  const text = values.filter((value): value is string => Boolean(value)).join("");
  return text.length > 0 ? TEXT_ENCODER.encode(text).length : null;
}

function sessionLabelById(projection: TimelineProjection) {
  const labels: Record<string, string> = {
    [projection.rootSessionId]: "Main",
  };

  for (const lane of projection.lanes) {
    if (lane.ownerSessionId) {
      labels[lane.ownerSessionId] = lane.label;
    }
  }

  for (const session of projection.sessions) {
    if (!labels[session.session_id]) {
      labels[session.session_id] =
        session.title?.trim().length ? session.title.trim() : session.session_id;
    }
  }

  return labels;
}

function toolLabel(item: TimelineItemView) {
  const value = item.meta.tool;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function requestPreview(item: TimelineItemView) {
  return item.inputPreview ?? item.payloadPreview;
}

function responsePreview(item: TimelineItemView) {
  if (item.outputPreview) {
    return item.outputPreview;
  }

  return item.sourceEvents.some(
    (event) =>
      event.kind === "agent_message" ||
      event.kind === "agent_complete" ||
      event.kind === "turn_aborted",
  )
    ? item.payloadPreview
    : null;
}

function buildTurnHeaderRows(projection: TimelineProjection): TimelineTurnHeaderRowView[] {
  return projection.turnBands.map((turnBand) => ({
    endedAtMs: turnBand.startedAtMs,
    kind: "turn-header",
    label: turnBand.label,
    rowId: `row:turn:${turnBand.turnBandId}`,
    rowIndex: -1,
    selection: turnBand.userItemId
      ? { itemId: turnBand.userItemId, kind: "item" }
      : { kind: "session" },
    startedAtMs: turnBand.startedAtMs,
    summary: turnBand.summary,
    trackId: USER_TRACK_ID,
    turnBandId: turnBand.turnBandId,
    userItemId: turnBand.userItemId,
  }));
}

function buildEventRows(
  projection: TimelineProjection,
  labelsBySessionId: Record<string, string>,
): TimelineEventRowView[] {
  return projection.items
    .filter((item) => !isPromptItem(item))
    .map((item) => {
      const relation = projection.relationMap.items[item.itemId];
      const nextRequestPreview = requestPreview(item);
      const nextResponsePreview = responsePreview(item);

      return {
        actorLabel:
          item.ownerSessionId === projection.rootSessionId
            ? "Main"
            : labelsBySessionId[item.ownerSessionId] ?? item.ownerSessionId,
        annotation: {
          directionLabel: null,
          latencyMs:
            item.endedAtMs != null ? Math.max(item.endedAtMs - item.startedAtMs, 0) : null,
          payloadSize: previewSize(item.payloadPreview, item.inputPreview, item.outputPreview),
          summary: item.summary ?? item.label,
          timeLabel: formatTimeLabel(item.startedAtMs),
          tokenTotal: item.tokenInput + item.tokenOutput,
          toolLabel: toolLabel(item),
        },
        connectorIds: relation?.connectorIds ?? [],
        endedAtMs: itemEndedAtMs(item),
        itemId: item.itemId,
        itemKind: item.kind,
        kind: "event",
        ownerSessionId: item.ownerSessionId,
        requestPreview: nextRequestPreview,
        responsePreview: nextResponsePreview,
        rowId: `row:item:${item.itemId}`,
        rowIndex: -1,
        segmentId: relation?.segmentId ?? null,
        selection: { itemId: item.itemId, kind: "item" },
        startedAtMs: item.startedAtMs,
        summary: item.summary ?? item.label,
        trackId: null,
        turnBandId: relation?.turnBandId ?? null,
      };
    });
}

function buildSpawnTargetsByItemId(projection: TimelineProjection) {
  const entries = projection.connectors
    .filter((connector) => connector.kind === "spawn")
    .map((connector) => ({
      childSessionId: projection.segmentsById[connector.targetSegmentId]?.ownerSessionId ?? null,
      connector,
    }))
    .filter(
      (
        entry,
      ): entry is { childSessionId: string; connector: TimelineProjection["connectors"][number] } =>
        entry.childSessionId != null,
    )
    .sort(
      (left, right) =>
        left.connector.startedAtMs - right.connector.startedAtMs ||
        left.childSessionId.localeCompare(right.childSessionId),
    );

  const targetsByItemId = new Map<string, string[]>();

  for (const entry of entries) {
    const bucket = targetsByItemId.get(entry.connector.anchorItemId) ?? [];
    bucket.push(entry.childSessionId);
    targetsByItemId.set(entry.connector.anchorItemId, bucket);
  }

  return targetsByItemId;
}

function createTrackAllocatorState(): TrackAllocatorState {
  return {
    activeTrackIdBySessionId: new Map(),
    branchTracksById: new Map(),
    freeSlots: [],
    nextSlot: 0,
    trackIdBySessionId: {},
  };
}

function ensureBranchTrack(
  state: TrackAllocatorState,
  sessionId: string,
  row: SemanticRow,
  actorLabel: string,
) {
  const existingTrackId = state.activeTrackIdBySessionId.get(sessionId);
  if (existingTrackId) {
    return existingTrackId;
  }

  const slotIndex = state.freeSlots.shift() ?? state.nextSlot++;
  const trackId = `track:branch:${slotIndex}`;
  const occupancy: TimelineTrackOccupancy = {
    actorLabel,
    endedAtMs: null,
    endedRowId: null,
    sessionId,
    startedAtMs: row.startedAtMs,
    startedRowId: row.rowId,
  };
  const track = state.branchTracksById.get(trackId) ?? {
    kind: "branch",
    label: `Branch ${slotIndex + 1}`,
    occupancies: [],
    slotIndex,
    trackId,
  };

  track.occupancies.push(occupancy);
  state.branchTracksById.set(trackId, track);
  state.activeTrackIdBySessionId.set(sessionId, trackId);
  state.trackIdBySessionId[sessionId] = trackId;

  return trackId;
}

function releaseBranchTrack(
  state: TrackAllocatorState,
  sessionId: string,
  row: TimelineEventRowView,
) {
  const trackId = state.activeTrackIdBySessionId.get(sessionId);
  if (!trackId) {
    return;
  }

  const track = state.branchTracksById.get(trackId);
  const occupancy = track?.occupancies.find((candidate) => candidate.sessionId === sessionId);
  if (occupancy) {
    occupancy.endedAtMs = row.endedAtMs ?? row.startedAtMs;
    occupancy.endedRowId = row.rowId;
  }

  state.activeTrackIdBySessionId.delete(sessionId);
  const segments = trackId.split(":");
  const slotIndex =
    track?.slotIndex ??
    Number.parseInt(segments[segments.length - 1] ?? "0", 10);
  state.freeSlots.push(slotIndex);
  state.freeSlots.sort((left, right) => left - right);
}

function assignTracks(
  projection: TimelineProjection,
  semanticRows: SemanticRow[],
  labelsBySessionId: Record<string, string>,
) {
  const state = createTrackAllocatorState();
  const spawnTargetsByItemId = buildSpawnTargetsByItemId(projection);

  const rows = semanticRows.map((row) => {
    if (row.kind === "turn-header") {
      return row;
    }

    const nextRow: TimelineEventRowView =
      row.ownerSessionId === projection.rootSessionId
        ? {
            ...row,
            trackId: MAIN_TRACK_ID,
          }
        : {
            ...row,
            trackId: ensureBranchTrack(
              state,
              row.ownerSessionId,
              row,
              labelsBySessionId[row.ownerSessionId] ?? row.actorLabel,
            ),
          };

    for (const childSessionId of spawnTargetsByItemId.get(row.itemId) ?? []) {
      ensureBranchTrack(
        state,
        childSessionId,
        nextRow,
        labelsBySessionId[childSessionId] ?? childSessionId,
      );
    }

    if (isTerminalChildRow(projection, nextRow)) {
      releaseBranchTrack(state, nextRow.ownerSessionId, nextRow);
    }

    return nextRow;
  });

  return {
    rows,
    trackIdBySessionId: state.trackIdBySessionId,
    tracks: [
      {
        kind: "user",
        label: "User",
        occupancies: [],
        slotIndex: 0,
        trackId: USER_TRACK_ID,
      },
      {
        kind: "main",
        label: "Main",
        occupancies: [],
        slotIndex: 1,
        trackId: MAIN_TRACK_ID,
      },
      ...[...state.branchTracksById.values()].sort((left, right) => left.slotIndex - right.slotIndex),
    ] as TimelineTrackView[],
  };
}

function insertGapRows(rows: SemanticRow[]): TimelineRowView[] {
  const result: TimelineRowView[] = [];
  let previousRow: SemanticRow | null = null;

  for (const row of rows) {
    if (previousRow) {
      const previousEndedAtMs = previousRow.endedAtMs ?? previousRow.startedAtMs;
      const hiddenDurationMs = Math.max(row.startedAtMs - previousEndedAtMs, 0);

      if (hiddenDurationMs > GAP_THRESHOLD_MS) {
        result.push({
          endedAtMs: row.startedAtMs,
          hiddenDurationMs,
          kind: "gap",
          label: formatHiddenDuration(hiddenDurationMs),
          rowId: `row:gap:${previousRow.rowId}:${row.rowId}`,
          rowIndex: -1,
          selection: null,
          sourceRowId: previousRow.rowId,
          startedAtMs: previousEndedAtMs,
          targetRowId: row.rowId,
          trackId: null,
        } satisfies TimelineGapRowView);
      }
    }

    result.push(row);
    previousRow = row;
  }

  return result.map((row, rowIndex) => ({
    ...row,
    rowIndex,
  }));
}

function buildRowsById(rows: TimelineRowView[]) {
  return Object.fromEntries(rows.map((row) => [row.rowId, row])) as Record<string, TimelineRowView>;
}

function buildRowIdsByItemId(rows: TimelineRowView[]) {
  return Object.fromEntries(
    rows
      .filter((row): row is TimelineEventRowView => row.kind === "event")
      .map((row) => [row.itemId, row.rowId]),
  ) as Record<string, string>;
}

function connectorRequestPreview(row: TimelineEventRowView, connector: TimelineConnector) {
  if (connector.kind === "spawn" || connector.kind === "handoff") {
    return row.requestPreview ?? row.summary;
  }

  return null;
}

function connectorResponsePreview(row: TimelineEventRowView, connector: TimelineConnector) {
  if (connector.kind === "reply" || connector.kind === "complete") {
    return row.responsePreview ?? row.requestPreview ?? row.summary;
  }

  return null;
}

function buildConnectorEdges(
  projection: TimelineProjection,
  rowsById: Record<string, TimelineRowView>,
  rowIdsByItemId: Record<string, string>,
) {
  const edges: TimelineEdgeView[] = [];

  for (const connector of projection.connectors) {
    const sourceRowId = rowIdsByItemId[connector.anchorItemId];
    const targetRowId = rowIdsByItemId[connector.targetAnchorItemId];
    const sourceRow = sourceRowId ? rowsById[sourceRowId] : null;
    const targetRow = targetRowId ? rowsById[targetRowId] : null;

    if (sourceRow?.kind !== "event" || targetRow?.kind !== "event") {
      continue;
    }

    edges.push({
      connectorId: connector.connectorId,
      directionLabel: `${sourceRow.actorLabel} -> ${targetRow.actorLabel}`,
      edgeId: `edge:${connector.connectorId}`,
      kind: connector.kind,
      requestPreview: connectorRequestPreview(sourceRow, connector),
      responsePreview: connectorResponsePreview(sourceRow, connector),
      selection: {
        anchorItemId: connector.anchorItemId,
        connectorId: connector.connectorId,
        kind: "connector",
      },
      source: {
        kind: "row",
        rowId: sourceRow.rowId,
        trackId: sourceRow.trackId ?? MAIN_TRACK_ID,
      },
      target: {
        kind: "row",
        rowId: targetRow.rowId,
        trackId: targetRow.trackId ?? MAIN_TRACK_ID,
      },
      taxonomy: connector.kind === "spawn" ? "branch" : "flow",
    });
  }

  return edges;
}

function buildToolEdges(rows: TimelineRowView[]) {
  return rows
    .filter((row): row is TimelineEventRowView => row.kind === "event" && row.itemKind === "tool")
    .map((row) => ({
      connectorId: null,
      directionLabel: row.actorLabel,
      edgeId: `edge:tool:${row.itemId}`,
      kind: "tool",
      requestPreview: row.requestPreview,
      responsePreview: row.responsePreview,
      selection: row.selection,
      source: {
        kind: "row",
        rowId: row.rowId,
        trackId: row.trackId ?? MAIN_TRACK_ID,
      },
      target: {
        kind: "annotation",
        rowId: row.rowId,
        trackId: null,
      },
      taxonomy: "tool",
    } satisfies TimelineEdgeView));
}

function attachRowDirections(rows: TimelineRowView[], edges: TimelineEdgeView[]) {
  const preferredEdgeByRowId = new Map<string, TimelineEdgeView>();

  for (const edge of edges) {
    if (edge.source.kind === "row" && !preferredEdgeByRowId.has(edge.source.rowId)) {
      preferredEdgeByRowId.set(edge.source.rowId, edge);
    }
  }

  for (const edge of edges) {
    if (edge.target.kind === "row" && !preferredEdgeByRowId.has(edge.target.rowId)) {
      preferredEdgeByRowId.set(edge.target.rowId, edge);
    }
  }

  return rows.map((row) => {
    if (row.kind !== "event") {
      return row;
    }

    return {
      ...row,
      annotation: {
        ...row.annotation,
        directionLabel: preferredEdgeByRowId.get(row.rowId)?.directionLabel ?? row.actorLabel,
      },
    } satisfies TimelineEventRowView;
  });
}

export function buildTimelineLiveDagView(
  projection: TimelineProjection,
): TimelineLiveDagView {
  const labelsBySessionId = sessionLabelById(projection);
  const semanticRows = [
    ...buildTurnHeaderRows(projection),
    ...buildEventRows(projection, labelsBySessionId),
  ].sort(semanticRowOrder);
  const { rows: trackedRows, trackIdBySessionId, tracks } = assignTracks(
    projection,
    semanticRows,
    labelsBySessionId,
  );
  const rowsWithGaps = insertGapRows(trackedRows);
  const rowIdsByItemId = buildRowIdsByItemId(rowsWithGaps);
  const rowsById = buildRowsById(rowsWithGaps);
  const edges = [
    ...buildConnectorEdges(projection, rowsById, rowIdsByItemId),
    ...buildToolEdges(rowsWithGaps),
  ];
  const rows = attachRowDirections(rowsWithGaps, edges);
  const finalRowsById = buildRowsById(rows);
  const edgesById = Object.fromEntries(edges.map((edge) => [edge.edgeId, edge])) as Record<
    string,
    TimelineEdgeView
  >;

  return {
    edges,
    edgesById,
    gapThresholdMs: GAP_THRESHOLD_MS,
    rowIdsByItemId,
    rows,
    rowsById: finalRowsById,
    trackIdBySessionId,
    tracks,
  };
}
