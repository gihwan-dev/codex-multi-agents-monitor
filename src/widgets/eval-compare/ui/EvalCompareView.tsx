import type { CandidateComparison } from "../../../entities/eval";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/primitives";
import { EvalRunPanel } from "./EvalRunPanel";
import { EvalScoreBreakdown } from "./EvalScoreBreakdown";

interface EvalCompareViewProps {
  comparison: CandidateComparison;
}

export function EvalCompareView({ comparison }: EvalCompareViewProps) {
  return (
    <div className="grid gap-4">
      <Card className="border-white/8 bg-white/[0.03]">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle className="text-lg">{comparison.caseItem.title}</CardTitle>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {comparison.caseItem.expectedResult}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {comparison.caseItem.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-[var(--radius-soft)] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-6 text-foreground/90">
            {comparison.caseItem.prompt}
          </div>
          <p className="text-sm text-muted-foreground">{comparison.boundaryNote}</p>
        </CardContent>
      </Card>

      <EvalScoreBreakdown
        baseline={comparison.baselineScorecard}
        candidate={comparison.candidateScorecard}
        deltas={comparison.deltas}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <EvalRunPanel title="Baseline" run={comparison.baselineRun} />
        <EvalRunPanel title="Candidate" run={comparison.candidateRun} />
      </div>
    </div>
  );
}
