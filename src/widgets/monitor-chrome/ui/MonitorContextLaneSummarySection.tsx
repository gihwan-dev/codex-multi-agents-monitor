import { ChevronDown } from "lucide-react";
import type { ContextObservabilityModel } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { MonitorContextLaneSummaryCard } from "./MonitorContextLaneSummaryCard";
import { buildLaneSummaryToggleCopy } from "./monitorContextObservabilityHelpers";

interface MonitorContextLaneSummarySectionProps {
  laneSummaries: ContextObservabilityModel["laneSummaries"];
  laneSummaryOpen: boolean;
  toggleLaneSummary: () => void;
}

export function MonitorContextLaneSummarySection({
  laneSummaries,
  laneSummaryOpen,
  toggleLaneSummary,
}: MonitorContextLaneSummarySectionProps) {
  return (
    <div className="grid gap-2 rounded-[var(--radius-panel)] border border-white/8 bg-black/10 p-2.5">
      <button
        type="button"
        data-slot="lane-summary-toggle"
        aria-expanded={laneSummaryOpen}
        aria-label={laneSummaryOpen ? "Collapse lane summary" : "Expand lane summary"}
        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-soft)] border border-transparent px-1 py-0.5 text-left transition-colors hover:border-white/8 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-active)]/45"
        onClick={toggleLaneSummary}
      >
        <span className="grid gap-0.5">
          <span className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
            Lane summary
          </span>
          <strong className="text-sm text-foreground">
            {buildLaneSummaryToggleCopy(laneSummaries, laneSummaryOpen)}
          </strong>
        </span>
        <span className="flex items-center gap-2 text-[0.72rem] text-muted-foreground">
          <span>{laneSummaries.length} total</span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200 motion-reduce:transition-none",
              laneSummaryOpen ? "rotate-180" : undefined,
            )}
          />
        </span>
      </button>
      {laneSummaryOpen ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {laneSummaries.map((lane) => (
            <MonitorContextLaneSummaryCard key={lane.laneId} lane={lane} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
