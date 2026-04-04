import { useId } from "react";
import type { CandidateRun } from "../../../entities/eval";
import { formatRelativeTime } from "../../../shared/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../../shared/ui/primitives/select";

const RUN_STATUS_LABELS: Record<CandidateRun["status"], string> = {
  pending: "Pending",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatRunScore(run: CandidateRun) {
  if (run.grades.length === 0) {
    return null;
  }
  const totalScore = run.grades.reduce((sum, grade) => sum + grade.score, 0);
  return `${totalScore} pts`;
}

function buildRunMeta(run: CandidateRun) {
  const parts = [
    run.fingerprint.model,
    run.fingerprint.vendor,
    RUN_STATUS_LABELS[run.status],
  ];
  const score = formatRunScore(run);
  if (score) {
    parts.push(score);
  }
  return parts.join(" · ");
}

function RunPickerContent({ run }: { run: CandidateRun }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-left">
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium leading-5 text-foreground">
        <span className="truncate">{run.candidateLabel}</span>
        <span className="shrink-0 text-[0.72rem] font-normal tabular-nums text-muted-foreground">
          · {formatRelativeTime(run.startedAtMs)} ago
        </span>
      </span>
      <span className="truncate text-[0.72rem] leading-4 text-muted-foreground">
        {buildRunMeta(run)}
      </span>
    </div>
  );
}

interface EvalRunPickerProps {
  disabled?: boolean;
  excludeId?: string | null;
  label: string;
  onChange: (value: string | null) => void;
  runs: CandidateRun[];
  value: string | null;
}

export function EvalRunPicker({
  disabled = false,
  excludeId = null,
  label,
  onChange,
  runs,
  value,
}: EvalRunPickerProps) {
  const labelId = useId();
  const selectedRun = runs.find((run) => run.id === value) ?? null;

  return (
    <div className="grid gap-2">
      <span
        id={labelId}
        className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground"
      >
        {label}
      </span>
      <Select
        disabled={runs.length === 0 || disabled}
        value={value ?? undefined}
        onValueChange={onChange}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className="h-auto min-h-9 w-full items-start border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] py-2 text-left whitespace-normal hover:bg-[color:var(--color-surface-hover)]"
        >
          {selectedRun ? (
            <RunPickerContent run={selectedRun} />
          ) : (
            <span className="text-sm text-muted-foreground">Select run</span>
          )}
        </SelectTrigger>
        <SelectContent
          align="start"
          position="popper"
          className="w-[var(--radix-select-trigger-width)] border-[color:var(--color-chrome-border)] bg-[color:var(--color-panel)]"
        >
          {runs.map((run) => (
            <SelectItem
              key={run.id}
              value={run.id}
              textValue={`${run.candidateLabel} ${buildRunMeta(run)}`}
              disabled={run.id === excludeId}
              className="items-start py-2"
            >
              <RunPickerContent run={run} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
