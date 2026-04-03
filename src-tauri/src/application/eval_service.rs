use crate::{
    application::eval_grader::run_code_grader_pipeline,
    domain::{
        eval::{
            CandidateComparison, CandidateRun, Case, CompareCandidatesQuery, CreateCaseInput,
            CreateExperimentInput, ExecutionStats, Experiment, ExperimentDetail, ExperimentSummary,
            Grade, GraderKind, PrivacyPolicy, SaveCandidateRunInput, ScorecardAxisDelta,
            ScorecardAxisSummary, UpdateCaseInput, UpdateExperimentInput,
        },
        eval_candidate::{build_candidate_fingerprint, CandidateFingerprintInput},
        eval_scorecard::ALL_SCORECARD_AXES,
    },
    infrastructure::eval_storage::{
        append_audit_event, delete_experiment_detail, experiment_mutation_lock,
        load_all_experiment_details, load_experiment_detail, resolve_repository_head_sha,
        save_experiment_detail, EvalAuditEvent,
    },
    infrastructure::filesystem::{normalize_path, resolve_codex_home, resolve_project_roots},
};
use std::{io, path::Path};

const EXPERIMENT_NAME_LIMIT: usize = 120;
const CASE_TITLE_LIMIT: usize = 140;
const CASE_TEXT_LIMIT: usize = 4_000;
const NOTE_LIMIT: usize = 500;
const PREVIEW_LIMIT_FALLBACK: usize = 800;
const BOUNDARY_NOTE: &str = "Issue #23 stays session-level and scores a single run in isolation. The eval MVP in issue #25 is experiment-level and compares baseline and candidate runs across shared cases without replacing session scoring.";

struct RunTiming {
    started_at_ms: u64,
    finished_at_ms: Option<u64>,
    execution_stats: ExecutionStats,
}

struct TextPatchRule<'a> {
    limit: usize,
    label: &'a str,
}

struct StringSanitizeRule {
    limit: usize,
    value_limit: usize,
}

struct CandidateRunBuildContext<'a> {
    experiment_id: &'a str,
    case_id: &'a str,
    privacy_policy: PrivacyPolicy,
    now: u64,
}

struct RunTimingInput {
    execution_stats: Option<ExecutionStats>,
    started_at_ms: Option<u64>,
    finished_at_ms: Option<u64>,
    now: u64,
}

struct SanitizedRunPayload {
    steps: Vec<crate::domain::eval::CanonicalStep>,
    artifacts: Vec<crate::domain::eval::Artifact>,
    grades: Vec<Grade>,
    notes: Vec<String>,
}

struct RunPayloadInput {
    preview_limit: usize,
    steps: Vec<crate::domain::eval::CanonicalStep>,
    artifacts: Vec<crate::domain::eval::Artifact>,
    grades: Vec<Grade>,
    notes: Vec<String>,
}

struct PreparedCandidateRun {
    id: String,
    candidate_label: String,
    status: crate::domain::eval::CandidateRunStatus,
    fingerprint: crate::domain::eval_candidate::CandidateFingerprint,
    timing: RunTiming,
    payload: SanitizedRunPayload,
}

struct CandidateRunParts {
    id: Option<String>,
    candidate_label: String,
    status: crate::domain::eval::CandidateRunStatus,
    fingerprint: CandidateFingerprintInput,
    timing_input: RunTimingInput,
    payload_input: RunPayloadInput,
}

struct RecordEventInput<'a> {
    event_kind: &'a str,
    experiment_id: &'a str,
    case_id: Option<&'a str>,
    run_id: Option<&'a str>,
    preview: &'a str,
}

pub(crate) fn list_experiments() -> io::Result<Vec<ExperimentSummary>> {
    let mut experiments = load_all_experiment_details()?
        .into_iter()
        .map(|detail| ExperimentSummary {
            case_count: detail.cases.len(),
            run_count: detail.runs.len(),
            experiment: detail.experiment,
        })
        .collect::<Vec<_>>();

    experiments.sort_by(|left, right| {
        right
            .experiment
            .updated_at_ms
            .cmp(&left.experiment.updated_at_ms)
            .then_with(|| left.experiment.name.cmp(&right.experiment.name))
    });

    Ok(experiments)
}

pub(crate) fn get_experiment_detail(experiment_id: &str) -> io::Result<Option<ExperimentDetail>> {
    load_experiment_detail(experiment_id)
}

pub(crate) fn create_experiment(input: CreateExperimentInput) -> io::Result<ExperimentDetail> {
    let now = current_time_ms();
    let experiment = Experiment {
        id: generate_id("exp", &input.name, now),
        name: require_trimmed(&input.name, EXPERIMENT_NAME_LIMIT, "experiment name")?,
        description: optional_trimmed(input.description.as_deref(), CASE_TEXT_LIMIT),
        created_at_ms: now,
        updated_at_ms: now,
        boundary_note: BOUNDARY_NOTE.to_owned(),
        privacy_policy: PrivacyPolicy::default(),
    };
    let detail = ExperimentDetail {
        experiment,
        cases: Vec::new(),
        runs: Vec::new(),
    };

    save_experiment_detail(&detail)?;
    record_event(RecordEventInput {
        event_kind: "experimentCreated",
        experiment_id: &detail.experiment.id,
        case_id: None,
        run_id: None,
        preview: &detail.experiment.name,
    })?;
    Ok(detail)
}

pub(crate) fn update_experiment(
    experiment_id: &str,
    patch: UpdateExperimentInput,
) -> io::Result<Option<ExperimentDetail>> {
    with_experiment_mutation(experiment_id, || {
        let Some(mut detail) = load_experiment_detail(experiment_id)? else {
            return Ok(None);
        };

        if let Some(name) = patch.name.as_deref() {
            detail.experiment.name =
                require_trimmed(name, EXPERIMENT_NAME_LIMIT, "experiment name")?;
        }
        if let Some(description) = patch.description {
            detail.experiment.description = optional_trimmed(Some(&description), CASE_TEXT_LIMIT);
        }
        detail.experiment.updated_at_ms = current_time_ms();

        save_experiment_detail(&detail)?;
        record_event(RecordEventInput {
            event_kind: "experimentUpdated",
            experiment_id: &detail.experiment.id,
            case_id: None,
            run_id: None,
            preview: &detail.experiment.name,
        })?;
        Ok(Some(detail))
    })
}

pub(crate) fn delete_experiment(experiment_id: &str) -> io::Result<bool> {
    with_experiment_mutation(experiment_id, || {
        let deleted = delete_experiment_detail(experiment_id)?;
        if deleted {
            record_event(RecordEventInput {
                event_kind: "experimentDeleted",
                experiment_id,
                case_id: None,
                run_id: None,
                preview: experiment_id,
            })?;
        }
        Ok(deleted)
    })
}

pub(crate) fn add_case(
    experiment_id: &str,
    input: CreateCaseInput,
) -> io::Result<Option<ExperimentDetail>> {
    with_experiment_mutation(experiment_id, || {
        let Some(mut detail) = load_experiment_detail(experiment_id)? else {
            return Ok(None);
        };
        let now = current_time_ms();
        let case = Case {
            id: generate_id("case", &input.title, now),
            experiment_id: experiment_id.to_owned(),
            title: require_trimmed(&input.title, CASE_TITLE_LIMIT, "case title")?,
            prompt: require_trimmed(&input.prompt, CASE_TEXT_LIMIT, "case prompt")?,
            expected_result: require_trimmed(
                &input.expected_result,
                CASE_TEXT_LIMIT,
                "case expected result",
            )?,
            tags: sanitize_strings(&input.tags, 32, 40),
            required_artifact_kinds: input.required_artifact_kinds,
            allowed_path_prefixes: sanitize_strings(&input.allowed_path_prefixes, 24, 180),
            created_at_ms: now,
            updated_at_ms: now,
        };
        detail.cases.push(case.clone());
        detail.experiment.updated_at_ms = now;

        save_experiment_detail(&detail)?;
        record_event(RecordEventInput {
            event_kind: "caseAdded",
            experiment_id,
            case_id: Some(&case.id),
            run_id: None,
            preview: &case.title,
        })?;
        Ok(Some(detail))
    })
}

pub(crate) fn update_case(
    experiment_id: &str,
    case_id: &str,
    patch: UpdateCaseInput,
) -> io::Result<Option<ExperimentDetail>> {
    with_experiment_mutation(experiment_id, || {
        let Some(mut detail) = load_experiment_detail(experiment_id)? else {
            return Ok(None);
        };
        let Some(case) = detail.cases.iter_mut().find(|case| case.id == case_id) else {
            return Ok(None);
        };
        apply_case_patch(case, patch)?;

        let now = current_time_ms();
        case.updated_at_ms = now;
        let case_title = case.title.clone();
        detail.experiment.updated_at_ms = now;

        save_experiment_detail(&detail)?;
        record_event(RecordEventInput {
            event_kind: "caseUpdated",
            experiment_id,
            case_id: Some(case_id),
            run_id: None,
            preview: &case_title,
        })?;
        Ok(Some(detail))
    })
}

pub(crate) fn delete_case(
    experiment_id: &str,
    case_id: &str,
) -> io::Result<Option<ExperimentDetail>> {
    with_experiment_mutation(experiment_id, || {
        let Some(mut detail) = load_experiment_detail(experiment_id)? else {
            return Ok(None);
        };
        let previous_case_count = detail.cases.len();
        detail.cases.retain(|case| case.id != case_id);
        if detail.cases.len() == previous_case_count {
            return Ok(None);
        }

        detail.runs.retain(|run| run.case_id != case_id);
        detail.experiment.updated_at_ms = current_time_ms();

        save_experiment_detail(&detail)?;
        record_event(RecordEventInput {
            event_kind: "caseDeleted",
            experiment_id,
            case_id: Some(case_id),
            run_id: None,
            preview: case_id,
        })?;
        Ok(Some(detail))
    })
}

pub(crate) fn save_candidate_run(
    experiment_id: &str,
    case_id: &str,
    input: SaveCandidateRunInput,
) -> io::Result<Option<CandidateRun>> {
    with_experiment_mutation(experiment_id, || {
        let Some(mut detail) = load_experiment_detail(experiment_id)? else {
            return Ok(None);
        };
        let Some(case) = find_case(detail.cases.as_slice(), case_id) else {
            return Ok(None);
        };
        let now = current_time_ms();
        let run = build_candidate_run(
            CandidateRunBuildContext {
                experiment_id,
                case_id,
                privacy_policy: detail.experiment.privacy_policy.clone(),
                now,
            },
            input,
        )?;
        upsert_candidate_run(&mut detail.runs, run.clone())?;
        detail.experiment.updated_at_ms = now;

        save_experiment_detail(&detail)?;
        record_event(RecordEventInput {
            event_kind: "candidateRunSaved",
            experiment_id,
            case_id: Some(&case.id),
            run_id: Some(&run.id),
            preview: &run.candidate_label,
        })?;
        Ok(Some(run))
    })
}

pub(crate) fn run_grader(
    experiment_id: &str,
    case_id: &str,
    run_id: &str,
) -> io::Result<Option<CandidateRun>> {
    with_experiment_mutation(experiment_id, || {
        let Some(mut detail) = load_experiment_detail(experiment_id)? else {
            return Ok(None);
        };
        let Some(case) = detail.cases.iter().find(|case| case.id == case_id).cloned() else {
            return Ok(None);
        };
        let scope = RunScope {
            experiment_id,
            case_id,
            run_id,
        };
        let Some(run) = find_run_mut(detail.runs.as_mut_slice(), &scope)? else {
            return Ok(None);
        };

        let code_grades = run_code_grader_pipeline(&case, run, None);
        run.grades = merge_grades(&run.grades, code_grades);
        detail.experiment.updated_at_ms = current_time_ms();

        let updated_run = run.clone();
        save_experiment_detail(&detail)?;
        record_event(RecordEventInput {
            event_kind: "graderRan",
            experiment_id,
            case_id: Some(case_id),
            run_id: Some(run_id),
            preview: &updated_run.candidate_label,
        })?;
        Ok(Some(updated_run))
    })
}

pub(crate) fn compare_candidates(
    query: CompareCandidatesQuery,
) -> io::Result<Option<CandidateComparison>> {
    let Some(detail) = load_experiment_detail(&query.experiment_id)? else {
        return Ok(None);
    };
    let Some(case) = find_case(detail.cases.as_slice(), &query.case_id) else {
        return Ok(None);
    };
    let pair = resolve_comparison_pair(&detail, &query)?;
    let Some((baseline_run, candidate_run)) = pair else {
        return Ok(None);
    };
    let bsc = build_scorecard(&baseline_run.grades);
    let csc = build_scorecard(&candidate_run.grades);
    let deltas = build_scorecard_deltas(&bsc, &csc);
    let boundary_note = detail.experiment.boundary_note.clone();
    Ok(Some(CandidateComparison {
        experiment: detail.experiment,
        case_item: case,
        baseline_run,
        candidate_run,
        baseline_scorecard: bsc,
        candidate_scorecard: csc,
        deltas,
        boundary_note,
    }))
}

fn resolve_comparison_pair(
    detail: &ExperimentDetail,
    query: &CompareCandidatesQuery,
) -> io::Result<Option<(CandidateRun, CandidateRun)>> {
    let (runs, e, c) = (
        detail.runs.as_slice(),
        &*query.experiment_id,
        &*query.case_id,
    );
    let bs = RunScope {
        experiment_id: e,
        case_id: c,
        run_id: &query.baseline_run_id,
    };
    let cs = RunScope {
        experiment_id: e,
        case_id: c,
        run_id: &query.candidate_run_id,
    };
    let Some(baseline) = find_run(runs, &bs)? else {
        return Ok(None);
    };
    let Some(candidate) = find_run(runs, &cs)? else {
        return Ok(None);
    };
    Ok(Some((baseline, candidate)))
}

fn build_scorecard(grades: &[Grade]) -> Vec<ScorecardAxisSummary> {
    ALL_SCORECARD_AXES
        .iter()
        .map(|axis| {
            let axis_grades = grades
                .iter()
                .filter(|grade| grade.axis == *axis)
                .collect::<Vec<_>>();
            if axis_grades.is_empty() {
                return ScorecardAxisSummary {
                    axis: *axis,
                    score: None,
                    graded_metric_count: 0,
                    max_score: 0,
                };
            }

            let max_score = axis_grades
                .iter()
                .map(|grade| u32::from(grade.max_score))
                .sum::<u32>();
            let achieved = axis_grades
                .iter()
                .map(|grade| u32::from(grade.score))
                .sum::<u32>();
            let score = if max_score == 0 {
                None
            } else {
                Some(((achieved * 100) / max_score) as u8)
            };

            ScorecardAxisSummary {
                axis: *axis,
                score,
                graded_metric_count: axis_grades.len(),
                max_score,
            }
        })
        .collect()
}

fn apply_case_patch(case: &mut Case, patch: UpdateCaseInput) -> io::Result<()> {
    apply_case_text_patch(case, &patch)?;
    apply_case_collection_patch(case, patch);
    Ok(())
}

fn apply_case_text_patch(case: &mut Case, patch: &UpdateCaseInput) -> io::Result<()> {
    apply_optional_text_patch(
        &mut case.title,
        patch.title.as_deref(),
        TextPatchRule {
            limit: CASE_TITLE_LIMIT,
            label: "case title",
        },
    )?;
    apply_optional_text_patch(
        &mut case.prompt,
        patch.prompt.as_deref(),
        TextPatchRule {
            limit: CASE_TEXT_LIMIT,
            label: "case prompt",
        },
    )?;
    apply_optional_text_patch(
        &mut case.expected_result,
        patch.expected_result.as_deref(),
        TextPatchRule {
            limit: CASE_TEXT_LIMIT,
            label: "case expected result",
        },
    )?;
    Ok(())
}

fn apply_case_collection_patch(case: &mut Case, patch: UpdateCaseInput) {
    replace_sanitized_strings(
        &mut case.tags,
        patch.tags,
        StringSanitizeRule {
            limit: 32,
            value_limit: 40,
        },
    );
    replace_optional_value(
        &mut case.required_artifact_kinds,
        patch.required_artifact_kinds,
    );
    replace_sanitized_strings(
        &mut case.allowed_path_prefixes,
        patch.allowed_path_prefixes,
        StringSanitizeRule {
            limit: 24,
            value_limit: 180,
        },
    );
}

fn apply_optional_text_patch(
    target: &mut String,
    next: Option<&str>,
    rule: TextPatchRule<'_>,
) -> io::Result<()> {
    if let Some(value) = next {
        *target = require_trimmed(value, rule.limit, rule.label)?;
    }
    Ok(())
}

fn replace_sanitized_strings(
    target: &mut Vec<String>,
    next: Option<Vec<String>>,
    rule: StringSanitizeRule,
) {
    if let Some(values) = next {
        *target = sanitize_strings(&values, rule.limit, rule.value_limit);
    }
}

fn replace_optional_value<T>(target: &mut Vec<T>, next: Option<Vec<T>>) {
    if let Some(values) = next {
        *target = values;
    }
}

fn find_case(cases: &[Case], case_id: &str) -> Option<Case> {
    cases.iter().find(|case| case.id == case_id).cloned()
}

struct RunScope<'a> {
    experiment_id: &'a str,
    case_id: &'a str,
    run_id: &'a str,
}

fn find_run(runs: &[CandidateRun], scope: &RunScope<'_>) -> io::Result<Option<CandidateRun>> {
    ensure_run_scope(runs, scope)?;
    Ok(runs.iter().find(|r| run_matches_scope(r, scope)).cloned())
}

fn find_run_mut<'a>(
    runs: &'a mut [CandidateRun],
    scope: &RunScope<'_>,
) -> io::Result<Option<&'a mut CandidateRun>> {
    ensure_run_scope(runs, scope)?;
    Ok(runs.iter_mut().find(|r| run_matches_scope(r, scope)))
}

fn build_candidate_run(
    context: CandidateRunBuildContext<'_>,
    input: SaveCandidateRunInput,
) -> io::Result<CandidateRun> {
    let prepared = prepare_candidate_run(
        context.now,
        context.privacy_policy.preview_char_limit,
        input,
    )?;

    Ok(CandidateRun {
        id: prepared.id,
        experiment_id: context.experiment_id.to_owned(),
        case_id: context.case_id.to_owned(),
        candidate_label: prepared.candidate_label,
        status: prepared.status,
        fingerprint: prepared.fingerprint,
        started_at_ms: prepared.timing.started_at_ms,
        finished_at_ms: prepared.timing.finished_at_ms,
        steps: prepared.payload.steps,
        artifacts: prepared.payload.artifacts,
        grades: prepared.payload.grades,
        notes: prepared.payload.notes,
        execution_stats: prepared.timing.execution_stats,
        privacy_policy: context.privacy_policy,
    })
}

fn prepare_candidate_run(
    now: u64,
    preview_limit: usize,
    input: SaveCandidateRunInput,
) -> io::Result<PreparedCandidateRun> {
    let parts = split_candidate_run_input(input, now, preview_limit);
    let timing = build_run_timing(parts.timing_input);
    let run_id = resolve_candidate_run_id(parts.id, &parts.candidate_label, now);
    let payload = sanitize_run_payload(parts.payload_input);
    let candidate_label = require_trimmed(&parts.candidate_label, 80, "candidate label")?;
    let fingerprint = build_candidate_run_fingerprint(parts.fingerprint)?;

    Ok(PreparedCandidateRun {
        id: run_id,
        candidate_label,
        status: parts.status,
        fingerprint,
        timing,
        payload,
    })
}

fn split_candidate_run_input(
    input: SaveCandidateRunInput,
    now: u64,
    preview_limit: usize,
) -> CandidateRunParts {
    let SaveCandidateRunInput {
        id,
        candidate_label,
        status,
        fingerprint,
        started_at_ms,
        finished_at_ms,
        steps,
        artifacts,
        grades,
        notes,
        execution_stats,
    } = input;

    CandidateRunParts {
        id,
        candidate_label,
        status,
        fingerprint,
        timing_input: RunTimingInput {
            execution_stats,
            started_at_ms,
            finished_at_ms,
            now,
        },
        payload_input: RunPayloadInput {
            preview_limit,
            steps,
            artifacts,
            grades,
            notes,
        },
    }
}

fn resolve_candidate_run_id(id: Option<String>, candidate_label: &str, now: u64) -> String {
    id.unwrap_or_else(|| generate_id("run", candidate_label, now))
}

fn build_candidate_run_fingerprint(
    input: CandidateFingerprintInput,
) -> io::Result<crate::domain::eval_candidate::CandidateFingerprint> {
    let repo_sha = resolve_candidate_repo_sha(&input)?;
    Ok(build_candidate_fingerprint(input, repo_sha))
}

fn build_run_timing(input: RunTimingInput) -> RunTiming {
    let started_at_ms = input.started_at_ms.unwrap_or(input.now);
    let execution_stats = normalize_execution_stats(
        input.execution_stats.unwrap_or_default(),
        started_at_ms,
        input.finished_at_ms,
    );

    RunTiming {
        started_at_ms,
        finished_at_ms: input.finished_at_ms,
        execution_stats,
    }
}

fn sanitize_run_payload(input: RunPayloadInput) -> SanitizedRunPayload {
    SanitizedRunPayload {
        steps: sanitize_steps(input.steps, input.preview_limit),
        artifacts: sanitize_artifacts(input.artifacts, input.preview_limit),
        grades: sanitize_grades(input.grades, input.preview_limit),
        notes: sanitize_strings(&input.notes, 12, NOTE_LIMIT),
    }
}

fn upsert_candidate_run(runs: &mut Vec<CandidateRun>, run: CandidateRun) -> io::Result<()> {
    let scope = RunScope {
        experiment_id: &run.experiment_id,
        case_id: &run.case_id,
        run_id: &run.id,
    };
    ensure_run_scope(runs, &scope)?;

    if let Some(existing_run) = runs
        .iter_mut()
        .find(|existing| run_matches_scope(existing, &scope))
    {
        *existing_run = merge_existing_run(existing_run, run);
        return Ok(());
    }

    runs.push(run);
    Ok(())
}

fn merge_existing_run(existing_run: &CandidateRun, run: CandidateRun) -> CandidateRun {
    let grades = if run.grades.is_empty() {
        existing_run.grades.clone()
    } else {
        run.grades.clone()
    };

    CandidateRun { grades, ..run }
}

fn ensure_run_scope(runs: &[CandidateRun], scope: &RunScope<'_>) -> io::Result<()> {
    if runs
        .iter()
        .any(|run| run.id == scope.run_id && !run_matches_scope(run, scope))
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!(
                "run {} does not belong to experiment {} case {}",
                scope.run_id, scope.experiment_id, scope.case_id
            ),
        ));
    }
    Ok(())
}

fn run_matches_scope(run: &CandidateRun, scope: &RunScope<'_>) -> bool {
    run.experiment_id == scope.experiment_id
        && run.case_id == scope.case_id
        && run.id == scope.run_id
}

fn build_scorecard_deltas(
    baseline: &[ScorecardAxisSummary],
    candidate: &[ScorecardAxisSummary],
) -> Vec<ScorecardAxisDelta> {
    ALL_SCORECARD_AXES
        .iter()
        .map(|axis| ScorecardAxisDelta {
            axis: *axis,
            delta: calculate_delta(
                baseline.iter().find(|summary| summary.axis == *axis),
                candidate.iter().find(|summary| summary.axis == *axis),
            ),
        })
        .collect()
}

fn calculate_delta(
    baseline: Option<&ScorecardAxisSummary>,
    candidate: Option<&ScorecardAxisSummary>,
) -> Option<i16> {
    let baseline_score = i16::from(baseline?.score?);
    let candidate_score = i16::from(candidate?.score?);
    Some(candidate_score - baseline_score)
}

fn merge_grades(existing: &[Grade], code_grades: Vec<Grade>) -> Vec<Grade> {
    let mut merged = existing
        .iter()
        .filter(|grade| grade.grader_kind != GraderKind::Code)
        .cloned()
        .collect::<Vec<_>>();
    merged.extend(code_grades);
    merged
}

fn resolve_candidate_repo_sha(input: &CandidateFingerprintInput) -> io::Result<String> {
    if let Some(repo_sha) = input
        .repo_sha
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(repo_sha.trim().to_owned());
    }

    let repo_path = input
        .repo_path
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "candidate fingerprint requires repo_sha or repo_path",
            )
        })?;

    let repo_path = normalize_path(Path::new(repo_path))?;
    ensure_repo_path_is_within_project_roots(&repo_path)?;
    resolve_repository_head_sha(&repo_path)
}

fn ensure_repo_path_is_within_project_roots(repo_path: &Path) -> io::Result<()> {
    let codex_home = resolve_codex_home()?;
    let project_roots = resolve_project_roots(&codex_home)?;
    if project_roots.into_iter().any(|root| {
        normalize_path(&root)
            .map(|normalized_root| repo_path.starts_with(&normalized_root))
            .unwrap_or(false)
    }) {
        return Ok(());
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "candidate fingerprint repo_path must stay within configured project roots",
    ))
}

fn normalize_execution_stats(
    mut stats: ExecutionStats,
    started_at_ms: u64,
    finished_at_ms: Option<u64>,
) -> ExecutionStats {
    if stats.wall_clock_ms.is_none() {
        stats.wall_clock_ms = finished_at_ms.map(|finished| finished.saturating_sub(started_at_ms));
    }
    stats
}

fn sanitize_steps(
    steps: Vec<crate::domain::eval::CanonicalStep>,
    preview_limit: usize,
) -> Vec<crate::domain::eval::CanonicalStep> {
    steps
        .into_iter()
        .map(|mut step| {
            step.title = truncate_text(&step.title, 140);
            step.actor = step.actor.map(|value| truncate_text(&value, 80));
            step.tool_name = step.tool_name.map(|value| truncate_text(&value, 80));
            step.model_name = step.model_name.map(|value| truncate_text(&value, 80));
            step.input_preview = step
                .input_preview
                .map(|value| truncate_text(&value, preview_limit));
            step.output_preview = step
                .output_preview
                .map(|value| truncate_text(&value, preview_limit));
            step.details_preview = step
                .details_preview
                .map(|value| truncate_text(&value, preview_limit));
            step
        })
        .collect()
}

fn sanitize_artifacts(
    artifacts: Vec<crate::domain::eval::Artifact>,
    preview_limit: usize,
) -> Vec<crate::domain::eval::Artifact> {
    artifacts
        .into_iter()
        .map(|mut artifact| {
            artifact.label = truncate_text(&artifact.label, 120);
            artifact.path = artifact.path.map(|value| truncate_text(&value, 260));
            artifact.media_type = artifact.media_type.map(|value| truncate_text(&value, 80));
            artifact.preview = artifact
                .preview
                .map(|value| truncate_text(&value, preview_limit));
            artifact
        })
        .collect()
}

fn sanitize_grades(grades: Vec<Grade>, preview_limit: usize) -> Vec<Grade> {
    grades
        .into_iter()
        .map(|mut grade| {
            grade.metric_name = truncate_text(&grade.metric_name, 120);
            grade.rubric_version = truncate_text(&grade.rubric_version, 80);
            grade.reason = truncate_text(&grade.reason, preview_limit);
            grade
        })
        .collect()
}

fn sanitize_strings(values: &[String], limit: usize, value_limit: usize) -> Vec<String> {
    values
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .take(limit)
        .map(|value| truncate_text(value, value_limit))
        .collect()
}

fn require_trimmed(value: &str, limit: usize, label: &str) -> io::Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{label} is required"),
        ));
    }

    Ok(truncate_text(trimmed, limit))
}

fn optional_trimmed(value: Option<&str>, limit: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| truncate_text(value, limit))
}

fn truncate_text(value: &str, limit: usize) -> String {
    let char_count = value.chars().count();
    if char_count <= limit {
        return value.to_owned();
    }

    let truncated = value.chars().take(limit).collect::<String>();
    format!("{truncated}…")
}

fn generate_id(prefix: &str, seed: &str, timestamp_ms: u64) -> String {
    let slug = seed
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .take(4)
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        format!("{prefix}_{timestamp_ms}")
    } else {
        format!("{prefix}_{timestamp_ms}_{slug}")
    }
}

fn current_time_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

fn with_experiment_mutation<T>(
    experiment_id: &str,
    mutate: impl FnOnce() -> io::Result<T>,
) -> io::Result<T> {
    let lock = experiment_mutation_lock(experiment_id);
    let _guard = lock.lock().unwrap_or_else(|error| error.into_inner());
    mutate()
}

fn record_event(input: RecordEventInput<'_>) -> io::Result<()> {
    append_audit_event(&EvalAuditEvent {
        timestamp_ms: current_time_ms(),
        event_kind: input.event_kind.to_owned(),
        experiment_id: input.experiment_id.to_owned(),
        case_id: input.case_id.map(ToOwned::to_owned),
        run_id: input.run_id.map(ToOwned::to_owned),
        preview: truncate_text(input.preview, PREVIEW_LIMIT_FALLBACK),
    })
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{
        build_scorecard, calculate_delta, compare_candidates, create_experiment, run_grader,
        save_candidate_run,
    };
    use crate::domain::{
        eval::{
            Artifact, ArtifactCheckResult, ArtifactCheckStatus, ArtifactKind, CandidateRunStatus,
            CompareCandidatesQuery, CreateCaseInput, CreateExperimentInput, ExecutionStats,
            SaveCandidateRunInput, ScorecardAxisSummary,
        },
        eval_candidate::CandidateFingerprintInput,
        eval_scorecard::ScorecardAxis,
    };
    use crate::test_support::RecentSessionTestContext;
    use std::{fs, io, path::Path};

    fn create_case_for_test(experiment_id: &str) -> crate::domain::eval::Case {
        let detail = super::add_case(
            experiment_id,
            CreateCaseInput {
                title: "Smoke".to_owned(),
                prompt: "Run tests".to_owned(),
                expected_result: "All checks pass".to_owned(),
                tags: vec!["smoke".to_owned()],
                required_artifact_kinds: vec![ArtifactKind::TestOutput],
                allowed_path_prefixes: vec!["src/".to_owned()],
            },
        )
        .expect("add case")
        .expect("detail after case");

        detail.cases.first().expect("case").clone()
    }

    fn create_repo_fixture(repo_path: &Path) {
        fs::create_dir_all(repo_path.join(".git/refs/heads")).expect("create git dirs");
        fs::write(repo_path.join(".git/HEAD"), "ref: refs/heads/main\n").expect("write head");
        fs::write(repo_path.join(".git/refs/heads/main"), "abc123\n").expect("write ref");
    }

    fn sample_fingerprint_input(repo_path: &Path) -> CandidateFingerprintInput {
        CandidateFingerprintInput {
            vendor: "OpenAI".to_owned(),
            model: "gpt-5.4".to_owned(),
            guidance_text: "system".to_owned(),
            skill_names: vec!["review".to_owned()],
            mcp_servers: vec!["linear".to_owned()],
            approval_policy: "never".to_owned(),
            sandbox_policy: "workspace-write".to_owned(),
            repo_path: Some(repo_path.display().to_string()),
            repo_sha: None,
            evaluator_version: "mvp-1".to_owned(),
        }
    }

    fn sample_run_artifacts() -> Vec<Artifact> {
        vec![Artifact {
            id: "artifact_test".to_owned(),
            kind: ArtifactKind::TestOutput,
            label: "Tests".to_owned(),
            path: None,
            media_type: None,
            preview: Some("ok".to_owned()),
            byte_size: None,
            check_result: Some(ArtifactCheckResult {
                status: ArtifactCheckStatus::Passed,
                exit_code: Some(0),
                summary: Some("pass".to_owned()),
            }),
            raw_content_available: false,
        }]
    }

    fn sample_run_input(repo_path: &Path) -> SaveCandidateRunInput {
        SaveCandidateRunInput {
            id: None,
            candidate_label: "baseline".to_owned(),
            status: CandidateRunStatus::Completed,
            fingerprint: sample_fingerprint_input(repo_path),
            started_at_ms: Some(10),
            finished_at_ms: Some(40),
            steps: vec![],
            artifacts: sample_run_artifacts(),
            grades: vec![],
            notes: vec![],
            execution_stats: Some(ExecutionStats {
                wall_clock_ms: Some(30),
                ..ExecutionStats::default()
            }),
        }
    }

    fn sample_run_input_with_id(
        repo_path: &Path,
        run_id: &str,
        candidate_label: &str,
    ) -> SaveCandidateRunInput {
        let mut input = sample_run_input(repo_path);
        input.id = Some(run_id.to_owned());
        input.candidate_label = candidate_label.to_owned();
        input
    }

    #[test]
    fn creates_and_grades_candidate_runs() {
        let context = RecentSessionTestContext::new("eval-service");
        let experiment = create_experiment(CreateExperimentInput {
            name: "Baseline comparison".to_owned(),
            description: None,
        })
        .expect("create experiment");
        let case = create_case_for_test(&experiment.experiment.id);
        let repo_path = context.projects_root.join("repo");
        create_repo_fixture(&repo_path);
        let run = save_candidate_run(
            &experiment.experiment.id,
            &case.id,
            sample_run_input(&repo_path),
        )
        .expect("save candidate run")
        .expect("saved run");

        let graded = run_grader(&experiment.experiment.id, &case.id, &run.id)
            .expect("run grader")
            .expect("graded run");

        assert!(graded
            .grades
            .iter()
            .any(|grade| grade.axis == ScorecardAxis::Outcome));
        assert!(graded
            .grades
            .iter()
            .any(|grade| grade.axis == ScorecardAxis::Efficiency));
    }

    #[test]
    fn calculates_axis_delta_from_two_scorecards() {
        let baseline = ScorecardAxisSummary {
            axis: ScorecardAxis::Outcome,
            score: Some(80),
            graded_metric_count: 2,
            max_score: 200,
        };
        let candidate = ScorecardAxisSummary {
            axis: ScorecardAxis::Outcome,
            score: Some(95),
            graded_metric_count: 2,
            max_score: 200,
        };

        assert_eq!(calculate_delta(Some(&baseline), Some(&candidate)), Some(15));
    }

    #[test]
    fn builds_unscored_axis_placeholders() {
        let scorecard = build_scorecard(&[]);

        assert_eq!(scorecard.len(), 4);
        assert!(scorecard.iter().all(|summary| summary.score.is_none()));
    }

    #[test]
    fn compare_query_type_is_constructible() {
        let query = CompareCandidatesQuery {
            experiment_id: "exp".to_owned(),
            case_id: "case".to_owned(),
            baseline_run_id: "baseline".to_owned(),
            candidate_run_id: "candidate".to_owned(),
        };

        assert_eq!(query.case_id, "case");
    }

    struct CrossCaseSetup {
        _context: RecentSessionTestContext,
        experiment_id: String,
        _first_case_id: String,
        second_case_id: String,
        repo_path: PathBuf,
    }

    fn minimal_case_input(title: &str) -> CreateCaseInput {
        CreateCaseInput {
            title: title.to_owned(),
            prompt: "p".to_owned(),
            expected_result: "r".to_owned(),
            tags: vec![],
            required_artifact_kinds: vec![],
            allowed_path_prefixes: vec![],
        }
    }

    fn setup_cross_case_fixture(label: &str) -> CrossCaseSetup {
        let context = RecentSessionTestContext::new(label);
        let exp = create_experiment(CreateExperimentInput {
            name: label.to_owned(),
            description: None,
        })
        .expect("create experiment");
        let c1 = create_case_for_test(&exp.experiment.id);
        let c2 = super::add_case(&exp.experiment.id, minimal_case_input("Other"))
            .expect("add case")
            .expect("detail")
            .cases
            .into_iter()
            .find(|c| c.id != c1.id)
            .expect("second case");
        let repo = context.projects_root.join("repo");
        create_repo_fixture(&repo);
        save_candidate_run(
            &exp.experiment.id,
            &c1.id,
            sample_run_input_with_id(&repo, "run-shared", "baseline"),
        )
        .expect("save")
        .expect("saved");
        CrossCaseSetup {
            _context: context,
            experiment_id: exp.experiment.id,
            _first_case_id: c1.id,
            second_case_id: c2.id,
            repo_path: repo,
        }
    }

    #[test]
    fn rejects_upserting_run_id_into_a_different_case() {
        let s = setup_cross_case_fixture("eval-run-scope-upsert");
        let error = save_candidate_run(
            &s.experiment_id,
            &s.second_case_id,
            sample_run_input_with_id(&s.repo_path, "run-shared", "candidate"),
        )
        .expect_err("mismatched case run should fail");
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        assert!(error.to_string().contains("does not belong to experiment"));
    }

    #[test]
    fn rejects_comparing_run_id_from_a_different_case() {
        let s = setup_cross_case_fixture("eval-run-scope-compare");
        let error = compare_candidates(CompareCandidatesQuery {
            experiment_id: s.experiment_id,
            case_id: s.second_case_id,
            baseline_run_id: "run-shared".to_owned(),
            candidate_run_id: "missing".to_owned(),
        })
        .expect_err("cross-case compare should fail");
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn rejects_repo_paths_outside_configured_project_roots() {
        let context = RecentSessionTestContext::new("eval-service-repo-path-roots");
        let experiment = create_experiment(CreateExperimentInput {
            name: "Scoped repo".to_owned(),
            description: None,
        })
        .expect("create experiment");
        let case = create_case_for_test(&experiment.experiment.id);
        let repo_path = context.temp_root.join("external-repo");
        create_repo_fixture(&repo_path);

        let error = save_candidate_run(
            &experiment.experiment.id,
            &case.id,
            sample_run_input(&repo_path),
        )
        .expect_err("repo path outside project roots should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        assert!(error
            .to_string()
            .contains("repo_path must stay within configured project roots"));
    }
}
