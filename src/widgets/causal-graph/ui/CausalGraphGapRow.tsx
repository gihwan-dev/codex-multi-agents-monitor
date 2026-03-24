import type { GraphSceneRowGap } from "../../../entities/run";
import { GapChip } from "../../../shared/ui";
import type { RowPosition } from "../model/graphLayout";
import { TIME_GUTTER } from "../model/graphLayout";

interface CausalGraphGapRowProps {
  gridTemplateColumns: string;
  laneCount: number;
  row: GraphSceneRowGap;
  rowPosition: RowPosition;
}

export function CausalGraphGapRow({
  gridTemplateColumns,
  laneCount,
  row,
  rowPosition,
}: CausalGraphGapRowProps) {
  return (
    <div
      data-slot="graph-gap"
      data-gap-id={row.id}
      data-expanded="false"
      className="absolute left-0 grid w-full items-center"
      style={{ gridTemplateColumns, top: rowPosition.topY, height: rowPosition.height }}
    >
      <div
        className="absolute inset-y-0 right-0"
        style={{
          left: TIME_GUTTER,
          background: "var(--color-graph-gap-fill)",
          borderTop: "1px dashed var(--color-graph-gap-border)",
          borderBottom: "1px dashed var(--color-graph-gap-border)",
        }}
      />
      <div
        data-slot="graph-gap-time"
        className="sticky left-0 z-[3] flex min-h-full items-center px-3 text-[0.74rem] font-mono text-muted-foreground"
        style={{ background: "var(--gradient-graph-time)" }}
      />
      <div
        className="relative z-[1] flex items-center justify-center"
        style={{ gridColumn: `2 / span ${laneCount || 1}` }}
      >
        <GapChip label={row.label} durationMs={row.durationMs} />
      </div>
    </div>
  );
}
