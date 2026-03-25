fn is_delegated_plan_text(text: &str) -> bool {
    text.get(..26)
        .map(|prefix| prefix.eq_ignore_ascii_case("PLEASE IMPLEMENT THIS PLAN"))
        .unwrap_or(false)
}

pub(super) fn classify_developer_content(text: &str) -> (String, String) {
    if text.starts_with("<permissions") {
        ("permissions".into(), "Permissions & Sandbox".into())
    } else if text.starts_with("<app-context>") {
        ("app-context".into(), "App Context".into())
    } else if text.starts_with("<collaboration_mode>") {
        ("collaboration-mode".into(), "Collaboration Mode".into())
    } else if text.starts_with("<apps_instructions>") {
        ("apps".into(), "Apps / Connectors".into())
    } else if text.starts_with("<skills_instructions>") {
        ("skills-catalog".into(), "Skills Catalog".into())
    } else {
        ("system".into(), "Developer Instructions".into())
    }
}

pub(super) fn classify_user_context(text: &str) -> (String, String) {
    let trimmed = text.trim();
    if trimmed.starts_with("# AGENTS.md instructions") {
        ("agents".into(), "AGENTS.md".into())
    } else if trimmed.starts_with("<environment_context>") {
        ("environment".into(), "Environment Context".into())
    } else if trimmed.starts_with("Automation:") {
        ("automation".into(), "Automation Envelope".into())
    } else if is_delegated_plan_text(trimmed) {
        ("delegated".into(), "Delegated Plan".into())
    } else if trimmed.starts_with("<skill>") {
        let name = extract_skill_name(trimmed);
        ("skill".into(), format!("Skill: {name}"))
    } else if trimmed.starts_with("<subagent_notification>") {
        (
            "subagent-notification".into(),
            "Subagent Notification".into(),
        )
    } else if trimmed.starts_with("<turn_aborted>") {
        ("system".into(), "Turn Aborted".into())
    } else {
        ("user".into(), "User Prompt".into())
    }
}

pub(crate) fn is_system_boilerplate_text(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed.starts_with("# AGENTS.md instructions")
        || trimmed.starts_with("Automation:")
        || trimmed.starts_with("<environment_context>")
        || trimmed.starts_with("<permissions")
        || trimmed.starts_with("<skill>")
        || trimmed.starts_with("<subagent_notification>")
        || trimmed.starts_with("<turn_aborted>")
        || is_delegated_plan_text(trimmed)
}

pub(crate) fn extract_skill_name_public(text: &str) -> String {
    extract_skill_name(text)
}

fn extract_skill_name(text: &str) -> String {
    if let Some(start) = text.find("<name>") {
        let after = &text[start + 6..];
        if let Some(end) = after.find("</name>") {
            return after[..end].to_owned();
        }
    }

    "unknown".to_owned()
}
