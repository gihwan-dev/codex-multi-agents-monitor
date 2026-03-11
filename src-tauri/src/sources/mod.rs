use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct SourcePaths {
    pub live_sessions_dir: PathBuf,
    pub state_db_path: PathBuf,
}

impl SourcePaths {
    pub fn from_home(home_dir: &PathBuf) -> Self {
        let codex_home = home_dir.join(".codex");
        Self {
            live_sessions_dir: codex_home.join("sessions"),
            state_db_path: codex_home.join("state_5.sqlite"),
        }
    }
}
