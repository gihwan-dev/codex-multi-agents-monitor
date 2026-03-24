import type { GraphSceneModel } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { TIME_GUTTER } from "../model/graphLayout";

function resolveGuideColor(selected: boolean, inPath: boolean) {
  if (selected) {
    return "var(--color-graph-guide-selected)";
  }

  return inPath ? "var(--color-graph-guide-active)" : "var(--color-graph-guide-default)";
}

export function renderGraphRowGuide(
  row: GraphSceneModel["rows"][number],
  layout: GraphLayoutSnapshot,
) {
  if (row.kind !== "event") {
    return null;
  }

  const guideY = layout.rowGuideYByEventId.get(row.eventId);
  if (guideY === undefined) {
    return null;
  }

  return (
    <line
      key={`guide-${row.eventId}`}
      data-slot="graph-row-guide"
      data-guide-kind={row.selected ? "selected" : row.inPath ? "active" : "default"}
      data-event-id={row.eventId}
      x1={TIME_GUTTER}
      y1={guideY}
      x2={layout.contentWidth}
      y2={guideY}
      stroke={resolveGuideColor(row.selected, row.inPath)}
      strokeWidth={row.selected || row.inPath ? 1.25 : 1}
      strokeDasharray="2 6"
    />
  );
}
