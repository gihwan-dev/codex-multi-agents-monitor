import type { LaneContextSummary } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { MonitorContextLaneSummaryMetrics } from "./MonitorContextLaneSummaryMetrics";
import { formatShare } from "./monitorContextObservabilityHelpers";

interface MonitorContextLaneSummaryCardProps {
  lane: LaneContextSummary;
}

export function MonitorContextLaneSummaryCard({
  lane,
}: MonitorContextLaneSummaryCardProps) {
  return (
    <article
      data-slot="lane-summary-card"
      data-selected={lane.isSelected ? "true" : "false"}
      className={cn(
        "grid min-w-0 gap-2 rounded-[var(--radius-soft)] border border-white/8 bg-black/10 p-3",
        lane.isSelected
          ? "border-[color:var(--color-active)]/45 bg-[color:color-mix(in_srgb,var(--color-active)_12%,transparent)]"
          : undefined,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block truncate text-sm text-foreground">{lane.laneName}</strong>
          <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
            {lane.laneKind} · {lane.laneRole}
          </span>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.66rem] font-medium text-[var(--color-text-muted)]">
          {formatShare(lane.shareOfTotalContext)}
        </span>
      </div>
      <MonitorContextLaneSummaryMetrics lane={lane} />
    </article>
  );
}
