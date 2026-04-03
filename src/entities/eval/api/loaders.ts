import { invokeTauri } from "../../../shared/api";
import type {
  CandidateComparison,
  CandidateRun,
  CompareCandidatesQuery,
  CreateCaseInput,
  CreateExperimentInput,
  ExperimentDetail,
  ExperimentSummary,
  SaveCandidateRunInput,
  UpdateCaseInput,
  UpdateExperimentInput,
} from "../model/types";

export async function listExperiments() {
  return invokeTauri<ExperimentSummary[]>("list_experiments");
}

export async function getExperimentDetail(experimentId: string) {
  return invokeTauri<ExperimentDetail | null>("get_experiment_detail", { experimentId });
}

export async function createExperiment(input: CreateExperimentInput) {
  return invokeTauri<ExperimentDetail>("create_experiment", { input });
}

export async function updateExperiment(
  experimentId: string,
  patch: UpdateExperimentInput,
) {
  return invokeTauri<ExperimentDetail | null>("update_experiment", {
    experimentId,
    patch,
  });
}

export async function deleteExperiment(experimentId: string) {
  return invokeTauri<boolean>("delete_experiment", { experimentId });
}

export async function addCase(experimentId: string, input: CreateCaseInput) {
  return invokeTauri<ExperimentDetail | null>("add_case", { experimentId, input });
}

export async function updateCase(
  experimentId: string,
  caseId: string,
  patch: UpdateCaseInput,
) {
  return invokeTauri<ExperimentDetail | null>("update_case", {
    experimentId,
    caseId,
    patch,
  });
}

export async function deleteCase(experimentId: string, caseId: string) {
  return invokeTauri<ExperimentDetail | null>("delete_case", {
    experimentId,
    caseId,
  });
}

export async function saveCandidateRun(
  experimentId: string,
  caseId: string,
  input: SaveCandidateRunInput,
) {
  return invokeTauri<CandidateRun | null>("save_candidate_run", {
    experimentId,
    caseId,
    input,
  });
}

export async function runGrader(
  experimentId: string,
  caseId: string,
  runId: string,
) {
  return invokeTauri<CandidateRun | null>("run_grader", {
    experimentId,
    caseId,
    runId,
  });
}

export async function compareCandidates(query: CompareCandidatesQuery) {
  return invokeTauri<CandidateComparison | null>("compare_candidates", { query });
}
