import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { GraphEventCard } from "./GraphEventCard";

type GraphEventRow = Extract<GraphSceneModel["rows"][number], { kind: "event" }>;

interface GraphLaneCellProps {
  eventLayout: GraphLayoutSnapshot["eventById"] extends Map<string, infer T>
    ? T
    : never;
  laneId: string;
  onSelect: (selection: SelectionState) => void;
  row: GraphEventRow;
}

export function GraphLaneCell({
  eventLayout,
  laneId,
  onSelect,
  row,
}: GraphLaneCellProps) {
  const occupied = laneId === row.laneId;

  return (
    <div
      data-slot="graph-lane-cell"
      data-lane-id={laneId}
      data-occupied={occupied ? "true" : "false"}
      className="relative min-h-[var(--graph-event-row-height)]"
    >
      {occupied ? (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 z-0 w-0.5 -translate-x-1/2"
            style={{
              background:
                "linear-gradient(180deg, var(--color-graph-connector), transparent)",
            }}
          />
          <GraphEventCard
            eventId={row.eventId}
            eventLayout={eventLayout}
            eventType={row.eventType}
            inPath={row.inPath}
            onSelect={() => onSelect({ kind: "event", id: row.eventId })}
            rowAnchorTop={eventLayout.rowTop}
            selected={row.selected}
            status={row.status}
            summary={row.summary}
            title={row.title}
          />
        </>
      ) : null}
    </div>
  );
}
