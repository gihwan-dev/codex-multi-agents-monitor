import type { GraphSceneLane, GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot, RowPosition } from "../model/graphLayout";
import { CausalGraphEventRow } from "./CausalGraphEventRow";
import { CausalGraphGapRow } from "./CausalGraphGapRow";

interface CausalGraphRowsProps {
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  renderedContentHeight: number;
  sceneLanes: GraphSceneLane[];
  visibleRowPositions: RowPosition[];
  visibleRows: GraphSceneModel["rows"];
}

export function CausalGraphRows({
  gridTemplateColumns,
  layout,
  onSelect,
  renderedContentHeight,
  sceneLanes,
  visibleRowPositions,
  visibleRows,
}: CausalGraphRowsProps) {
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
          <CausalGraphGapRow
            key={row.id}
            gridTemplateColumns={gridTemplateColumns}
            laneCount={sceneLanes.length}
            row={row}
            rowPosition={rowPosition}
          />
        ) : (
          <CausalGraphEventRow
            key={row.id}
            gridTemplateColumns={gridTemplateColumns}
            layout={layout}
            onSelect={onSelect}
            row={row}
            rowPosition={rowPosition}
            sceneLanes={sceneLanes}
          />
        );
      })}
    </div>
  );
}
