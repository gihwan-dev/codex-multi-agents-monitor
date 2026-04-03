export const SCORECARD_AXES = [
  "outcome",
  "trust",
  "efficiency",
  "process",
] as const;

export type ScorecardAxis = (typeof SCORECARD_AXES)[number];

export type RawCaptureMode = "disabled" | "optIn";

export interface PrivacyPolicy {
  rawCaptureMode: RawCaptureMode;
  previewCharLimit: number;
}

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  boundaryNote: string;
  privacyPolicy: PrivacyPolicy;
}

export interface ExperimentSummary {
  experiment: Experiment;
  caseCount: number;
  runCount: number;
}

export interface ExperimentDetail {
  experiment: Experiment;
  cases: EvalCase[];
  runs: CandidateRun[];
}

export type ArtifactKind =
  | "diff"
  | "stdout"
  | "stderr"
  | "testOutput"
  | "buildOutput"
  | "lintOutput"
  | "generatedFile"
  | "screenshot"
  | "commandResult"
  | "log";

export interface EvalCase {
  id: string;
  experimentId: string;
  title: string;
  prompt: string;
  expectedResult: string;
  tags: string[];
  requiredArtifactKinds: ArtifactKind[];
  allowedPathPrefixes: string[];
  createdAtMs: number;
  updatedAtMs: number;
}

export type CandidateRunStatus = "pending" | "completed" | "failed" | "cancelled";

export type CanonicalStepKind =
  | "modelCall"
  | "toolCall"
  | "approval"
  | "handoff"
  | "subagent"
  | "compaction";

export type CanonicalStepStatus = "completed" | "failed" | "waiting" | "cancelled";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface CanonicalStep {
  id: string;
  index: number;
  kind: CanonicalStepKind;
  status: CanonicalStepStatus;
  title: string;
  startedAtMs: number;
  finishedAtMs: number | null;
  actor: string | null;
  toolName: string | null;
  modelName: string | null;
  inputPreview: string | null;
  outputPreview: string | null;
  detailsPreview: string | null;
  tokenUsage: TokenUsage | null;
}

export type ArtifactCheckStatus = "passed" | "failed" | "warning" | "skipped";

export interface ArtifactCheckResult {
  status: ArtifactCheckStatus;
  exitCode: number | null;
  summary: string | null;
}

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  label: string;
  path: string | null;
  mediaType: string | null;
  preview: string | null;
  byteSize: number | null;
  checkResult: ArtifactCheckResult | null;
  rawContentAvailable: boolean;
}

export type GraderKind = "code" | "manual" | "llm";

export interface Grade {
  id: string;
  axis: ScorecardAxis;
  metricName: string;
  score: number;
  maxScore: number;
  graderKind: GraderKind;
  rubricVersion: string;
  reason: string;
  gradedAtMs: number;
}

export interface ExecutionStats {
  wallClockMs: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  cacheHitCount: number | null;
  toolCallCount: number | null;
  approvalRequestCount: number | null;
  handoffCount: number | null;
  loopCount: number | null;
}

export interface CandidateFingerprintInput {
  vendor: string;
  model: string;
  guidanceText: string;
  skillNames: string[];
  mcpServers: string[];
  approvalPolicy: string;
  sandboxPolicy: string;
  repoPath: string | null;
  repoSha: string | null;
  evaluatorVersion: string;
}

export interface CandidateFingerprint {
  vendor: string;
  model: string;
  guidanceHash: string;
  guidancePreview: string;
  skillsHash: string;
  skillNamesPreview: string[];
  skillCount: number;
  mcpInventoryHash: string;
  mcpServers: string[];
  mcpServerCount: number;
  approvalPolicy: string;
  sandboxPolicy: string;
  repoSha: string;
  evaluatorVersion: string;
}

export interface CandidateRun {
  id: string;
  experimentId: string;
  caseId: string;
  candidateLabel: string;
  status: CandidateRunStatus;
  fingerprint: CandidateFingerprint;
  startedAtMs: number;
  finishedAtMs: number | null;
  steps: CanonicalStep[];
  artifacts: Artifact[];
  grades: Grade[];
  notes: string[];
  executionStats: ExecutionStats;
  privacyPolicy: PrivacyPolicy;
}

export interface ScorecardAxisSummary {
  axis: ScorecardAxis;
  score: number | null;
  gradedMetricCount: number;
  maxScore: number;
}

export interface ScorecardAxisDelta {
  axis: ScorecardAxis;
  delta: number | null;
}

export interface CandidateComparison {
  experiment: Experiment;
  caseItem: EvalCase;
  baselineRun: CandidateRun;
  candidateRun: CandidateRun;
  baselineScorecard: ScorecardAxisSummary[];
  candidateScorecard: ScorecardAxisSummary[];
  deltas: ScorecardAxisDelta[];
  boundaryNote: string;
}
