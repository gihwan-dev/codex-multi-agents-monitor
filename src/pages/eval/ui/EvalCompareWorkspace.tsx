import type { CandidateComparison, CandidateRun, EvalCase } from "../../../entities/eval";
import { Card, CardContent, ScrollArea } from "../../../shared/ui/primitives";
import { EvalCompareBody } from "./EvalCompareBody";
import { EvalCompareControls } from "./EvalCompareControls";

interface EvalCompareWorkspaceProps {
  baselineRunId: string | null;
  candidateRunId: string | null;
  caseRuns: CandidateRun[];
  compareLoading: boolean;
  comparison: CandidateComparison | null;
  error: string | null;
  selectedCase: EvalCase | null;
  onSelectBaselineRun: (value: string | null) => void;
  onSelectCandidateRun: (value: string | null) => void;
}

export function EvalCompareWorkspace(props: EvalCompareWorkspaceProps) {
  return (
    <div className="grid min-h-0 gap-4">
      <EvalCompareControls {...props} />
      {props.error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 text-sm text-foreground">{props.error}</CardContent>
        </Card>
      )}
      <ScrollArea className="min-h-0 pr-2">
        <div className="grid gap-4 pb-2">
          <EvalCompareBody
            caseRuns={props.caseRuns}
            compareLoading={props.compareLoading}
            comparison={props.comparison}
            selectedCase={props.selectedCase}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
