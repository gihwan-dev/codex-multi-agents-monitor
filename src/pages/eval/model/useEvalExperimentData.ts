import { useEffect, useMemo, useState } from "react";
import type {
  EvalCase,
  ExperimentDetail,
  ExperimentSummary,
} from "../../../entities/eval";
import {
  buildDetailHandlers,
  loadExperimentDetailResult,
  loadExperimentListResult,
  resolveCaseRuns,
} from "./evalExperimentDataHelpers";

interface UseEvalExperimentDataOptions {
  refreshKey: number;
  selectedExperimentId: string | null;
  selectedCaseId: string | null;
  selectExperiment: (value: string | null) => void;
  selectCase: (value: string | null) => void;
}

function useExperimentListState({
  refreshKey,
  selectedExperimentId,
  selectExperiment,
}: Pick<
  UseEvalExperimentDataOptions,
  "refreshKey" | "selectedExperimentId" | "selectExperiment"
>) {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestKey = refreshKey;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadExperimentListResult(selectedExperimentId, selectExperiment, {
      onError: (message) => {
        if (!cancelled) {
          setError(message);
        }
      },
      onFinally: () => {
        if (!cancelled) {
          setLoading(false);
        }
      },
      onSuccess: (items) => {
        if (!cancelled) {
          setExperiments(items);
          void requestKey;
        }
      },
    });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, selectExperiment, selectedExperimentId]);

  return { experiments, loading, error };
}

function startDetailLoad(options: {
  refreshKey: number;
  selectedCaseId: string | null;
  selectedExperimentId: string;
  selectCase: (value: string | null) => void;
  setDetail: (value: ExperimentDetail | null) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
}) {
  const requestKey = options.refreshKey;
  let cancelled = false;
  options.setLoading(true);
  options.setError(null);
  const handlers = buildDetailHandlers({
    isActive: () => !cancelled,
    requestKey,
    setDetail: options.setDetail,
    setError: options.setError,
    setLoading: options.setLoading,
  });
  loadExperimentDetailResult({
    handlers,
    selectedCaseId: options.selectedCaseId,
    selectedExperimentId: options.selectedExperimentId,
    selectCase: options.selectCase,
  });

  return () => {
    cancelled = true;
  };
}

function useExperimentDetailState(
  options: Pick<
    UseEvalExperimentDataOptions,
    "refreshKey" | "selectedExperimentId" | "selectedCaseId" | "selectCase"
  >,
) {
  const [detail, setDetail] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.selectedExperimentId) {
      setDetail(null);
      options.selectCase(null);
      return;
    }
    return startDetailLoad({
      refreshKey: options.refreshKey,
      selectedCaseId: options.selectedCaseId,
      selectedExperimentId: options.selectedExperimentId,
      selectCase: options.selectCase,
      setDetail,
      setError,
      setLoading,
    });
  }, [
    options.refreshKey,
    options.selectCase,
    options.selectedCaseId,
    options.selectedExperimentId,
  ]);

  return { detail, loading, error };
}

export function useEvalExperimentData(options: UseEvalExperimentDataOptions) {
  const listState = useExperimentListState(options);
  const detailState = useExperimentDetailState(options);

  const selectedCase = useMemo<EvalCase | null>(() => {
    return (
      detailState.detail?.cases.find((item) => item.id === options.selectedCaseId) ?? null
    );
  }, [detailState.detail, options.selectedCaseId]);

  const caseRuns = useMemo(
    () => resolveCaseRuns(detailState.detail, options.selectedCaseId),
    [detailState.detail, options.selectedCaseId],
  );

  return {
    caseRuns,
    detail: detailState.detail,
    detailError: detailState.error,
    detailLoading: detailState.loading,
    experiments: listState.experiments,
    listError: listState.error,
    loading: listState.loading,
    selectedCase,
  };
}
