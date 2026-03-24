import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type {
  GraphLayoutSnapshot,
  RowPosition,
} from "../model/graphLayout";
import { renderGraphRow } from "./renderGraphRow";

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
      {visibleRows.map((row, visibleIndex) =>
        renderGraphRow({
          gridTemplateColumns,
          layout,
          onSelect,
          row,
          rowPosition: visibleRowPositions[visibleIndex],
          scene,
        }),
      )}
    </div>
  );
}
