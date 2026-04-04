use crate::domain::{
    eval::{
        Artifact, ArtifactCheckStatus, ArtifactKind, CandidateRun, CandidateRunStatus, Case, Grade,
        GraderKind,
    },
    eval_scorecard::ScorecardAxis,
};
use std::collections::BTreeSet;

const OUTCOME_RUBRIC_VERSION: &str = "code.outcome.v1";
const EFFICIENCY_RUBRIC_VERSION: &str = "code.efficiency.v1";

struct GradeTemplate<'a> {
    axis: ScorecardAxis,
    metric_name: &'a str,
    score: u8,
    max_score: u8,
    rubric_version: &'a str,
    reason: String,
}

pub(crate) trait EvalGrader {
    fn grade(&self, case: &Case, run: &CandidateRun) -> Vec<Grade>;
}

pub trait LlmGrader {
    fn grade_with_llm(&self, case: &Case, run: &CandidateRun) -> Vec<Grade>;
}

pub(crate) fn run_code_grader_pipeline(
    case: &Case,
    run: &CandidateRun,
    llm_grader: Option<&dyn LlmGrader>,
) -> Vec<Grade> {
    let mut grades = OutcomeCodeGrader.grade(case, run);
    if let Some(grade) = build_efficiency_grade(run) {
        grades.push(grade);
    }
    if let Some(provider) = llm_grader {
        grades.extend(provider.grade_with_llm(case, run));
    }
    grades
}

struct OutcomeCodeGrader;

impl EvalGrader for OutcomeCodeGrader {
    fn grade(&self, case: &Case, run: &CandidateRun) -> Vec<Grade> {
        vec![
            build_run_completion_grade(run),
            build_structured_check_grade(run),
            build_required_artifact_grade(case, run),
            build_diff_scope_grade(case, run),
        ]
    }
}

fn build_run_completion_grade(run: &CandidateRun) -> Grade {
    let (score, reason) = match run.status {
        CandidateRunStatus::Completed => (100, "Run finished with a completed status."),
        CandidateRunStatus::Failed => (25, "Run finished with a failure status."),
        CandidateRunStatus::Cancelled => (10, "Run was cancelled before completion."),
        CandidateRunStatus::Pending => (0, "Run has not completed yet."),
    };

    new_grade(GradeTemplate {
        axis: ScorecardAxis::Outcome,
        metric_name: "outcome.runCompletion",
        score,
        max_score: 100,
        rubric_version: OUTCOME_RUBRIC_VERSION,
        reason: reason.to_owned(),
    })
}

fn build_structured_check_grade(run: &CandidateRun) -> Grade {
    let check_results = run
        .artifacts
        .iter()
        .filter_map(|artifact| artifact.check_result.as_ref())
        .collect::<Vec<_>>();

    let (score, reason) = if check_results.is_empty() {
        (
            40,
            "No structured build/test/lint result artifacts were attached to the run.".to_owned(),
        )
    } else {
        let passing = check_results
            .iter()
            .filter(|result| result.status == ArtifactCheckStatus::Passed)
            .count();
        let score = ((passing * 100) / check_results.len()).min(100) as u8;
        (
            score,
            format!(
                "{passing} of {} structured checks reported a passing status.",
                check_results.len()
            ),
        )
    };

    new_grade(GradeTemplate {
        axis: ScorecardAxis::Outcome,
        metric_name: "outcome.structuredChecks",
        score,
        max_score: 100,
        rubric_version: OUTCOME_RUBRIC_VERSION,
        reason,
    })
}

fn build_required_artifact_grade(case: &Case, run: &CandidateRun) -> Grade {
    let (score, reason) = score_required_artifacts(case, run);

    new_grade(GradeTemplate {
        axis: ScorecardAxis::Outcome,
        metric_name: "outcome.requiredArtifacts",
        score,
        max_score: 100,
        rubric_version: OUTCOME_RUBRIC_VERSION,
        reason,
    })
}

fn build_diff_scope_grade(case: &Case, run: &CandidateRun) -> Grade {
    let diff_artifacts = collect_diff_artifacts(run);
    let (score, reason) = score_diff_scope(case, diff_artifacts.as_slice());

    new_grade(GradeTemplate {
        axis: ScorecardAxis::Outcome,
        metric_name: "outcome.diffScopePolicy",
        score,
        max_score: 100,
        rubric_version: OUTCOME_RUBRIC_VERSION,
        reason,
    })
}

fn path_is_allowed(case: &Case, artifact: &Artifact) -> bool {
    artifact.path.as_ref().is_some_and(|path| {
        case.allowed_path_prefixes
            .iter()
            .any(|prefix| std::path::Path::new(path).starts_with(prefix))
    })
}

fn build_efficiency_grade(run: &CandidateRun) -> Option<Grade> {
    let wall_clock_ms = run.execution_stats.wall_clock_ms?;
    let (score, reason) = if wall_clock_ms <= 30_000 {
        (
            100,
            "Run finished within the 30 second fast-path budget.".to_owned(),
        )
    } else if wall_clock_ms <= 60_000 {
        (80, "Run finished within one minute.".to_owned())
    } else if wall_clock_ms <= 120_000 {
        (60, "Run finished within two minutes.".to_owned())
    } else {
        (
            25,
            "Run exceeded the two minute efficiency budget.".to_owned(),
        )
    };

    Some(new_grade(GradeTemplate {
        axis: ScorecardAxis::Efficiency,
        metric_name: "efficiency.wallClockBudget",
        score,
        max_score: 100,
        rubric_version: EFFICIENCY_RUBRIC_VERSION,
        reason,
    }))
}

fn score_required_artifacts(case: &Case, run: &CandidateRun) -> (u8, String) {
    if case.required_artifact_kinds.is_empty() {
        return score_artifact_presence(run);
    }

    let actual_kinds = run
        .artifacts
        .iter()
        .map(|artifact| artifact.kind)
        .collect::<BTreeSet<_>>();
    let matched = case
        .required_artifact_kinds
        .iter()
        .filter(|kind| actual_kinds.contains(kind))
        .count();
    let score = ((matched * 100) / case.required_artifact_kinds.len()).min(100) as u8;
    (
        score,
        format!(
            "{matched} of {} required artifact kinds are present.",
            case.required_artifact_kinds.len()
        ),
    )
}

fn score_artifact_presence(run: &CandidateRun) -> (u8, String) {
    if run.artifacts.is_empty() {
        return (30, "Run did not attach any artifacts.".to_owned());
    }

    (
        100,
        "Run attached artifacts for reviewer inspection.".to_owned(),
    )
}

fn collect_diff_artifacts(run: &CandidateRun) -> Vec<&Artifact> {
    run.artifacts
        .iter()
        .filter(|artifact| {
            matches!(
                artifact.kind,
                ArtifactKind::Diff | ArtifactKind::GeneratedFile
            )
        })
        .collect()
}

fn score_diff_scope(case: &Case, diff_artifacts: &[&Artifact]) -> (u8, String) {
    if case.allowed_path_prefixes.is_empty() {
        return (
            100,
            "Case does not restrict diff scope for generated artifacts.".to_owned(),
        );
    }
    if diff_artifacts.is_empty() {
        return (
            40,
            "No diff or generated-file artifacts were attached, so scope could not be verified."
                .to_owned(),
        );
    }
    if diff_artifacts
        .iter()
        .all(|artifact| path_is_allowed(case, artifact))
    {
        return (
            100,
            "All diff and generated-file artifacts stayed within the allowed path policy."
                .to_owned(),
        );
    }

    (
        0,
        "At least one diff or generated-file artifact exceeded the allowed path policy.".to_owned(),
    )
}

fn new_grade(template: GradeTemplate<'_>) -> Grade {
    let graded_at_ms = current_time_ms();
    Grade {
        id: format!(
            "grade_{metric_name}_{graded_at_ms}",
            metric_name = template.metric_name.replace('.', "_")
        ),
        axis: template.axis,
        metric_name: template.metric_name.to_owned(),
        score: template.score,
        max_score: template.max_score,
        grader_kind: GraderKind::Code,
        rubric_version: template.rubric_version.to_owned(),
        reason: template.reason,
        graded_at_ms,
    }
}

fn current_time_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

#[cfg(test)]
mod tests {
    use super::run_code_grader_pipeline;
    use crate::domain::{
        eval::{
            Artifact, ArtifactCheckResult, ArtifactCheckStatus, ArtifactKind, CandidateRun,
            CandidateRunStatus, Case, ExecutionStats, PrivacyPolicy,
        },
        eval_candidate::CandidateFingerprint,
    };

    fn sample_fingerprint() -> CandidateFingerprint {
        CandidateFingerprint {
            vendor: "OpenAI".to_owned(),
            model: "gpt-5.4".to_owned(),
            guidance_hash: "abc".to_owned(),
            guidance_preview: None,
            skills_hash: "def".to_owned(),
            skill_names_preview: vec!["review".to_owned()],
            skill_count: 1,
            mcp_inventory_hash: "ghi".to_owned(),
            mcp_servers: vec!["figma".to_owned()],
            mcp_server_count: 1,
            approval_policy: "never".to_owned(),
            sandbox_policy: "workspace-write".to_owned(),
            repo_sha: "123".to_owned(),
            evaluator_version: "mvp-1".to_owned(),
        }
    }

    fn sample_artifacts() -> Vec<Artifact> {
        vec![
            Artifact {
                id: "artifact_test".to_owned(),
                kind: ArtifactKind::TestOutput,
                label: "Tests".to_owned(),
                path: None,
                media_type: None,
                preview: Some("pass".to_owned()),
                byte_size: None,
                check_result: Some(ArtifactCheckResult {
                    status: ArtifactCheckStatus::Passed,
                    exit_code: Some(0),
                    summary: Some("ok".to_owned()),
                }),
                raw_content_available: false,
            },
            Artifact {
                id: "artifact_diff".to_owned(),
                kind: ArtifactKind::Diff,
                label: "Diff".to_owned(),
                path: Some("src/app.ts".to_owned()),
                media_type: None,
                preview: None,
                byte_size: None,
                check_result: None,
                raw_content_available: false,
            },
        ]
    }

    fn sample_case() -> Case {
        Case {
            id: "case_1".to_owned(),
            experiment_id: "exp_1".to_owned(),
            title: "Smoke".to_owned(),
            prompt: "Fix the bug".to_owned(),
            expected_result: "Tests pass".to_owned(),
            tags: vec!["smoke".to_owned()],
            required_artifact_kinds: vec![ArtifactKind::TestOutput, ArtifactKind::Diff],
            allowed_path_prefixes: vec!["src/".to_owned()],
            created_at_ms: 1,
            updated_at_ms: 1,
        }
    }

    fn sample_run() -> CandidateRun {
        CandidateRun {
            id: "run_1".to_owned(),
            experiment_id: "exp_1".to_owned(),
            case_id: "case_1".to_owned(),
            candidate_label: "baseline".to_owned(),
            status: CandidateRunStatus::Completed,
            fingerprint: sample_fingerprint(),
            started_at_ms: 1,
            finished_at_ms: Some(2),
            steps: vec![],
            artifacts: sample_artifacts(),
            grades: vec![],
            notes: vec![],
            execution_stats: ExecutionStats {
                wall_clock_ms: Some(20_000),
                ..ExecutionStats::default()
            },
            privacy_policy: PrivacyPolicy::default(),
        }
    }

    #[test]
    fn code_grader_pipeline_produces_outcome_and_efficiency_scores() {
        let grades = run_code_grader_pipeline(&sample_case(), &sample_run(), None);

        assert_eq!(grades.len(), 5);
        assert!(grades
            .iter()
            .any(|grade| grade.metric_name == "outcome.runCompletion"));
        assert!(grades
            .iter()
            .any(|grade| grade.metric_name == "efficiency.wallClockBudget"));
    }
}
