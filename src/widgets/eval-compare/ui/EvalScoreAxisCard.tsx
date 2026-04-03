import type { ScorecardAxis, ScorecardAxisSummary } from "../../../entities/eval";
import { Badge } from "../../../shared/ui/primitives";
import { EvalScoreBar } from "./EvalScoreBar";
import { EvalScoreRow } from "./EvalScoreRow";
import {
  AXIS_LABELS,
  deltaBadgeVariant,
  deltaLabel,
  scoreLabel,
  summaryScore,
} from "./evalScoreBreakdownHelpers";

interface EvalScoreAxisCardProps {
  axis: ScorecardAxis;
  baselineSummary?: ScorecardAxisSummary;
  candidateSummary?: ScorecardAxisSummary;
  delta: number | null;
}

export function EvalScoreAxisCard({
  axis,
  baselineSummary,
  candidateSummary,
  delta,
}: EvalScoreAxisCardProps) {
  const baselineScore = summaryScore(baselineSummary);
  const candidateScore = summaryScore(candidateSummary);

  return (
    <div className="grid gap-3 rounded-[var(--radius-soft)] border border-white/8 bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{AXIS_LABELS[axis]}</span>
        <Badge variant={deltaBadgeVariant(delta)}>{deltaLabel(delta)}</Badge>
      </div>
      <div className="grid gap-2 text-sm">
        <EvalScoreRow label="Baseline" scoreLabel={scoreLabel(baselineScore)} />
        <EvalScoreRow label="Candidate" scoreLabel={scoreLabel(candidateScore)} />
      </div>
      <div className="grid gap-2">
        <EvalScoreBar value={baselineScore} tone="baseline" />
        <EvalScoreBar value={candidateScore} tone="candidate" />
      </div>
    </div>
  );
}
