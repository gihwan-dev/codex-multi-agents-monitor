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
    <section className="flex flex-wrap items-center gap-3 border border-x-0 border-white/8 bg-white/[0.02] px-4 py-2">
      <span className="shrink-0 text-[0.8rem] text-muted-foreground">
        {activeFocus ?? "No focus"}
      </span>
      {facts.map((fact) => (
        <MetricPill
          key={fact.label}
          label={fact.label}
          value={fact.value}
          className="min-w-auto grid-flow-col items-center gap-2 px-2.5 py-1.5"
        />
      ))}
    </section>
  );
}
