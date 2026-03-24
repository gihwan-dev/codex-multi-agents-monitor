import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot, RowPosition } from "../model/graphLayout";
import { GraphEventLaneCells } from "./GraphEventLaneCells";
import { GraphEventRowTimeCell } from "./GraphEventRowTimeCell";

type GraphEventRowModel = Extract<GraphSceneModel["rows"][number], { kind: "event" }>;

interface GraphEventRowProps {
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  row: GraphEventRowModel;
  rowPosition: RowPosition;
  scene: GraphSceneModel;
}

export function GraphEventRow({
  gridTemplateColumns,
  layout,
  onSelect,
  row,
  rowPosition,
  scene,
}: GraphEventRowProps) {
  const eventLayout = layout.eventById.get(row.eventId);

  return (
    <div
      data-slot="graph-event-row"
      data-event-id={row.eventId}
      className="absolute left-0 grid w-full"
      style={{
        gridTemplateColumns,
        top: rowPosition.topY,
        height: rowPosition.height,
      }}
    >
      <GraphEventRowTimeCell timeLabel={row.timeLabel} durationLabel={row.durationLabel} />
      <GraphEventLaneCells eventLayout={eventLayout} onSelect={onSelect} row={row} scene={scene} />
    </div>
  );
}
