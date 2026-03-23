import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot, RowPosition } from "../model/graphLayout";
import { GraphLaneCell } from "./GraphLaneCell";

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
      <div
        data-slot="graph-event-time"
        className="sticky left-0 z-[3] flex min-h-full items-center px-3 text-[0.74rem] font-mono text-muted-foreground"
        style={{ background: "var(--gradient-graph-time)" }}
      >
        <div className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
          <strong>{row.timeLabel}</strong>
          <span className="text-[0.68rem] text-[var(--color-text-tertiary)]">
            ({row.durationLabel})
          </span>
        </div>
      </div>
      {scene.lanes.map((lane) =>
        eventLayout ? (
          <GraphLaneCell
            key={`${row.id}:${lane.laneId}`}
            eventLayout={eventLayout}
            laneId={lane.laneId}
            onSelect={onSelect}
            row={row}
          />
        ) : null,
      )}
    </div>
  );
}
