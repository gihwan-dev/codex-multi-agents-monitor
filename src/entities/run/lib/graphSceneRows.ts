import { formatDuration, formatTimestamp } from "../../../shared/lib/format";
import type {
  EventRecord,
  GraphSceneRow,
  RunDataset,
  SelectionState,
} from "../model/types.js";

const GAP_THRESHOLD_MS = 30_000;

export interface GraphSceneRowsResult {
  rows: GraphSceneRow[];
  visibleRowsByEventId: Map<string, string>;
  latestVisibleEventId: string | null;
}

interface GraphSceneRowsArgs {
  dataset: RunDataset;
  visibleEvents: EventRecord[];
  laneIds: Set<string>;
  visibleLaneCount: number;
  selection: SelectionState | null;
  selectionPathEventIds: Set<string>;
  hasMultiAgentTopology: boolean;
}

interface BuildGapHiddenEventIdsArgs {
  events: EventRecord[];
  visibleEventIdSet: Set<string>;
  gapStart: number;
  gapEnd: number;
}

interface BuildGapRowArgs {
  dataset: RunDataset;
  previousEvent: EventRecord | undefined;
  event: EventRecord;
  visibleEventIdSet: Set<string>;
  idleLaneCount: number;
}

interface BuildEventRowArgs {
  event: EventRecord;
  selection: SelectionState | null;
  selectionPathEventIds: Set<string>;
  hasMultiAgentTopology: boolean;
}

interface AppendSceneEventRowsOptions {
  state: ReturnType<typeof createGraphSceneRowsState>;
  visibleEvents: EventRecord[];
  laneIds: Set<string>;
  rowArgs: Pick<
    GraphSceneRowsArgs,
    "dataset" | "visibleLaneCount" | "selection" | "selectionPathEventIds" | "hasMultiAgentTopology"
  >;
}

function buildGapLabel(durationMs: number, idleLaneCount: number) {
  const laneLabel = idleLaneCount === 1 ? "lane" : "lanes";
  return `${formatDuration(durationMs)} idle · ${idleLaneCount} ${laneLabel} idle`;
}

function buildGapHiddenEventIds(args: BuildGapHiddenEventIdsArgs) {
  return args.events
    .filter(
      (event) =>
        event.startTs >= args.gapStart &&
        event.startTs < args.gapEnd &&
        !args.visibleEventIdSet.has(event.eventId),
    )
    .map((event) => event.eventId);
}

function resolveGapWindow(previousEvent: EventRecord | undefined, event: EventRecord) {
  const gapStart = previousEvent ? previousEvent.endTs ?? previousEvent.startTs : null;
  const durationMs = gapStart ? event.startTs - gapStart : 0;

  return gapStart !== null && durationMs >= GAP_THRESHOLD_MS
    ? { gapStart, durationMs }
    : null;
}

function buildGapRow(args: BuildGapRowArgs) {
  const gapWindow = resolveGapWindow(args.previousEvent, args.event);
  if (!gapWindow) {
    return null;
  }

  return {
    kind: "gap" as const,
    id: `graph-gap-${args.previousEvent?.eventId ?? "start"}-${args.event.eventId}`,
    label: buildGapLabel(gapWindow.durationMs, args.idleLaneCount),
    idleLaneCount: args.idleLaneCount,
    durationMs: gapWindow.durationMs,
    hiddenEventIds: buildGapHiddenEventIds({
      events: args.dataset.events,
      visibleEventIdSet: args.visibleEventIdSet,
      gapStart: gapWindow.gapStart,
      gapEnd: args.event.startTs,
    }),
  };
}

function resolveEventRowSummary(event: EventRecord) {
  return event.waitReason ?? event.outputPreview ?? event.inputPreview ?? "n/a";
}

function buildEventRow(args: BuildEventRowArgs) {
  const { event, selection, selectionPathEventIds, hasMultiAgentTopology } = args;

  return {
    kind: "event" as const,
    id: `graph-row-${event.eventId}`,
    eventId: event.eventId,
    laneId: event.laneId,
    title: event.title,
    summary: resolveEventRowSummary(event),
    status: event.status,
    waitReason: event.waitReason,
    timeLabel: formatTimestamp(event.startTs),
    durationLabel: formatDuration(event.durationMs),
    inPath: hasMultiAgentTopology && selectionPathEventIds.has(event.eventId),
    selected: selection?.kind === "event" && selection.id === event.eventId,
    eventType: event.eventType,
    toolName: event.toolName,
  };
}

function appendGraphSceneRow(
  result: GraphSceneRowsResult,
  row: GraphSceneRow,
) {
  result.rows.push(row);
  if (row.kind === "event") {
    result.visibleRowsByEventId.set(row.eventId, row.id);
    result.latestVisibleEventId = row.eventId;
  }
}

function appendGapRow(
  result: GraphSceneRowsResult,
  args: Parameters<typeof buildGapRow>[0],
) {
  const gapRow = buildGapRow(args);
  if (gapRow) {
    appendGraphSceneRow(result, gapRow);
  }
}

function appendVisibleEventRow(
  result: GraphSceneRowsResult,
  seenEventIds: Set<string>,
  args: Parameters<typeof buildEventRow>[0],
) {
  if (seenEventIds.has(args.event.eventId)) {
    return;
  }

  appendGraphSceneRow(result, buildEventRow(args));
  seenEventIds.add(args.event.eventId);
}

function createGraphSceneRowsState(visibleEvents: EventRecord[]) {
  return {
    result: {
      rows: [],
      visibleRowsByEventId: new Map<string, string>(),
      latestVisibleEventId: null,
    } satisfies GraphSceneRowsResult,
    seenEventIds: new Set<string>(),
    visibleEventIdSet: new Set(visibleEvents.map((event) => event.eventId)),
  };
}

function appendSceneEventRows(options: AppendSceneEventRowsOptions) {
  for (const [index, event] of options.visibleEvents.entries()) {
    appendGapRow(options.state.result, {
      dataset: options.rowArgs.dataset,
      previousEvent: options.visibleEvents[index - 1],
      event,
      visibleEventIdSet: options.state.visibleEventIdSet,
      idleLaneCount: options.rowArgs.visibleLaneCount,
    });

    if (!options.laneIds.has(event.laneId)) {
      continue;
    }

    appendVisibleEventRow(options.state.result, options.state.seenEventIds, {
      event,
      selection: options.rowArgs.selection,
      selectionPathEventIds: options.rowArgs.selectionPathEventIds,
      hasMultiAgentTopology: options.rowArgs.hasMultiAgentTopology,
    });
  }
}

export function buildGraphSceneRows(args: GraphSceneRowsArgs): GraphSceneRowsResult {
  const {
    dataset,
    visibleEvents,
    laneIds,
    visibleLaneCount,
    selection,
    selectionPathEventIds,
    hasMultiAgentTopology,
  } = args;
  const state = createGraphSceneRowsState(visibleEvents);

  appendSceneEventRows({
    state,
    visibleEvents,
    laneIds,
    rowArgs: {
      dataset,
      visibleLaneCount,
      selection,
      selectionPathEventIds,
      hasMultiAgentTopology,
    },
  });

  return state.result;
}
