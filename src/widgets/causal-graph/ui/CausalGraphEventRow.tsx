import type {
  GraphSceneLane,
  GraphSceneRowEvent,
  SelectionState,
} from "../../../entities/run";
import type { GraphLayoutSnapshot, RowPosition } from "../model/graphLayout";
import { CausalGraphEventCard } from "./CausalGraphEventCard";

interface CausalGraphEventRowProps {
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  row: GraphSceneRowEvent;
  rowPosition: RowPosition;
  sceneLanes: GraphSceneLane[];
}

export function CausalGraphEventRow({
  gridTemplateColumns,
  layout,
  onSelect,
  row,
  rowPosition,
  sceneLanes,
}: CausalGraphEventRowProps) {
  const eventLayout = layout.eventById.get(row.eventId) ?? null;

  return (
    <div
      data-slot="graph-event-row"
      data-event-id={row.eventId}
      className="absolute left-0 grid w-full"
      style={{ gridTemplateColumns, top: rowPosition.topY, height: rowPosition.height }}
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
      {sceneLanes.map((lane) => (
        <div
          key={`${row.id}:${lane.laneId}`}
          data-slot="graph-lane-cell"
          data-lane-id={lane.laneId}
          data-occupied={lane.laneId === row.laneId ? "true" : "false"}
          className="relative min-h-[var(--graph-event-row-height)]"
        >
          {lane.laneId === row.laneId ? (
            <>
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 z-0 w-0.5 -translate-x-1/2"
                style={{
                  background:
                    "linear-gradient(180deg, var(--color-graph-connector), transparent)",
                }}
              />
              <CausalGraphEventCard
                eventLayout={eventLayout}
                onSelect={onSelect}
                row={row}
              />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
