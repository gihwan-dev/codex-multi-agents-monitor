import type { ContextObservabilityModel } from "../../../entities/run";
import {
  buildActiveEventProgressLabel,
  buildActiveFocusLabel,
  buildUsageLabel,
  formatTokenMetric,
} from "./monitorContextObservabilityHelpers";

export function ContextWindowHeader({
  observability,
}: {
  observability: ContextObservabilityModel;
}) {
  const activeEventProgressLabel = buildActiveEventProgressLabel(observability);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
            Context window
          </p>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.67rem] font-medium text-[var(--color-text-muted)]">
            {buildActiveFocusLabel(observability)}
          </span>
        </div>
        <strong className="max-w-[36rem] text-sm leading-[1.3] text-foreground">
          {observability.activeEventTitle ?? "No focused event"}
        </strong>
        {activeEventProgressLabel ? (
          <span className="text-[0.72rem] text-muted-foreground">
            {activeEventProgressLabel}
          </span>
        ) : null}
      </div>
      <div className="grid gap-1 text-right">
        <strong className="block text-[1.45rem] font-semibold leading-none tabular-nums text-foreground">
          {formatTokenMetric(observability.activeContextWindowTokens)}
        </strong>
        <span className="text-[0.72rem] text-muted-foreground">
          {buildUsageLabel(observability)}
        </span>
      </div>
    </div>
  );
}
