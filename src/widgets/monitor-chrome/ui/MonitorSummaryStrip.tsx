import type { SummaryFact } from "../../../entities/run";
import { MetricPill } from "../../../shared/ui";

interface MonitorSummaryStripProps {
  facts: SummaryFact[];
  activeFocus: string | null;
}

export function MonitorSummaryStrip({
  facts,
  activeFocus,
}: MonitorSummaryStripProps) {
  return (
    <section className="summary-strip summary-strip--inline">
      <span className="summary-strip__focus">{activeFocus ?? "No focus"}</span>
      {facts.map((fact) => (
        <MetricPill key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </section>
  );
}
