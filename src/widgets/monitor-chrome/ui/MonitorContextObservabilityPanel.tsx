import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ContextObservabilityModel } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { MonitorContextLaneSummaryCard } from "./MonitorContextLaneSummaryCard";
import { MonitorContextWindowCard } from "./MonitorContextWindowCard";
import { buildLaneSummaryToggleCopy } from "./monitorContextObservabilityHelpers";

interface MonitorContextObservabilityPanelProps {
  observability: ContextObservabilityModel | null;
}

export function MonitorContextObservabilityPanel({
  observability,
}: MonitorContextObservabilityPanelProps) {
  const [laneSummaryOpen, setLaneSummaryOpen] = useState(false);

  if (!observability) {
    return null;
  }

  return (
    <section className="grid gap-3 border border-x-0 border-white/8 bg-[color:color-mix(in_srgb,var(--color-panel)_88%,black)] px-4 py-4">
      <MonitorContextWindowCard observability={observability} />
      {observability.laneSummaries.length > 0 ? (
        <div className="grid gap-2 rounded-[var(--radius-panel)] border border-white/8 bg-black/10 p-3">
          <button
            type="button"
            data-slot="lane-summary-toggle"
            aria-expanded={laneSummaryOpen}
            className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-soft)] border border-transparent px-1 py-1 text-left transition-colors hover:border-white/8 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-active)]/45"
            onClick={() => setLaneSummaryOpen((open) => !open)}
          >
            <span className="grid gap-0.5">
              <span className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
                Lane summary
              </span>
              <strong className="text-sm text-foreground">
                {buildLaneSummaryToggleCopy(
                  observability.laneSummaries,
                  laneSummaryOpen,
                )}
              </strong>
            </span>
            <span className="flex items-center gap-2 text-[0.72rem] text-muted-foreground">
              <span>{observability.laneSummaries.length} total</span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  laneSummaryOpen ? "rotate-180" : undefined,
                )}
              />
            </span>
          </button>
          {laneSummaryOpen ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {observability.laneSummaries.map((lane) => (
                <MonitorContextLaneSummaryCard key={lane.laneId} lane={lane} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
