import type { EventRecord, GraphSceneRow } from "../../../entities/run";

export interface ExpandedGapView {
  gapId: string;
  label: string;
  hiddenEvents: EventRecord[];
}

function resolveHiddenGapEvents(
  eventIds: string[],
  eventsById: Map<string, EventRecord>,
) {
  return eventIds.flatMap((eventId) => {
    const event = eventsById.get(eventId);
    return event ? [event] : [];
  });
}

export function buildExpandedGapIds(
  rows: GraphSceneRow[],
  toggledGapIds: string[],
): Set<string> {
  const toggled = new Set(toggledGapIds);
  const expandedGapIds = new Set<string>();

  for (const row of rows) {
    if (row.kind === "gap" && toggled.has(row.id)) {
      expandedGapIds.add(row.id);
    }
  }

  return expandedGapIds;
}

export function buildExpandedGaps(
  rows: GraphSceneRow[],
  expandedGapIds: Set<string>,
  events: EventRecord[],
): ExpandedGapView[] {
  if (!expandedGapIds.size) {
    return [];
  }

  const eventsById = new Map(events.map((event) => [event.eventId, event]));
  return rows.flatMap((row) =>
    row.kind === "gap" && expandedGapIds.has(row.id)
      ? [
          {
            gapId: row.id,
            label: row.label,
            hiddenEvents: resolveHiddenGapEvents(row.hiddenEventIds, eventsById),
          },
        ]
      : [],
  );
}
