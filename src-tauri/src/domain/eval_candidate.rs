use serde::{Deserialize, Serialize};

const INVENTORY_PREVIEW_LIMIT: usize = 8;
const FNV_OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0001_0000_01b3;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CandidateFingerprintInput {
    pub(crate) vendor: String,
    pub(crate) model: String,
    pub(crate) guidance_text: String,
    pub(crate) skill_names: Vec<String>,
    pub(crate) mcp_servers: Vec<String>,
    pub(crate) approval_policy: String,
    pub(crate) sandbox_policy: String,
    pub(crate) repo_path: Option<String>,
    pub(crate) repo_sha: Option<String>,
    pub(crate) evaluator_version: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CandidateFingerprint {
    pub(crate) vendor: String,
    pub(crate) model: String,
    pub(crate) guidance_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) guidance_preview: Option<String>,
    pub(crate) skills_hash: String,
    pub(crate) skill_names_preview: Vec<String>,
    pub(crate) skill_count: usize,
    pub(crate) mcp_inventory_hash: String,
    pub(crate) mcp_servers: Vec<String>,
    pub(crate) mcp_server_count: usize,
    pub(crate) approval_policy: String,
    pub(crate) sandbox_policy: String,
    pub(crate) repo_sha: String,
    pub(crate) evaluator_version: String,
}

pub(crate) fn build_candidate_fingerprint(
    input: CandidateFingerprintInput,
    repo_sha: String,
) -> CandidateFingerprint {
    let normalized_skills = normalize_inventory(&input.skill_names);
    let normalized_mcp_servers = normalize_inventory(&input.mcp_servers);
    let guidance_text = input.guidance_text.trim().to_owned();

    CandidateFingerprint {
        vendor: normalize_required(&input.vendor),
        model: normalize_required(&input.model),
        guidance_hash: stable_hash(&guidance_text),
        guidance_preview: None,
        skills_hash: stable_hash(&normalized_skills.join("\n")),
        skill_names_preview: normalized_skills
            .iter()
            .take(INVENTORY_PREVIEW_LIMIT)
            .cloned()
            .collect(),
        skill_count: normalized_skills.len(),
        mcp_inventory_hash: stable_hash(&normalized_mcp_servers.join("\n")),
        mcp_servers: normalized_mcp_servers
            .iter()
            .take(INVENTORY_PREVIEW_LIMIT)
            .cloned()
            .collect(),
        mcp_server_count: normalized_mcp_servers.len(),
        approval_policy: normalize_required(&input.approval_policy),
        sandbox_policy: normalize_required(&input.sandbox_policy),
        repo_sha: normalize_required(&repo_sha),
        evaluator_version: normalize_required(&input.evaluator_version),
    }
}

fn normalize_required(value: &str) -> String {
    value.trim().to_owned()
}

fn normalize_inventory(values: &[String]) -> Vec<String> {
    let mut normalized = values
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    normalized.sort_by_cached_key(|value| value.to_ascii_lowercase());
    normalized.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    normalized
}

fn stable_hash(value: &str) -> String {
    let mut hash = FNV_OFFSET_BASIS;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::{build_candidate_fingerprint, CandidateFingerprintInput};

    #[test]
    fn builds_stable_inventory_hashes_from_normalized_inputs() {
        let fingerprint = build_candidate_fingerprint(
            CandidateFingerprintInput {
                vendor: "OpenAI".to_owned(),
                model: "gpt-5.4".to_owned(),
                guidance_text: "system guidance".to_owned(),
                skill_names: vec!["review".to_owned(), " Review ".to_owned(), "qa".to_owned()],
                mcp_servers: vec!["Linear".to_owned(), "figma".to_owned()],
                approval_policy: "never".to_owned(),
                sandbox_policy: "workspace-write".to_owned(),
                repo_path: None,
                repo_sha: None,
                evaluator_version: "mvp-1".to_owned(),
            },
            "abc123".to_owned(),
        );

        assert_eq!(fingerprint.skill_count, 2);
        assert_eq!(fingerprint.skill_names_preview, vec!["qa", "review"]);
        assert_eq!(fingerprint.repo_sha, "abc123");
        assert!(fingerprint.guidance_preview.is_none());
        assert!(!fingerprint.skills_hash.is_empty());
        assert!(!fingerprint.mcp_inventory_hash.is_empty());
    }
}
