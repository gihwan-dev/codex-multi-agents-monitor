import {
  type ExperimentDetail,
  type ExperimentSummary,
  getExperimentDetail,
  listExperiments,
} from "../../../entities/eval";

export function syncExperimentSelection(
  items: ExperimentSummary[],
  current: string | null,
) {
  if (current && items.some((item) => item.experiment.id === current)) {
    return current;
  }

  return items[0]?.experiment.id ?? null;
}

export function syncCaseSelection(
  detail: ExperimentDetail | null,
  current: string | null,
) {
  if (detail?.cases.some((item) => item.id === current)) {
    return current;
  }

  return detail?.cases[0]?.id ?? null;
}

export function resolveCaseRuns(
  detail: ExperimentDetail | null,
  caseId: string | null,
) {
  if (!detail || !caseId) {
    return [];
  }

  return detail.runs.filter((run) => run.caseId === caseId);
}

export function loadExperimentListResult(options: {
  selectedExperimentId: string | null;
  selectExperiment: (value: string | null) => void;
  handlers: {
    onError: (message: string) => void;
    onFinally: () => void;
    onSuccess: (items: ExperimentSummary[]) => void;
  };
  isActive: () => boolean;
}) {
  listExperiments()
    .then((items) => {
      options.handlers.onSuccess(items);
      if (options.isActive()) {
        options.selectExperiment(syncExperimentSelection(items, options.selectedExperimentId));
      }
    })
    .catch((reason) => {
      options.handlers.onError(reason instanceof Error ? reason.message : "Failed to load experiments.");
    })
    .finally(options.handlers.onFinally);
}

export function loadExperimentDetailResult(options: {
  handlers: {
    onError: (message: string) => void;
    onFinally: () => void;
    onSuccess: (detail: ExperimentDetail | null) => void;
  };
  isActive: () => boolean;
  selectedCaseId: string | null;
  selectedExperimentId: string;
  selectCase: (value: string | null) => void;
}) {
  getExperimentDetail(options.selectedExperimentId)
    .then((detail) => {
      options.handlers.onSuccess(detail);
      if (options.isActive()) {
        options.selectCase(syncCaseSelection(detail, options.selectedCaseId));
      }
    })
    .catch((reason) => {
      options.handlers.onError(
        reason instanceof Error ? reason.message : "Failed to load experiment.",
      );
    })
    .finally(options.handlers.onFinally);
}

export function buildDetailHandlers(handlers: {
  isActive: () => boolean;
  requestKey: number;
  setDetail: (value: ExperimentDetail | null) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
}) {
  return {
    onError: (message: string) => {
      if (handlers.isActive()) {
        handlers.setError(message);
      }
    },
    onFinally: () => {
      if (handlers.isActive()) {
        handlers.setLoading(false);
      }
    },
    onSuccess: (detail: ExperimentDetail | null) => {
      if (handlers.isActive()) {
        handlers.setDetail(detail);
        void handlers.requestKey;
      }
    },
  };
}
