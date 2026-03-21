import { cn } from "../../lib";

interface MetricPillProps {
  label: string;
  value: string;
  className?: string;
}

export function MetricPill({ label, value, className }: MetricPillProps) {
  return (
    <div
      data-slot="monitor-metric-pill"
      className={cn(
        "grid min-w-[7.5rem] gap-1 rounded-[var(--radius-soft)] border border-white/8 bg-white/[0.03] px-3 py-2",
        className,
      )}
    >
      <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <strong className="text-sm font-semibold tabular-nums text-foreground">{value}</strong>
    </div>
  );
}
