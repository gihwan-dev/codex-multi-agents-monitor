use crate::{
    application,
    domain::eval::{
        CandidateComparison, CandidateRun, CompareCandidatesQuery, CreateCaseInput,
        CreateExperimentInput, ExperimentDetail, ExperimentSummary, SaveCandidateRunInput,
        UpdateCaseInput, UpdateExperimentInput,
    },
};

#[tauri::command]
pub(crate) async fn list_experiments() -> Result<Vec<ExperimentSummary>, String> {
    tauri::async_runtime::spawn_blocking(application::eval_service::list_experiments)
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn get_experiment_detail(
    experiment_id: String,
) -> Result<Option<ExperimentDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::get_experiment_detail(&experiment_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn create_experiment(
    input: CreateExperimentInput,
) -> Result<ExperimentDetail, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::create_experiment(input)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn update_experiment(
    experiment_id: String,
    patch: UpdateExperimentInput,
) -> Result<Option<ExperimentDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::update_experiment(&experiment_id, patch)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn delete_experiment(experiment_id: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::delete_experiment(&experiment_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn add_case(
    experiment_id: String,
    input: CreateCaseInput,
) -> Result<Option<ExperimentDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::add_case(&experiment_id, input)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn update_case(
    experiment_id: String,
    case_id: String,
    patch: UpdateCaseInput,
) -> Result<Option<ExperimentDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::update_case(&experiment_id, &case_id, patch)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn delete_case(
    experiment_id: String,
    case_id: String,
) -> Result<Option<ExperimentDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::delete_case(&experiment_id, &case_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn save_candidate_run(
    experiment_id: String,
    case_id: String,
    input: SaveCandidateRunInput,
) -> Result<Option<CandidateRun>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::save_candidate_run(&experiment_id, &case_id, input)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn run_grader(
    experiment_id: String,
    case_id: String,
    run_id: String,
) -> Result<Option<CandidateRun>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::run_grader(&experiment_id, &case_id, &run_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn compare_candidates(
    query: CompareCandidatesQuery,
) -> Result<Option<CandidateComparison>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        application::eval_service::compare_candidates(query)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}
