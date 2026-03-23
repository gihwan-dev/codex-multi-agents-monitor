import type { InspectorCausalSummary } from "../../../entities/run";

interface CausalInspectorCompactSummaryProps {
  summary: InspectorCausalSummary | null;
}

export function CausalInspectorCompactSummary({
  summary,
}: CausalInspectorCompactSummaryProps) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">Select a row to preview the active blocker path.</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-[0.78rem] text-muted-foreground">Selection summary</p>
      <strong className="text-sm font-semibold">{summary.title}</strong>
      <p className="text-sm text-muted-foreground">{summary.preview}</p>
      <div className="flex flex-wrap gap-2 text-[0.78rem] text-muted-foreground">
        {summary.facts.slice(0, 3).map((fact) => (
          <span key={fact.label}>{fact.value}</span>
        ))}
      </div>
    </div>
  );
}
