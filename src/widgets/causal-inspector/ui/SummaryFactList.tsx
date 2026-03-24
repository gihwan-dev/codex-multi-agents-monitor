import type { InspectorCausalSummary } from "../../../entities/run";
import { cn } from "../../../shared/lib";

export function SummaryFactList({ facts }: { facts: InspectorCausalSummary["facts"] }) {
  return (
    <dl className="grid gap-2">
      {facts.map((fact) => (
        <div key={fact.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
          <dt className="text-[0.78rem] font-medium text-muted-foreground">{fact.label}</dt>
          <dd
            className={cn(
              "m-0 rounded bg-white/[0.07] px-2 py-1 text-[0.78rem] tabular-nums",
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
  );
}
