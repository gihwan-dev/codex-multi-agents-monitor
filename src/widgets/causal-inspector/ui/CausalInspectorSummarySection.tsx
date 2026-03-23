import type { InspectorCausalSummary } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { Separator } from "../../../shared/ui/primitives";

interface CausalInspectorSummarySectionProps {
  summary: InspectorCausalSummary | null;
}

export function CausalInspectorSummarySection({
  summary,
}: CausalInspectorSummarySectionProps) {
  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a row, edge, or artifact to inspect its causal summary.
      </p>
    );
  }

  return (
    <>
      <h3 className="text-[0.95rem] font-semibold leading-5">{summary.title}</h3>
      <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.preview}</p>
      <Separator className="bg-white/8" />
      <dl className="grid gap-2">
        {summary.facts.map((fact) => (
          <div
            key={fact.label}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"
          >
            <dt className="text-[0.78rem] font-medium text-muted-foreground">{fact.label}</dt>
            <dd
              className={cn(
                "m-0 rounded px-2 py-1 text-[0.78rem] tabular-nums",
                "bg-white/[0.07]",
                fact.emphasis === "danger" && "text-[var(--color-failed)]",
                fact.emphasis === "warning" && "text-[var(--color-waiting)]",
                fact.emphasis === "accent" && "text-[var(--color-active)]",
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
