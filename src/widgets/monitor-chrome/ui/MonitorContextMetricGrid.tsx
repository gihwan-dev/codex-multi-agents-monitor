import type { ContextObservabilityModel } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { MonitorContextMetricLabel } from "./MonitorContextMetricLabel";
import {
  formatTokenMetric,
  resolveBarTone,
  resolveProgressWidth,
} from "./monitorContextObservabilityHelpers";

interface ContextMetricGridProps {
  observability: ContextObservabilityModel;
  ratio: number | null;
}

export function ContextMetricGrid(props: ContextMetricGridProps) {
  const { observability, ratio } = props;

  return (
    <div className="grid gap-2">
      <div className="h-2 rounded-full bg-white/8">
        <div
          data-slot="context-window-progress"
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            resolveBarTone(ratio),
          )}
          style={{
            width: resolveProgressWidth(ratio, observability.activeContextWindowTokens),
          }}
        />
      </div>
      <div className="grid gap-2 text-[0.74rem] text-[var(--color-text-muted)] sm:grid-cols-3">
        <MonitorContextMetricLabel
          label="At this point"
          value={formatTokenMetric(observability.activeCumulativeContextTokens)}
        />
        <MonitorContextMetricLabel
          label="Peak window"
          value={formatTokenMetric(observability.peakContextWindowTokens)}
        />
        <MonitorContextMetricLabel
          label="Peak spent"
          value={formatTokenMetric(observability.peakCumulativeContextTokens)}
        />
      </div>
    </div>
  );
}
