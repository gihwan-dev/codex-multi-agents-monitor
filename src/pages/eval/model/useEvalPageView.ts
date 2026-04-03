import { useEvalComparison } from "./useEvalComparison";
import { useEvalExperimentData } from "./useEvalExperimentData";
import { useEvalSelectionState } from "./useEvalSelectionState";

interface UseEvalPageViewOptions {
  onNavigateToMonitor: () => void;
}

export function useEvalPageView({ onNavigateToMonitor }: UseEvalPageViewOptions) {
  const selection = useEvalSelectionState();
  const data = useEvalExperimentData(selection);
  const comparison = useEvalComparison({
    caseRuns: data.caseRuns,
    selectedCaseId: selection.selectedCaseId,
    selectedExperimentId: selection.selectedExperimentId,
  });

  return {
    baselineRunId: comparison.baselineRunId,
    candidateRunId: comparison.candidateRunId,
    caseRuns: data.caseRuns,
    compareLoading: comparison.compareLoading,
    comparison: comparison.comparison,
    detail: data.detail,
    detailLoading: data.detailLoading,
    error: comparison.error ?? data.detailError ?? data.listError,
    experiments: data.experiments,
    loading: data.loading,
    onNavigateToMonitor,
    refresh: selection.refresh,
    selectedCase: data.selectedCase,
    selectedCaseId: selection.selectedCaseId,
    selectedExperimentId: selection.selectedExperimentId,
    selectBaselineRun: comparison.selectBaselineRun,
    selectCandidateRun: comparison.selectCandidateRun,
    selectCase: selection.selectCase,
    selectExperiment: selection.selectExperiment,
  };
}
