use std::ffi::OsString;
use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager};

use crate::sources::SourcePaths;

#[derive(Debug, Clone)]
pub struct AppState {
    pub monitor_db_path: PathBuf,
    pub source_paths: SourcePaths,
}

impl AppState {
    pub fn from_handle(app: &AppHandle) -> Result<Self> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .context("failed to resolve app data directory")?;

        fs::create_dir_all(&app_data_dir).with_context(|| {
            format!(
                "failed to create app data directory at {}",
                app_data_dir.display()
            )
        })?;

        let home_dir = resolve_home_dir().context("failed to resolve user home directory")?;
        let source_paths = SourcePaths::from_home(&home_dir);

        Ok(Self {
            monitor_db_path: app_data_dir.join("monitor.db"),
            source_paths,
        })
    }
}

fn resolve_home_dir() -> Option<PathBuf> {
    let candidates: [OsString; 2] = [
        std::env::var_os("HOME").unwrap_or_default(),
        std::env::var_os("USERPROFILE").unwrap_or_default(),
    ];

    candidates
        .into_iter()
        .find(|value| !value.is_empty())
        .map(PathBuf::from)
}
