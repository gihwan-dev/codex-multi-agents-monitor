import type { ContextObservabilityModel } from "../../../entities/run";
import { MonitorContextLaneSummarySection } from "./MonitorContextLaneSummarySection";
import { MonitorContextWindowCard } from "./MonitorContextWindowCard";
import { useLaneSummaryDisclosure } from "./useLaneSummaryDisclosure";

interface MonitorContextObservabilityPanelProps {
  observability: ContextObservabilityModel | null;
}

export function MonitorContextObservabilityPanel({
  observability,
}: MonitorContextObservabilityPanelProps) {
  const observabilityKey = observability
    ? `${observability.timelinePoints[0]?.eventId ?? "empty"}:${observability.timelinePoints.length}`
    : "empty";
  const { laneSummaryOpen, toggleLaneSummary } = useLaneSummaryDisclosure(observabilityKey);

  if (!observability) {
    return null;
  }

  return (
    <section className="grid gap-3 border border-x-0 border-white/8 bg-[color:color-mix(in_srgb,var(--color-panel)_88%,black)] px-4 py-4">
      <MonitorContextWindowCard observability={observability} />
      {observability.laneSummaries.length > 0 ? (
        <MonitorContextLaneSummarySection
          laneSummaries={observability.laneSummaries}
          laneSummaryOpen={laneSummaryOpen}
          toggleLaneSummary={toggleLaneSummary}
        />
      ) : null}
    </section>
  );
}
