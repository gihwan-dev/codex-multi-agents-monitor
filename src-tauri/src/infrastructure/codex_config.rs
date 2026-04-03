use std::{collections::HashMap, fs, io, path::Path};

const CONFIG_FILE_NAME: &str = "config.toml";
const PROFILE_KEY: &str = "profile";
const MODEL_CONTEXT_WINDOW_KEY: &str = "model_context_window";

pub(crate) fn load_model_context_window(codex_home: &Path) -> io::Result<Option<u64>> {
    let config_path = codex_home.join(CONFIG_FILE_NAME);
    let raw = match fs::read_to_string(&config_path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };

    Ok(parse_model_context_window(&raw))
}

fn parse_model_context_window(raw: &str) -> Option<u64> {
    let mut active_profile: Option<String> = None;
    let mut current_section: Option<String> = None;
    let mut root_context_window: Option<u64> = None;
    let mut profile_context_windows = HashMap::<String, u64>::new();

    for line in raw.lines() {
        let stripped = strip_comment(line).trim();
        if stripped.is_empty() {
            continue;
        }

        if let Some(section) = parse_section_header(stripped) {
            current_section = Some(section.to_owned());
            continue;
        }

        if current_section.is_none() && active_profile.is_none() {
            active_profile = parse_string_assignment(stripped, PROFILE_KEY);
        }

        let Some(context_window) = parse_u64_assignment(stripped, MODEL_CONTEXT_WINDOW_KEY) else {
            continue;
        };

        match current_section.as_deref() {
            None => root_context_window = Some(context_window),
            Some(section) if section.starts_with("profiles.") => {
                profile_context_windows.insert(section.to_owned(), context_window);
            }
            Some(_) => {}
        }
    }

    active_profile
        .and_then(|profile| {
            profile_context_windows
                .get(&format!("profiles.{profile}"))
                .copied()
        })
        .or(root_context_window)
}

fn strip_comment(line: &str) -> &str {
    line.split('#').next().unwrap_or(line)
}

fn parse_section_header(line: &str) -> Option<&str> {
    line.strip_prefix('[')?.strip_suffix(']')
}

fn parse_string_assignment(line: &str, key: &str) -> Option<String> {
    let value = parse_assignment_value(line, key)?;
    Some(value.trim().trim_matches('"').to_owned())
}

fn parse_u64_assignment(line: &str, key: &str) -> Option<u64> {
    parse_assignment_value(line, key)?
        .trim()
        .parse::<u64>()
        .ok()
}

fn parse_assignment_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let (candidate_key, candidate_value) = line.split_once('=')?;
    if candidate_key.trim() != key {
        return None;
    }

    Some(candidate_value)
}

#[cfg(test)]
mod tests {
    use super::{load_model_context_window, parse_model_context_window};
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    struct TempConfigDir {
        path: PathBuf,
    }

    impl TempConfigDir {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time")
                .as_nanos();
            let path = std::env::temp_dir().join(format!("codex-config-test-{unique}"));
            fs::create_dir_all(&path).expect("create temp config dir");
            Self { path }
        }
    }

    impl Drop for TempConfigDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn reads_root_model_context_window() {
        let raw = r#"
model = "gpt-5.4"
model_context_window = 1000000
"#;

        assert_eq!(parse_model_context_window(raw), Some(1_000_000));
    }

    #[test]
    fn prefers_selected_profile_model_context_window() {
        let raw = r#"
profile = "general_core"
model_context_window = 200000

[profiles.general_core]
model_context_window = 1000000
"#;

        assert_eq!(parse_model_context_window(raw), Some(1_000_000));
    }

    #[test]
    fn returns_none_when_config_file_is_missing() {
        let temp_dir = TempConfigDir::new();

        let result = load_model_context_window(Path::new(&temp_dir.path));

        assert_eq!(result.expect("config load result"), None);
    }

    #[test]
    fn ignores_unselected_profile_model_context_window() {
        let raw = r#"
profile = "general_core"

[profiles.other]
model_context_window = 1000000
"#;

        assert_eq!(parse_model_context_window(raw), None);
    }

    #[test]
    fn loads_config_file_from_codex_home() {
        let temp_dir = TempConfigDir::new();
        fs::write(
            temp_dir.path.join("config.toml"),
            "model_context_window = 200000\n",
        )
        .expect("write config");

        let result = load_model_context_window(Path::new(&temp_dir.path));

        assert_eq!(result.expect("config load result"), Some(200_000));
    }
}
