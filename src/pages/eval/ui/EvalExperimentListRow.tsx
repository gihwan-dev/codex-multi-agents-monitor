import type { ExperimentSummary } from "../../../entities/eval";
import { formatRelativeTime } from "../../../shared/lib/format";

interface EvalExperimentListRowProps {
  item: ExperimentSummary;
  selected: boolean;
  onSelect: (value: string) => void;
}

export function EvalExperimentListRow({
  item,
  selected,
  onSelect,
}: EvalExperimentListRowProps) {
  return (
    <button
      type="button"
      aria-label={`Select experiment: ${item.experiment.name}`}
      aria-pressed={selected}
      className={`grid gap-1 rounded-[var(--radius-soft)] border px-3 py-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none ${
        selected
          ? "border-[color:color-mix(in_srgb,var(--color-active)_50%,white_15%)] bg-[color:color-mix(in_srgb,var(--color-active)_12%,transparent)]"
          : "border-white/8 bg-black/10 hover:bg-white/[0.05]"
      }`}
      onClick={() => onSelect(item.experiment.id)}
    >
      <span className="text-sm font-medium text-foreground">{item.experiment.name}</span>
      <span className="text-xs text-muted-foreground">
        {item.caseCount} cases · {item.runCount} runs
      </span>
      <span className="text-xs text-muted-foreground">
        updated {formatRelativeTime(item.experiment.updatedAtMs)} ago
      </span>
    </button>
  );
}
