import type { ContextObservabilityModel } from "../../../entities/run";
import { ContextMetricGrid } from "./MonitorContextMetricGrid";
import { ContextTimelineStrip } from "./MonitorContextTimelineStrip";
import { ContextWindowHeader } from "./MonitorContextWindowHeader";
import { buildContextRatio } from "./monitorContextObservabilityHelpers";

interface MonitorContextWindowCardProps {
  observability: ContextObservabilityModel;
}

export function MonitorContextWindowCard({
  observability,
}: MonitorContextWindowCardProps) {
  return (
    <section className="grid gap-4 rounded-[var(--radius-panel)] border border-white/8 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-panel)_94%,black)_0%,color-mix(in_srgb,var(--color-panel)_86%,black)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <ContextWindowHeader observability={observability} />
      <ContextTimelineStrip observability={observability} />
      <ContextMetricGrid
        observability={observability}
        ratio={buildContextRatio(observability)}
      />
    </section>
  );
}
