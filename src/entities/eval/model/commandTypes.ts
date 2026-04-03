import type {
  Artifact,
  ArtifactKind,
  CandidateFingerprintInput,
  CandidateRunStatus,
  CanonicalStep,
  ExecutionStats,
  Grade,
} from "./coreTypes";

export interface CreateExperimentInput {
  name: string;
  description: string | null;
}

export interface UpdateExperimentInput {
  name: string | null;
  description: string | null;
}

export interface CreateCaseInput {
  title: string;
  prompt: string;
  expectedResult: string;
  tags: string[];
  requiredArtifactKinds: ArtifactKind[];
  allowedPathPrefixes: string[];
}

export interface UpdateCaseInput {
  title: string | null;
  prompt: string | null;
  expectedResult: string | null;
  tags: string[] | null;
  requiredArtifactKinds: ArtifactKind[] | null;
  allowedPathPrefixes: string[] | null;
}

export interface SaveCandidateRunInput {
  id: string | null;
  candidateLabel: string;
  status: CandidateRunStatus;
  fingerprint: CandidateFingerprintInput;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  steps: CanonicalStep[];
  artifacts: Artifact[];
  grades: Grade[];
  notes: string[];
  executionStats: ExecutionStats | null;
}

export interface CompareCandidatesQuery {
  experimentId: string;
  caseId: string;
  baselineRunId: string;
  candidateRunId: string;
}
