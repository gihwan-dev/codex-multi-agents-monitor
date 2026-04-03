use crate::domain::{
    eval_candidate::{CandidateFingerprint, CandidateFingerprintInput},
    eval_scorecard::ScorecardAxis,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum RawCaptureMode {
    Disabled,
    OptIn,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PrivacyPolicy {
    pub(crate) raw_capture_mode: RawCaptureMode,
    pub(crate) preview_char_limit: usize,
}

impl Default for PrivacyPolicy {
    fn default() -> Self {
        Self {
            raw_capture_mode: RawCaptureMode::Disabled,
            preview_char_limit: 800,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Experiment {
    pub(crate) id: String,
    pub(crate) name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
    pub(crate) created_at_ms: u64,
    pub(crate) updated_at_ms: u64,
    pub(crate) boundary_note: String,
    pub(crate) privacy_policy: PrivacyPolicy,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExperimentSummary {
    pub(crate) experiment: Experiment,
    pub(crate) case_count: usize,
    pub(crate) run_count: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExperimentDetail {
    pub(crate) experiment: Experiment,
    pub(crate) cases: Vec<Case>,
    pub(crate) runs: Vec<CandidateRun>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Case {
    pub(crate) id: String,
    pub(crate) experiment_id: String,
    pub(crate) title: String,
    pub(crate) prompt: String,
    pub(crate) expected_result: String,
    pub(crate) tags: Vec<String>,
    pub(crate) required_artifact_kinds: Vec<ArtifactKind>,
    pub(crate) allowed_path_prefixes: Vec<String>,
    pub(crate) created_at_ms: u64,
    pub(crate) updated_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CandidateRunStatus {
    Pending,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CanonicalStepKind {
    ModelCall,
    ToolCall,
    Approval,
    Handoff,
    Subagent,
    Compaction,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CanonicalStepStatus {
    Completed,
    Failed,
    Waiting,
    Cancelled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ArtifactKind {
    Diff,
    Stdout,
    Stderr,
    TestOutput,
    BuildOutput,
    LintOutput,
    GeneratedFile,
    Screenshot,
    CommandResult,
    Log,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ArtifactCheckStatus {
    Passed,
    Failed,
    Warning,
    Skipped,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum GraderKind {
    Code,
    Manual,
    Llm,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TokenUsage {
    pub(crate) input_tokens: u64,
    pub(crate) output_tokens: u64,
    pub(crate) cached_input_tokens: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CanonicalStep {
    pub(crate) id: String,
    pub(crate) index: usize,
    pub(crate) kind: CanonicalStepKind,
    pub(crate) status: CanonicalStepStatus,
    pub(crate) title: String,
    pub(crate) started_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) finished_at_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) actor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) model_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) input_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) output_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) details_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) token_usage: Option<TokenUsage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ArtifactCheckResult {
    pub(crate) status: ArtifactCheckStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) summary: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Artifact {
    pub(crate) id: String,
    pub(crate) kind: ArtifactKind,
    pub(crate) label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) media_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) byte_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) check_result: Option<ArtifactCheckResult>,
    pub(crate) raw_content_available: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Grade {
    pub(crate) id: String,
    pub(crate) axis: ScorecardAxis,
    pub(crate) metric_name: String,
    pub(crate) score: u8,
    pub(crate) max_score: u8,
    pub(crate) grader_kind: GraderKind,
    pub(crate) rubric_version: String,
    pub(crate) reason: String,
    pub(crate) graded_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionStats {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) wall_clock_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) estimated_cost_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) cache_hit_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tool_call_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) approval_request_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) handoff_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) loop_count: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CandidateRun {
    pub(crate) id: String,
    pub(crate) experiment_id: String,
    pub(crate) case_id: String,
    pub(crate) candidate_label: String,
    pub(crate) status: CandidateRunStatus,
    pub(crate) fingerprint: CandidateFingerprint,
    pub(crate) started_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) finished_at_ms: Option<u64>,
    pub(crate) steps: Vec<CanonicalStep>,
    pub(crate) artifacts: Vec<Artifact>,
    pub(crate) grades: Vec<Grade>,
    pub(crate) notes: Vec<String>,
    pub(crate) execution_stats: ExecutionStats,
    pub(crate) privacy_policy: PrivacyPolicy,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScorecardAxisSummary {
    pub(crate) axis: ScorecardAxis,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) score: Option<u8>,
    pub(crate) graded_metric_count: usize,
    pub(crate) max_score: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScorecardAxisDelta {
    pub(crate) axis: ScorecardAxis,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) delta: Option<i16>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CandidateComparison {
    pub(crate) experiment: Experiment,
    pub(crate) case_item: Case,
    pub(crate) baseline_run: CandidateRun,
    pub(crate) candidate_run: CandidateRun,
    pub(crate) baseline_scorecard: Vec<ScorecardAxisSummary>,
    pub(crate) candidate_scorecard: Vec<ScorecardAxisSummary>,
    pub(crate) deltas: Vec<ScorecardAxisDelta>,
    pub(crate) boundary_note: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateExperimentInput {
    pub(crate) name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateExperimentInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateCaseInput {
    pub(crate) title: String,
    pub(crate) prompt: String,
    pub(crate) expected_result: String,
    pub(crate) tags: Vec<String>,
    pub(crate) required_artifact_kinds: Vec<ArtifactKind>,
    pub(crate) allowed_path_prefixes: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateCaseInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) expected_result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) required_artifact_kinds: Option<Vec<ArtifactKind>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) allowed_path_prefixes: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveCandidateRunInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) id: Option<String>,
    pub(crate) candidate_label: String,
    pub(crate) status: CandidateRunStatus,
    pub(crate) fingerprint: CandidateFingerprintInput,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) started_at_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) finished_at_ms: Option<u64>,
    pub(crate) steps: Vec<CanonicalStep>,
    pub(crate) artifacts: Vec<Artifact>,
    pub(crate) grades: Vec<Grade>,
    pub(crate) notes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) execution_stats: Option<ExecutionStats>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompareCandidatesQuery {
    pub(crate) experiment_id: String,
    pub(crate) case_id: String,
    pub(crate) baseline_run_id: String,
    pub(crate) candidate_run_id: String,
}
