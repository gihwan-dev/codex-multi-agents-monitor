use std::fs;
use std::path::PathBuf;

use super::error::CommandError;
use super::open::{map_opener_error, validate_target_path, ExpectedPathKind};

fn test_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "codex-multi-agent-monitor-open-tests-{label}-{}",
        std::process::id()
    ))
}

#[test]
fn validate_target_path_returns_not_found_for_missing_paths() {
    let missing_path = test_path("missing");
    let _ = fs::remove_file(&missing_path);
    let _ = fs::remove_dir_all(&missing_path);

    let result = validate_target_path(&missing_path, ExpectedPathKind::Directory);
    assert!(
        matches!(result, Err(CommandError::PathNotFound(path)) if path == missing_path.display().to_string())
    );
}

#[test]
fn validate_target_path_returns_kind_mismatch_errors() {
    let directory_path = test_path("directory");
    let file_path = directory_path.join("monitor.jsonl");

    let _ = fs::remove_file(&file_path);
    let _ = fs::remove_dir_all(&directory_path);
    fs::create_dir_all(&directory_path).expect("failed to create test directory");
    fs::write(&file_path, "fixture").expect("failed to create test file");

    let directory_mismatch = validate_target_path(&directory_path, ExpectedPathKind::File);
    assert!(
        matches!(directory_mismatch, Err(CommandError::NotFile(path)) if path == directory_path.display().to_string())
    );

    let file_mismatch = validate_target_path(&file_path, ExpectedPathKind::Directory);
    assert!(
        matches!(file_mismatch, Err(CommandError::NotDirectory(path)) if path == file_path.display().to_string())
    );

    let _ = fs::remove_file(&file_path);
    let _ = fs::remove_dir_all(&directory_path);
}

#[test]
fn map_opener_error_maps_to_open_failed() {
    let path = test_path("open-failed");
    let opener_error = tauri_plugin_opener::Error::UnknownProgramName("unknown".to_string());

    let mapped = map_opener_error(&path, opener_error);

    assert!(matches!(mapped, CommandError::OpenFailed { .. }));
}
