import type { ContextObservabilityModel } from "../../../entities/run";
import { MonitorContextLaneSummarySection } from "./MonitorContextLaneSummarySection";
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

  if (observability.laneSummaries.length === 0) {
    return null;
  }

  return (
    <section className="border border-x-0 border-white/8 bg-white/[0.02] px-4 py-2">
      <MonitorContextLaneSummarySection
        laneSummaries={observability.laneSummaries}
        laneSummaryOpen={laneSummaryOpen}
        toggleLaneSummary={toggleLaneSummary}
      />
    </section>
  );
}
