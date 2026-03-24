import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { OccupiedGraphLaneCell } from "./OccupiedGraphLaneCell";

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
      {occupied ? <OccupiedGraphLaneCell eventLayout={eventLayout} onSelect={onSelect} row={row} /> : null}
    </div>
  );
}
