import type { CandidateRun } from "../../../entities/eval";
import { buildRunStats } from "./evalCompareRunStats";

interface EvalRunStatsGridProps {
  run: CandidateRun;
}

export function EvalRunStatsGrid({ run }: EvalRunStatsGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {buildRunStats(run).map((stat) => (
        <div
          key={stat.label}
          className="rounded-[var(--radius-soft)] border border-white/8 bg-black/10 p-3"
        >
          <div className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
            {stat.label}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
