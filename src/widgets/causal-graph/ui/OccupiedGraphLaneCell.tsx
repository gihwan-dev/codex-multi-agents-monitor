import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { GraphEventCard } from "./GraphEventCard";

type GraphEventRow = Extract<GraphSceneModel["rows"][number], { kind: "event" }>;

interface OccupiedGraphLaneCellProps {
  eventLayout: GraphLayoutSnapshot["eventById"] extends Map<string, infer T> ? T : never;
  onSelect: (selection: SelectionState) => void;
  row: GraphEventRow;
}

export function OccupiedGraphLaneCell({
  eventLayout,
  onSelect,
  row,
}: OccupiedGraphLaneCellProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 z-0 w-0.5 -translate-x-1/2"
        style={{ background: "linear-gradient(180deg, var(--color-graph-connector), transparent)" }}
      />
      <GraphEventCard
        eventId={row.eventId}
        eventLayout={eventLayout}
        eventType={row.eventType}
        inPath={row.inPath}
        inputPreview={row.inputPreview}
        onSelect={() => onSelect({ kind: "event", id: row.eventId })}
        outputPreview={row.outputPreview}
        rowAnchorTop={eventLayout.rowTop}
        selected={row.selected}
        status={row.status}
        summary={row.summary}
        title={row.title}
      />
    </>
  );
}
