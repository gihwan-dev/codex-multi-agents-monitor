use crate::{
    application::{
        archived_sessions::load_archived_session_snapshot_unscored,
        recent_sessions::load_recent_session_snapshot_unscored,
    },
    domain::{
        session::{
            ArchivedSessionIndex, RecentSessionIndexItem, SessionLogSnapshot, SessionProvider,
        },
        session_score::{
            LoadProfileRevisionsQuery, LoadSessionScoresQuery, ProfileAgentSnapshot,
            ProfileRevision, ProfileSnapshot, SaveSessionScoreInput, SessionScore,
            SessionScoreRecord, SessionScoreSortDirection, SessionScoreSortField,
        },
    },
    infrastructure::score_storage,
};
use std::{cmp::Ordering, collections::BTreeMap, io};

pub(crate) fn save_score(input: SaveSessionScoreInput) -> io::Result<SessionScoreRecord> {
    let Some(snapshot) = resolve_session_snapshot_unscored(&input.file_path) else {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "session snapshot is unavailable",
        ));
    };

    validate_score_input(&input)?;

    let record = SessionScoreRecord {
        provider: snapshot.provider,
        session_id: snapshot.session_id.clone(),
        file_path: input.file_path,
        workspace_path: snapshot.workspace_path.clone(),
        session_score: Some(SessionScore {
            score: input.score,
            note: normalize_optional_text(input.note),
            scored_at: input.scored_at.trim().to_owned(),
            scored_by: input.scored_by.trim().to_owned(),
        }),
        profile_snapshot: derive_profile_snapshot(&snapshot),
    };

    score_storage::save_session_score_record(&record)?;
    Ok(record)
}

pub(crate) fn load_scores(query: LoadSessionScoresQuery) -> io::Result<Vec<SessionScoreRecord>> {
    let mut records = if let Some(file_path) = query
        .file_path
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        build_session_score_record_for_file(file_path)?
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        score_storage::load_all_session_score_records()?
    };

    records = filter_score_records(records, &query);
    sort_score_records(&mut records, &query);
    Ok(records)
}

pub(crate) fn load_profile_revisions(
    query: LoadProfileRevisionsQuery,
) -> io::Result<Vec<ProfileRevision>> {
    let records =
        filter_profile_revision_records(score_storage::load_all_session_score_records()?, &query);
    Ok(build_profile_revisions(records))
}

pub(crate) fn hydrate_session_snapshot(snapshot: &mut SessionLogSnapshot) -> io::Result<()> {
    let stored = score_storage::load_session_score_record(
        snapshot.provider,
        &snapshot.session_id,
        &snapshot.workspace_path,
    )?;
    let profile_snapshot = stored
        .as_ref()
        .map(|record| record.profile_snapshot.clone())
        .unwrap_or_else(|| derive_profile_snapshot(snapshot));

    apply_profile_snapshot_to_snapshot(snapshot, &profile_snapshot);
    apply_session_score_to_snapshot(
        snapshot,
        stored
            .as_ref()
            .and_then(|record| record.session_score.as_ref()),
    );

    Ok(())
}

pub(crate) fn hydrate_recent_index_item(item: &mut RecentSessionIndexItem) -> io::Result<()> {
    let stored = score_storage::load_session_score_record(
        item.provider,
        &item.session_id,
        &item.workspace_path,
    )?;
    apply_profile_summary_to_recent_item(
        item,
        stored.as_ref().map(|record| &record.profile_snapshot),
    );
    apply_session_score_to_recent_item(
        item,
        stored
            .as_ref()
            .and_then(|record| record.session_score.as_ref()),
    );
    Ok(())
}

pub(crate) fn hydrate_archived_index_item(item: &mut ArchivedSessionIndex) -> io::Result<()> {
    let stored = score_storage::load_session_score_record(
        item.provider,
        &item.session_id,
        &item.workspace_path,
    )?;
    apply_profile_summary_to_archived_item(
        item,
        stored.as_ref().map(|record| &record.profile_snapshot),
    );
    apply_session_score_to_archived_item(
        item,
        stored
            .as_ref()
            .and_then(|record| record.session_score.as_ref()),
    );
    Ok(())
}

fn validate_score_input(input: &SaveSessionScoreInput) -> io::Result<()> {
    if input.score > 100 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "score must be between 0 and 100",
        ));
    }
    if input.scored_at.trim().is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "scoredAt is required",
        ));
    }
    if input.scored_by.trim().is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "scoredBy is required",
        ));
    }

    Ok(())
}

fn build_session_score_record_for_file(file_path: &str) -> io::Result<Option<SessionScoreRecord>> {
    let Some(snapshot) = resolve_session_snapshot_unscored(file_path) else {
        return Ok(None);
    };

    let stored = score_storage::load_session_score_record(
        snapshot.provider,
        &snapshot.session_id,
        &snapshot.workspace_path,
    )?;
    if let Some(mut record) = stored {
        record.file_path = file_path.to_owned();
        return Ok(Some(record));
    }

    Ok(Some(SessionScoreRecord {
        provider: snapshot.provider,
        session_id: snapshot.session_id.clone(),
        file_path: file_path.to_owned(),
        workspace_path: snapshot.workspace_path.clone(),
        session_score: None,
        profile_snapshot: derive_profile_snapshot(&snapshot),
    }))
}

fn resolve_session_snapshot_unscored(file_path: &str) -> Option<SessionLogSnapshot> {
    load_recent_session_snapshot_unscored(file_path)
        .or_else(|| load_archived_session_snapshot_unscored(file_path))
}

fn derive_profile_snapshot(snapshot: &SessionLogSnapshot) -> ProfileSnapshot {
    let mut subagents = snapshot
        .subagents
        .iter()
        .map(|subagent| ProfileAgentSnapshot {
            provider: subagent.provider,
            role: subagent.agent_role.trim().to_owned(),
            model: subagent.model.clone(),
        })
        .collect::<Vec<_>>();
    subagents.sort_by(|left, right| {
        left.role
            .cmp(&right.role)
            .then_with(|| left.model.cmp(&right.model))
    });

    let guidance_hash = build_guidance_hash(snapshot);
    let revision = build_profile_revision(ProfileRevisionSeed {
        guidance_hash: guidance_hash.as_deref(),
        main_model: snapshot.model.as_deref(),
        provider: snapshot.provider,
        subagents: &subagents,
    });

    ProfileSnapshot {
        revision,
        label: build_profile_label(
            snapshot.provider,
            snapshot.model.as_deref(),
            subagents.len(),
        ),
        provider: snapshot.provider,
        main_model: snapshot.model.clone(),
        guidance_hash,
        subagents,
    }
}

struct ProfileRevisionSeed<'a> {
    guidance_hash: Option<&'a str>,
    main_model: Option<&'a str>,
    provider: SessionProvider,
    subagents: &'a [ProfileAgentSnapshot],
}

fn build_guidance_hash(snapshot: &SessionLogSnapshot) -> Option<String> {
    let guidance = snapshot
        .prompt_assembly
        .iter()
        .filter(|layer| !matches!(layer.layer_type.as_str(), "user" | "subagent-notification"))
        .map(|layer| layer.raw_content.trim())
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    (!guidance.is_empty()).then(|| stable_hash(&guidance))
}

fn build_profile_revision(seed: ProfileRevisionSeed<'_>) -> String {
    let provider_name = match seed.provider {
        SessionProvider::Codex => "codex",
        SessionProvider::Claude => "claude",
    };
    let subagent_signature = build_subagent_signature(seed.subagents);

    stable_hash(&format!(
        "{provider_name}\n{}\n{}\n{}",
        seed.main_model.unwrap_or("unknown"),
        seed.guidance_hash.unwrap_or("none"),
        subagent_signature
    ))
}

fn build_subagent_signature(subagents: &[ProfileAgentSnapshot]) -> String {
    subagents
        .iter()
        .map(|subagent| {
            format!(
                "{}:{}:{}",
                provider_name_for(subagent.provider),
                subagent.role,
                subagent.model.as_deref().unwrap_or("unknown")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn build_profile_label(
    provider: SessionProvider,
    main_model: Option<&str>,
    subagent_count: usize,
) -> String {
    let base = main_model
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| provider_name_for(provider).to_owned());

    if subagent_count == 0 {
        return base;
    }

    format!(
        "{base} + {subagent_count} subagent{}",
        if subagent_count == 1 { "" } else { "s" }
    )
}

fn provider_name_for(provider: SessionProvider) -> &'static str {
    match provider {
        SessionProvider::Codex => "codex",
        SessionProvider::Claude => "claude",
    }
}

fn stable_hash(value: &str) -> String {
    const FNV_OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const FNV_PRIME: u64 = 0x0000_0001_0000_01b3;

    let mut hash = FNV_OFFSET_BASIS;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    format!("{hash:016x}")
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty())
}

fn apply_profile_snapshot_to_snapshot(
    snapshot: &mut SessionLogSnapshot,
    profile_snapshot: &ProfileSnapshot,
) {
    snapshot.profile_revision = Some(profile_snapshot.revision.clone());
    snapshot.profile_label = Some(profile_snapshot.label.clone());
    snapshot.profile_snapshot = Some(profile_snapshot.clone());
}

fn apply_session_score_to_snapshot(
    snapshot: &mut SessionLogSnapshot,
    session_score: Option<&SessionScore>,
) {
    snapshot.score = session_score.map(|score| score.score);
    snapshot.score_note = session_score.and_then(|score| score.note.clone());
    snapshot.scored_at = session_score.map(|score| score.scored_at.clone());
    snapshot.scored_by = session_score.map(|score| score.scored_by.clone());
}

fn apply_profile_summary_to_recent_item(
    item: &mut RecentSessionIndexItem,
    profile_snapshot: Option<&ProfileSnapshot>,
) {
    item.profile_revision = profile_snapshot.map(|profile| profile.revision.clone());
    item.profile_label = profile_snapshot.map(|profile| profile.label.clone());
}

fn apply_session_score_to_recent_item(
    item: &mut RecentSessionIndexItem,
    session_score: Option<&SessionScore>,
) {
    item.score = session_score.map(|score| score.score);
    item.scored_at = session_score.map(|score| score.scored_at.clone());
    item.scored_by = session_score.map(|score| score.scored_by.clone());
}

fn apply_profile_summary_to_archived_item(
    item: &mut ArchivedSessionIndex,
    profile_snapshot: Option<&ProfileSnapshot>,
) {
    item.profile_revision = profile_snapshot.map(|profile| profile.revision.clone());
    item.profile_label = profile_snapshot.map(|profile| profile.label.clone());
}

fn apply_session_score_to_archived_item(
    item: &mut ArchivedSessionIndex,
    session_score: Option<&SessionScore>,
) {
    item.score = session_score.map(|score| score.score);
    item.scored_at = session_score.map(|score| score.scored_at.clone());
    item.scored_by = session_score.map(|score| score.scored_by.clone());
}

fn filter_score_records(
    records: Vec<SessionScoreRecord>,
    query: &LoadSessionScoresQuery,
) -> Vec<SessionScoreRecord> {
    records
        .into_iter()
        .filter(|record| {
            query
                .workspace_path
                .as_ref()
                .map(|workspace_path| workspace_path.trim())
                .filter(|workspace_path| !workspace_path.is_empty())
                .is_none_or(|workspace_path| record.workspace_path == workspace_path)
        })
        .filter(|record| {
            query
                .profile_revision
                .as_ref()
                .map(|revision| revision.trim())
                .filter(|revision| !revision.is_empty())
                .is_none_or(|revision| record.profile_snapshot.revision == revision)
        })
        .filter(|record| {
            query.min_score.is_none_or(|min_score| {
                record
                    .session_score
                    .as_ref()
                    .is_some_and(|score| score.score >= min_score)
            })
        })
        .collect()
}

fn sort_score_records(records: &mut [SessionScoreRecord], query: &LoadSessionScoresQuery) {
    let sort_field = query.sort_by.unwrap_or(SessionScoreSortField::ScoredAt);
    let sort_direction = query
        .sort_direction
        .unwrap_or(SessionScoreSortDirection::Desc);

    records.sort_by(|left, right| {
        let order = match sort_field {
            SessionScoreSortField::Score => {
                compare_optional_score(left.session_score.as_ref(), right.session_score.as_ref())
            }
            SessionScoreSortField::ScoredAt => compare_optional_scored_at(
                left.session_score.as_ref(),
                right.session_score.as_ref(),
            ),
        }
        .then_with(|| {
            left.profile_snapshot
                .label
                .cmp(&right.profile_snapshot.label)
        })
        .then_with(|| left.session_id.cmp(&right.session_id));

        match sort_direction {
            SessionScoreSortDirection::Asc => order,
            SessionScoreSortDirection::Desc => order.reverse(),
        }
    });
}

fn compare_optional_score(left: Option<&SessionScore>, right: Option<&SessionScore>) -> Ordering {
    left.map(|score| score.score)
        .cmp(&right.map(|score| score.score))
}

fn compare_optional_scored_at(
    left: Option<&SessionScore>,
    right: Option<&SessionScore>,
) -> Ordering {
    left.map(|score| score.scored_at.as_str())
        .cmp(&right.map(|score| score.scored_at.as_str()))
}

fn filter_profile_revision_records(
    records: Vec<SessionScoreRecord>,
    query: &LoadProfileRevisionsQuery,
) -> Vec<SessionScoreRecord> {
    records
        .into_iter()
        .filter(|record| {
            query
                .workspace_path
                .as_ref()
                .map(|workspace_path| workspace_path.trim())
                .filter(|workspace_path| !workspace_path.is_empty())
                .is_none_or(|workspace_path| record.workspace_path == workspace_path)
        })
        .collect()
}

fn build_profile_revisions(records: Vec<SessionScoreRecord>) -> Vec<ProfileRevision> {
    let mut by_revision = BTreeMap::<String, Vec<SessionScoreRecord>>::new();
    for record in records {
        by_revision
            .entry(record.profile_snapshot.revision.clone())
            .or_default()
            .push(record);
    }

    let mut revisions = by_revision
        .into_values()
        .map(|records| build_profile_revision_summary(&records))
        .collect::<Vec<_>>();

    revisions.sort_by(|left, right| {
        right
            .session_count
            .cmp(&left.session_count)
            .then_with(|| compare_optional_f64(right.average_score, left.average_score))
            .then_with(|| left.label.cmp(&right.label))
    });

    revisions
}

fn build_profile_revision_summary(records: &[SessionScoreRecord]) -> ProfileRevision {
    let label = records[0].profile_snapshot.label.clone();
    let revision = records[0].profile_snapshot.revision.clone();
    let score_sum = records
        .iter()
        .filter_map(|record| {
            record
                .session_score
                .as_ref()
                .map(|score| f64::from(score.score))
        })
        .sum::<f64>();
    let scored_count = records
        .iter()
        .filter(|record| record.session_score.is_some())
        .count();

    ProfileRevision {
        revision,
        label,
        session_count: records.len(),
        average_score: (scored_count > 0).then_some(score_sum / scored_count as f64),
    }
}

fn compare_optional_f64(left: Option<f64>, right: Option<f64>) -> Ordering {
    match (left, right) {
        (Some(left), Some(right)) => left.partial_cmp(&right).unwrap_or(Ordering::Equal),
        (Some(_), None) => Ordering::Greater,
        (None, Some(_)) => Ordering::Less,
        (None, None) => Ordering::Equal,
    }
}

#[cfg(test)]
mod tests {
    use super::{build_profile_revisions, derive_profile_snapshot, filter_score_records};
    use crate::domain::{
        session::{SessionLogSnapshot, SessionProvider},
        session_score::{LoadSessionScoresQuery, SessionScore, SessionScoreRecord},
    };

    fn test_snapshot() -> SessionLogSnapshot {
        SessionLogSnapshot {
            provider: SessionProvider::Codex,
            session_id: "session-1".to_owned(),
            forked_from_id: None,
            workspace_path: "/tmp/workspace".to_owned(),
            origin_path: "/tmp/workspace".to_owned(),
            display_name: "workspace".to_owned(),
            started_at: "2026-04-03T00:00:00.000Z".to_owned(),
            updated_at: "2026-04-03T00:01:00.000Z".to_owned(),
            model: Some("gpt-5.4".to_owned()),
            score: None,
            score_note: None,
            scored_at: None,
            scored_by: None,
            profile_revision: None,
            profile_label: None,
            profile_snapshot: None,
            max_context_window_tokens: None,
            entries: Vec::new(),
            subagents: Vec::new(),
            is_archived: false,
            prompt_assembly: Vec::new(),
        }
    }

    #[test]
    fn derives_stable_profile_revision_from_snapshot() {
        let first = derive_profile_snapshot(&test_snapshot());
        let second = derive_profile_snapshot(&test_snapshot());

        assert_eq!(first.revision, second.revision);
        assert_eq!(first.label, "gpt-5.4");
    }

    #[test]
    fn filters_records_by_min_score() {
        let filtered = filter_score_records(
            vec![
                SessionScoreRecord {
                    provider: SessionProvider::Codex,
                    session_id: "a".to_owned(),
                    file_path: "a.jsonl".to_owned(),
                    workspace_path: "/tmp/workspace".to_owned(),
                    session_score: Some(SessionScore {
                        score: 90,
                        note: None,
                        scored_at: "2026-04-03T00:00:00.000Z".to_owned(),
                        scored_by: "reviewer".to_owned(),
                    }),
                    profile_snapshot: derive_profile_snapshot(&test_snapshot()),
                },
                SessionScoreRecord {
                    provider: SessionProvider::Codex,
                    session_id: "b".to_owned(),
                    file_path: "b.jsonl".to_owned(),
                    workspace_path: "/tmp/workspace".to_owned(),
                    session_score: Some(SessionScore {
                        score: 60,
                        note: None,
                        scored_at: "2026-04-03T00:00:00.000Z".to_owned(),
                        scored_by: "reviewer".to_owned(),
                    }),
                    profile_snapshot: derive_profile_snapshot(&test_snapshot()),
                },
            ],
            &LoadSessionScoresQuery {
                min_score: Some(80),
                ..LoadSessionScoresQuery::default()
            },
        );

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].session_id, "a");
    }

    #[test]
    fn builds_profile_revision_aggregates() {
        let profile_snapshot = derive_profile_snapshot(&test_snapshot());
        let revisions = build_profile_revisions(vec![
            SessionScoreRecord {
                provider: SessionProvider::Codex,
                session_id: "a".to_owned(),
                file_path: "a.jsonl".to_owned(),
                workspace_path: "/tmp/workspace".to_owned(),
                session_score: Some(SessionScore {
                    score: 80,
                    note: None,
                    scored_at: "2026-04-03T00:00:00.000Z".to_owned(),
                    scored_by: "reviewer".to_owned(),
                }),
                profile_snapshot: profile_snapshot.clone(),
            },
            SessionScoreRecord {
                provider: SessionProvider::Codex,
                session_id: "b".to_owned(),
                file_path: "b.jsonl".to_owned(),
                workspace_path: "/tmp/workspace".to_owned(),
                session_score: Some(SessionScore {
                    score: 100,
                    note: None,
                    scored_at: "2026-04-03T01:00:00.000Z".to_owned(),
                    scored_by: "reviewer".to_owned(),
                }),
                profile_snapshot,
            },
        ]);

        assert_eq!(revisions.len(), 1);
        assert_eq!(revisions[0].session_count, 2);
        assert_eq!(revisions[0].average_score, Some(90.0));
    }
}
