import type { GraphSceneModel, SelectionState } from "../../../entities/run";
import type { GraphLayoutSnapshot, RowPosition } from "../model/graphLayout";
import { GraphEventRow } from "./GraphEventRow";
import { GraphGapRow } from "./GraphGapRow";

interface RenderGraphRowOptions {
  gridTemplateColumns: string;
  layout: GraphLayoutSnapshot;
  onSelect: (selection: SelectionState) => void;
  row: GraphSceneModel["rows"][number];
  rowPosition: RowPosition | undefined;
  scene: GraphSceneModel;
}

export function renderGraphRow(options: RenderGraphRowOptions) {
  if (!options.rowPosition) {
    return null;
  }

  return options.row.kind === "gap"
    ? (
        <GraphGapRow
          key={options.row.id}
          durationMs={options.row.durationMs}
          gridTemplateColumns={options.gridTemplateColumns}
          label={options.row.label}
          laneCount={options.scene.lanes.length}
          rowHeight={options.rowPosition.height}
          rowId={options.row.id}
          topY={options.rowPosition.topY}
        />
      )
    : (
        <GraphEventRow
          key={options.row.id}
          gridTemplateColumns={options.gridTemplateColumns}
          layout={options.layout}
          onSelect={options.onSelect}
          row={options.row}
          rowPosition={options.rowPosition}
          scene={options.scene}
        />
      );
}
