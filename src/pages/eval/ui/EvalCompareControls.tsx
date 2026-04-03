import type { CandidateRun, EvalCase } from "../../../entities/eval";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/primitives";
import { EvalRunPicker } from "./EvalRunPicker";

interface EvalCompareControlsProps {
  baselineRunId: string | null;
  candidateRunId: string | null;
  caseRuns: CandidateRun[];
  onSelectBaselineRun: (value: string | null) => void;
  onSelectCandidateRun: (value: string | null) => void;
  selectedCase: EvalCase | null;
}

function controlsSubtitle(selectedCase: EvalCase | null, caseRuns: CandidateRun[]) {
  return selectedCase
    ? `${caseRuns.length} run(s) attached to ${selectedCase.title}`
    : "Select a case to compare runs";
}

export function EvalCompareControls(props: EvalCompareControlsProps) {
  return (
    <Card className="border-white/8 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Comparison controls
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {controlsSubtitle(props.selectedCase, props.caseRuns)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <EvalRunPicker
          excludeId={props.candidateRunId}
          label="Baseline run"
          value={props.baselineRunId}
          runs={props.caseRuns}
          onChange={props.onSelectBaselineRun}
        />
        <EvalRunPicker
          excludeId={props.baselineRunId}
          label="Candidate run"
          value={props.candidateRunId}
          runs={props.caseRuns}
          onChange={props.onSelectCandidateRun}
        />
      </CardContent>
    </Card>
  );
}
