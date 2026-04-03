import type { CandidateComparison, CandidateRun, EvalCase } from "../../../entities/eval";
import { EvalCompareView } from "../../../widgets/eval-compare";
import { EvalEmptyPanel } from "./EvalEmptyPanel";

interface EvalCompareBodyProps {
  caseRuns: CandidateRun[];
  compareLoading: boolean;
  comparison: CandidateComparison | null;
  selectedCase: EvalCase | null;
}

function resolveEmptyState({
  caseRuns,
  compareLoading,
  selectedCase,
}: Pick<EvalCompareBodyProps, "caseRuns" | "compareLoading" | "selectedCase">) {
  if (compareLoading) {
    return {
      title: "Loading comparison",
      description: "Fetching baseline and candidate scorecards for the selected case.",
    };
  }
  if (!selectedCase) {
    return {
      title: "Select a case",
      description:
        "Choose an experiment and case on the left to inspect its canonical compare view.",
    };
  }
  if (caseRuns.length < 2) {
    return {
      title: "Need two runs",
      description:
        "Attach at least two candidate runs to this case, then select one baseline and one candidate run.",
    };
  }
  return null;
}

export function EvalCompareBody(props: EvalCompareBodyProps) {
  const emptyState = resolveEmptyState(props);

  if (props.comparison) {
    return <EvalCompareView comparison={props.comparison} />;
  }
  if (emptyState) {
    return <EvalEmptyPanel title={emptyState.title} description={emptyState.description} />;
  }
  return null;
}
