import { GapChip } from "../../../shared/ui";
import { TIME_GUTTER } from "../model/graphLayout";

interface GraphGapRowProps {
  durationMs: number;
  gridTemplateColumns: string;
  label: string;
  laneCount: number;
  rowHeight: number;
  rowId: string;
  topY: number;
}

export function GraphGapRow({
  durationMs,
  gridTemplateColumns,
  label,
  laneCount,
  rowHeight,
  rowId,
  topY,
}: GraphGapRowProps) {
  return (
    <div
      key={rowId}
      data-slot="graph-gap"
      data-gap-id={rowId}
      data-expanded="false"
      className="absolute left-0 grid w-full items-center"
      style={{ gridTemplateColumns, top: topY, height: rowHeight }}
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
      >
        <span>{label}</span>
      </div>
      <div
        className="relative z-[1] flex items-center justify-center"
        style={{ gridColumn: `2 / span ${laneCount || 1}` }}
      >
        <GapChip label={label} durationMs={durationMs} />
      </div>
    </div>
  );
}
