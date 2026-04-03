use crate::{
    domain::session::SessionLogSnapshot, infrastructure::codex_config::load_model_context_window,
};
use std::path::Path;

pub(crate) fn resolve_snapshot_max_context_window_tokens(
    snapshot: &SessionLogSnapshot,
    codex_home: &Path,
) -> Option<u64> {
    snapshot
        .max_context_window_tokens
        .or_else(|| load_model_context_window(codex_home).ok().flatten())
}

#[cfg(test)]
mod tests {
    use super::resolve_snapshot_max_context_window_tokens;
    use crate::{domain::session::SessionLogSnapshot, test_support::RecentSessionTestContext};
    use std::fs;

    fn build_snapshot(max_context_window_tokens: Option<u64>) -> SessionLogSnapshot {
        SessionLogSnapshot {
            session_id: "session-1".to_owned(),
            forked_from_id: None,
            workspace_path: "/tmp/workspace".to_owned(),
            origin_path: "/tmp/workspace".to_owned(),
            display_name: "workspace".to_owned(),
            started_at: "2026-03-20T00:00:00.000Z".to_owned(),
            updated_at: "2026-03-20T00:00:00.000Z".to_owned(),
            model: Some("gpt-5.4".to_owned()),
            max_context_window_tokens,
            entries: Vec::new(),
            subagents: Vec::new(),
            is_archived: false,
            prompt_assembly: Vec::new(),
        }
    }

    #[test]
    fn prefers_snapshot_runtime_context_window_over_config() {
        let ctx = RecentSessionTestContext::new("context-window-policy-runtime");
        fs::write(
            ctx.codex_home.join("config.toml"),
            "model_context_window = 999999\n",
        )
        .expect("config should be written");

        let resolved = resolve_snapshot_max_context_window_tokens(
            &build_snapshot(Some(258_400)),
            &ctx.codex_home,
        );

        assert_eq!(resolved, Some(258_400));
    }

    #[test]
    fn uses_config_context_window_when_snapshot_runtime_is_missing() {
        let ctx = RecentSessionTestContext::new("context-window-policy-config");
        fs::write(
            ctx.codex_home.join("config.toml"),
            "model_context_window = 258400\n",
        )
        .expect("config should be written");

        let resolved =
            resolve_snapshot_max_context_window_tokens(&build_snapshot(None), &ctx.codex_home);

        assert_eq!(resolved, Some(258_400));
    }

    #[test]
    fn returns_none_when_runtime_and_config_are_missing() {
        let ctx = RecentSessionTestContext::new("context-window-policy-none");

        let resolved =
            resolve_snapshot_max_context_window_tokens(&build_snapshot(None), &ctx.codex_home);

        assert_eq!(resolved, None);
    }
}
