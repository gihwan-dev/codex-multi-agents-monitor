import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type {
  GraphLayoutSnapshot,
  RowPosition,
} from "../model/graphLayout";
import { GraphEventRow } from "./GraphEventRow";
import { GraphGapRow } from "./GraphGapRow";

interface CausalGraphRowsLayerProps {
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  renderedContentHeight: number;
  scene: GraphSceneModel;
  visibleRowPositions: RowPosition[];
  visibleRows: GraphSceneModel["rows"];
}

export function CausalGraphRowsLayer({
  gridTemplateColumns,
  layout,
  onSelect,
  renderedContentHeight,
  scene,
  visibleRowPositions,
  visibleRows,
}: CausalGraphRowsLayerProps) {
  return (
    <div
      data-slot="graph-rows"
      className="relative z-[1]"
      style={{ height: renderedContentHeight }}
    >
      {visibleRows.map((row, visibleIndex) => {
        const rowPosition = visibleRowPositions[visibleIndex];
        if (!rowPosition) {
          return null;
        }

        return row.kind === "gap" ? (
          <GraphGapRow
            key={row.id}
            durationMs={row.durationMs}
            gridTemplateColumns={gridTemplateColumns}
            label={row.label}
            laneCount={scene.lanes.length}
            rowHeight={rowPosition.height}
            rowId={row.id}
            topY={rowPosition.topY}
          />
        ) : (
          <GraphEventRow
            key={row.id}
            gridTemplateColumns={gridTemplateColumns}
            layout={layout}
            onSelect={onSelect}
            row={row}
            rowPosition={rowPosition}
            scene={scene}
          />
        );
      })}
    </div>
  );
}
