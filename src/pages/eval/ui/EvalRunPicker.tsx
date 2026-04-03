import type { CandidateRun } from "../../../entities/eval";
import { formatRelativeTime } from "../../../shared/lib/format";

interface EvalRunPickerProps {
  label: string;
  onChange: (value: string | null) => void;
  runs: CandidateRun[];
  value: string | null;
}

export function EvalRunPicker({
  label,
  onChange,
  runs,
  value,
}: EvalRunPickerProps) {
  return (
    <label className="grid gap-2">
      <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Select run</option>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.candidateLabel} · {formatRelativeTime(run.startedAtMs)} ago
          </option>
        ))}
      </select>
    </label>
  );
}
