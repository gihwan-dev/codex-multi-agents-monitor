import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";
import { GraphLaneCell } from "./GraphLaneCell";

type GraphEventRowModel = Extract<GraphSceneModel["rows"][number], { kind: "event" }>;

interface GraphEventLaneCellsProps {
  eventLayout: ReturnType<GraphLayoutSnapshot["eventById"]["get"]>;
  onSelect: (selection: SelectionState) => void;
  row: GraphEventRowModel;
  scene: GraphSceneModel;
}

export function GraphEventLaneCells({
  eventLayout,
  onSelect,
  row,
  scene,
}: GraphEventLaneCellsProps) {
  return scene.lanes.map((lane) =>
    eventLayout ? (
      <GraphLaneCell
        key={`${row.id}:${lane.laneId}`}
        eventLayout={eventLayout}
        laneId={lane.laneId}
        onSelect={onSelect}
        row={row}
      />
    ) : null,
  );
}
