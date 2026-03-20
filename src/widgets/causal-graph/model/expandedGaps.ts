import type { EventRecord, GraphSceneRow } from "../../../entities/run";

export interface ExpandedGapView {
  gapId: string;
  label: string;
  hiddenEvents: EventRecord[];
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
  const expandedGaps: ExpandedGapView[] = [];

  for (const row of rows) {
    if (row.kind !== "gap" || !expandedGapIds.has(row.id)) {
      continue;
    }

    expandedGaps.push({
      gapId: row.id,
      label: row.label,
      hiddenEvents: row.hiddenEventIds.flatMap((eventId) => {
        const event = eventsById.get(eventId);
        return event ? [event] : [];
      }),
    });
  }

  return expandedGaps;
}
