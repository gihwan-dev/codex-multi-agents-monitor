import type { GraphSceneModel } from "../../../entities/run";
import type { RowPosition } from "../model/graphLayout";

export function resolveViewportFocusEventId(rows: GraphSceneModel["rows"]) {
  return rows.find((row) => row.kind === "event")?.eventId ?? null;
}

interface ResolveViewportBottomEventIdArgs {
  availableCanvasHeight: number;
  scrollTop: number;
  visibleRowPositions: RowPosition[];
  visibleRows: GraphSceneModel["rows"];
}

export function resolveViewportBottomEventId(args: ResolveViewportBottomEventIdArgs) {
  const viewportBottom = args.scrollTop + args.availableCanvasHeight;
  const viewportTop = args.scrollTop;
  const viewportEvents = args.visibleRows.flatMap((row, index) => {
    if (row.kind !== "event") {
      return [];
    }

    const rowPosition = args.visibleRowPositions[index];
    if (!rowPosition || !intersectsViewport(rowPosition, viewportTop, viewportBottom)) {
      return [];
    }

    return [{ eventId: row.eventId }];
  });

  if (viewportEvents.length > 0) {
    return viewportEvents[viewportEvents.length - 1]?.eventId ?? null;
  }

  return [...args.visibleRows].reverse().find((row) => row.kind === "event")?.eventId ?? null;
}

function intersectsViewport(
  rowPosition: RowPosition,
  viewportTop: number,
  viewportBottom: number,
) {
  const rowBottom = rowPosition.topY + rowPosition.height;
  return rowBottom > viewportTop && rowPosition.topY < viewportBottom;
}
