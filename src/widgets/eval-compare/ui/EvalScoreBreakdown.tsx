import type { ScorecardAxisDelta, ScorecardAxisSummary } from "../../../entities/eval";
import { SCORECARD_AXES } from "../../../entities/eval";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/primitives";
import { EvalScoreAxisCard } from "./EvalScoreAxisCard";
import { buildAxisDeltaLookup, buildAxisScoreLookup } from "./evalScoreBreakdownHelpers";

interface EvalScoreBreakdownProps {
  baseline: ScorecardAxisSummary[];
  candidate: ScorecardAxisSummary[];
  deltas: ScorecardAxisDelta[];
}

export function EvalScoreBreakdown({
  baseline,
  candidate,
  deltas,
}: EvalScoreBreakdownProps) {
  const baselineLookup = buildAxisScoreLookup(baseline);
  const candidateLookup = buildAxisScoreLookup(candidate);
  const deltaLookup = buildAxisDeltaLookup(deltas);

  return (
    <Card className="border-white/8 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-base">Score breakdown</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-4">
        {SCORECARD_AXES.map((axis) => (
          <EvalScoreAxisCard
            key={axis}
            axis={axis}
            baselineSummary={baselineLookup.get(axis)}
            candidateSummary={candidateLookup.get(axis)}
            delta={deltaLookup.get(axis) ?? null}
          />
        ))}
      </CardContent>
    </Card>
  );
}
