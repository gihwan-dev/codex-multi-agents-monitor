import type { LaneContextSummary } from "../../../entities/run";
import { formatCompactNumber } from "../../../shared/lib/format";
import { formatTokenMetric } from "./monitorContextObservabilityHelpers";

interface MonitorContextLaneSummaryMetricsProps {
  lane: LaneContextSummary;
}

export function MonitorContextLaneSummaryMetrics({
  lane,
}: MonitorContextLaneSummaryMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.75rem] text-[var(--color-text-muted)]">
      <span>Total</span>
      <strong className="text-right text-foreground">{formatTokenMetric(lane.totalTokens)}</strong>
      <span>In / Out</span>
      <strong className="text-right text-foreground">
        {formatCompactNumber(lane.inputTokens)} / {formatCompactNumber(lane.outputTokens)}
      </strong>
      <span>Imported</span>
      <strong className="text-right text-foreground">{formatTokenMetric(lane.contextImportedTokens)}</strong>
      <span>Returned</span>
      <strong className="text-right text-foreground">{formatTokenMetric(lane.contextReturnedTokens)}</strong>
      <span>Est. saved</span>
      <strong className="text-right text-foreground">
        {formatTokenMetric(lane.estimatedMainContextSaved)}
      </strong>
      <span>Compactions</span>
      <strong className="text-right text-foreground">{lane.compactionCount}</strong>
    </div>
  );
}
