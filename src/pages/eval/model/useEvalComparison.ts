import { useEffect, useState } from "react";
import {
  type CandidateComparison,
  type CandidateRun,
  type CompareCandidatesQuery,
  compareCandidates,
} from "../../../entities/eval";
import { buildComparisonQuery, pickDefaultRunPair } from "./evalComparisonHelpers";

interface UseEvalComparisonOptions {
  caseRuns: CandidateRun[];
  selectedCaseId: string | null;
  selectedExperimentId: string | null;
}

function loadComparisonResult(
  query: CompareCandidatesQuery,
  handlers: {
    onError: (message: string) => void;
    onFinally: () => void;
    onSuccess: (result: CandidateComparison | null) => void;
  },
) {
  compareCandidates(query)
    .then(handlers.onSuccess)
    .catch((reason) => {
      handlers.onError(
        reason instanceof Error ? reason.message : "Failed to compare candidates.",
      );
    })
    .finally(handlers.onFinally);
}

function buildComparisonHandlers(handlers: {
  isActive: () => boolean;
  setComparison: (value: CandidateComparison | null) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
}) {
  return {
    onError: (message: string) => {
      if (!handlers.isActive()) return;
      handlers.setError(message);
      handlers.setComparison(null);
    },
    onFinally: () => {
      if (handlers.isActive()) {
        handlers.setLoading(false);
      }
    },
    onSuccess: (result: CandidateComparison | null) => {
      if (handlers.isActive()) {
        handlers.setComparison(result);
      }
    },
  };
}

function startComparisonLoad(
  query: CompareCandidatesQuery,
  state: {
    setComparison: (value: CandidateComparison | null) => void;
    setError: (value: string | null) => void;
    setLoading: (value: boolean) => void;
  },
) {
  let cancelled = false;
  state.setLoading(true);
  state.setError(null);
  const handlers = buildComparisonHandlers({
    isActive: () => !cancelled,
    setComparison: state.setComparison,
    setError: state.setError,
    setLoading: state.setLoading,
  });
  loadComparisonResult(query, handlers);

  return () => {
    cancelled = true;
  };
}

function useRunPairSelection(caseRuns: CandidateRun[]) {
  const [baselineRunId, setBaselineRunId] = useState<string | null>(null);
  const [candidateRunId, setCandidateRunId] = useState<string | null>(null);

  useEffect(() => {
    const nextSelection = pickDefaultRunPair(caseRuns);
    setBaselineRunId((current) => {
      if (current && caseRuns.some((run) => run.id === current)) {
        return current;
      }
      return nextSelection.baselineRunId;
    });
    setCandidateRunId((current) => {
      if (current && caseRuns.some((run) => run.id === current)) {
        return current;
      }
      return nextSelection.candidateRunId;
    });
  }, [caseRuns]);

  return {
    baselineRunId,
    candidateRunId,
    selectBaselineRun: setBaselineRunId,
    selectCandidateRun: setCandidateRunId,
  };
}

function useComparisonState(options: {
  baselineRunId: string | null;
  candidateRunId: string | null;
  selectedCaseId: string | null;
  selectedExperimentId: string | null;
}) {
  const [comparison, setComparison] = useState<CandidateComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = buildComparisonQuery({
      baselineRunId: options.baselineRunId,
      candidateRunId: options.candidateRunId,
      selectedCaseId: options.selectedCaseId,
      selectedExperimentId: options.selectedExperimentId,
    });
    if (!query) {
      setComparison(null);
      return;
    }
    return startComparisonLoad(query, { setComparison, setError, setLoading });
  }, [
    options.baselineRunId,
    options.candidateRunId,
    options.selectedCaseId,
    options.selectedExperimentId,
  ]);

  return { comparison, compareLoading: loading, error };
}

export function useEvalComparison(options: UseEvalComparisonOptions) {
  const runSelection = useRunPairSelection(options.caseRuns);
  const comparisonState = useComparisonState({
    baselineRunId: runSelection.baselineRunId,
    candidateRunId: runSelection.candidateRunId,
    selectedCaseId: options.selectedCaseId,
    selectedExperimentId: options.selectedExperimentId,
  });

  return {
    ...comparisonState,
    ...runSelection,
  };
}
