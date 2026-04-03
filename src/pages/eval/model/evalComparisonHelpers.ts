import type { CandidateRun, CompareCandidatesQuery } from "../../../entities/eval";

interface ComparisonQueryInput {
  baselineRunId: string | null;
  candidateRunId: string | null;
  selectedCaseId: string | null;
  selectedExperimentId: string | null;
}

export interface RunPairSelection {
  baselineRunId: string | null;
  candidateRunId: string | null;
}

export function buildComparisonQuery(
  input: ComparisonQueryInput,
): CompareCandidatesQuery | null {
  const { baselineRunId, candidateRunId, selectedCaseId, selectedExperimentId } = input;
  if (!selectedExperimentId || !selectedCaseId) {
    return null;
  }
  if (!baselineRunId || !candidateRunId || baselineRunId === candidateRunId) {
    return null;
  }

  return {
    experimentId: selectedExperimentId,
    caseId: selectedCaseId,
    baselineRunId,
    candidateRunId,
  };
}

export function pickDefaultRunPair(runs: CandidateRun[]): RunPairSelection {
  const baselineRunId = pickBaselineRunId(runs);
  return {
    baselineRunId,
    candidateRunId: pickCandidateRunId(runs, baselineRunId),
  };
}

function pickBaselineRunId(runs: CandidateRun[]) {
  return pickRunIdByTag(runs, "baseline") ?? runs[0]?.id ?? null;
}

function pickCandidateRunId(runs: CandidateRun[], baselineRunId: string | null) {
  if (!baselineRunId) {
    return null;
  }

  return (
    pickRunIdByTag(runs, "candidate", baselineRunId) ??
    pickFirstAvailableRunId(runs, baselineRunId)
  );
}

function pickRunIdByTag(
  runs: CandidateRun[],
  tag: "baseline" | "candidate",
  excludedId?: string,
) {
  return (
    runs.find((run) => {
      return run.id !== excludedId && run.candidateLabel.toLowerCase().includes(tag);
    })?.id ?? null
  );
}

function pickFirstAvailableRunId(runs: CandidateRun[], excludedId?: string) {
  return runs.find((run) => run.id !== excludedId)?.id ?? null;
}
