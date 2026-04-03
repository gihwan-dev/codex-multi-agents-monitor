import type { CandidateRun } from "../../../entities/eval";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "../../../shared/ui/primitives";
import { EvalCandidateFingerprint } from "./EvalCandidateFingerprint";
import { EvalRunArtifactSection } from "./EvalRunArtifactSection";
import { EvalRunGradeSection } from "./EvalRunGradeSection";
import { EvalRunNotesSection } from "./EvalRunNotesSection";
import { EvalRunStatsGrid } from "./EvalRunStatsGrid";
import { EvalRunStepSection } from "./EvalRunStepSection";

interface EvalRunPanelProps {
  title: string;
  run: CandidateRun;
}

export function EvalRunPanel({ title, run }: EvalRunPanelProps) {
  return (
    <div className="grid gap-4">
      <EvalCandidateFingerprint title={title} run={run} />
      <Card className="border-white/8 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Run summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <EvalRunStatsGrid run={run} />
          <Separator />
          <EvalRunGradeSection run={run} />
          <Separator />
          <div className="grid gap-3 lg:grid-cols-2">
            <EvalRunArtifactSection run={run} />
            <EvalRunStepSection run={run} />
          </div>
          {run.notes.length > 0 && <Separator />}
          <EvalRunNotesSection run={run} />
        </CardContent>
      </Card>
    </div>
  );
}
