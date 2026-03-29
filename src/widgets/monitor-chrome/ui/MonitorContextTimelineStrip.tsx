import type { ContextObservabilityModel } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import {
  buildTimelineBars,
  formatTokenMetric,
  resolveTimelineBarTone,
} from "./monitorContextObservabilityHelpers";

export function ContextTimelineStrip({
  observability,
}: {
  observability: ContextObservabilityModel;
}) {
  const timelineBars = buildTimelineBars(observability);
  if (timelineBars.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-[0.72rem] text-muted-foreground">
        <span>Timeline-synced usage</span>
        <span>{formatTokenMetric(observability.activeCumulativeContextTokens)} spent so far</span>
      </div>
      <div
        data-slot="context-timeline-bars"
        className="grid h-14 grid-flow-col items-end gap-1 rounded-[var(--radius-soft)] border border-white/8 bg-black/15 px-2 py-2"
      >
        {timelineBars.map((bar) => (
          <span
            key={bar.key}
            data-slot="context-timeline-bar"
            data-active={bar.isActive ? "true" : "false"}
            className={cn(
              "min-w-0 rounded-full transition-[height,background-color,opacity] duration-200",
              resolveTimelineBarTone(bar),
              bar.isActive ? "shadow-[0_0_0_1px_rgba(255,255,255,0.14)]" : undefined,
            )}
            style={{ height: `${Math.max(bar.heightRatio * 100, 16)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
