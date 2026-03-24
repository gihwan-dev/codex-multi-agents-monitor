type GraphEventRowTimeCellProps = {
  timeLabel: string;
  durationLabel: string;
};

export function GraphEventRowTimeCell({
  timeLabel,
  durationLabel,
}: GraphEventRowTimeCellProps) {
  return (
    <div
      data-slot="graph-event-time"
      className="sticky left-0 z-[3] flex min-h-full items-center px-3 text-[0.74rem] font-mono text-muted-foreground"
      style={{ background: "var(--gradient-graph-time)" }}
    >
      <div className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
        <strong>{timeLabel}</strong>
        <span className="text-[0.68rem] text-[var(--color-text-tertiary)]">({durationLabel})</span>
      </div>
    </div>
  );
}
