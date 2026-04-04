import type { CandidateRun } from "../../../entities/eval";
import { formatRelativeTime } from "../../../shared/lib/format";
import { Badge } from "../../../shared/ui/primitives";

interface EvalRunStepSectionProps {
  run: CandidateRun;
}

export function EvalRunStepSection({ run }: EvalRunStepSectionProps) {
  const totalSteps = run.steps.length;
  const recentSteps = run.steps.slice(0, 5);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">Canonical steps</span>
        <div className="flex items-center gap-2">
          {totalSteps > 5 ? (
            <span className="text-xs text-muted-foreground">Showing 5 of {totalSteps}</span>
          ) : null}
          <Badge variant="outline">{totalSteps}</Badge>
        </div>
      </div>
      {recentSteps.length > 0 ? (
        recentSteps.map((step) => (
          <div
            key={step.id}
            className="grid gap-1 rounded-[var(--radius-soft)] border border-white/8 bg-black/10 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {step.index + 1}. {step.title}
              </span>
              <Badge variant="outline">{step.kind}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {step.finishedAtMs
                ? `updated ${formatRelativeTime(step.finishedAtMs)} ago`
                : "still open"}
            </span>
            {step.outputPreview && (
              <p className="line-clamp-3 text-sm text-foreground/90" title={step.outputPreview}>{step.outputPreview}</p>
            )}
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No canonical steps were attached.</p>
      )}
    </div>
  );
}
