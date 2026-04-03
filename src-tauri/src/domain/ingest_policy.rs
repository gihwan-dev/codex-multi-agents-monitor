use crate::domain::session::{
    ArchivedSessionIndex, ArchivedSessionIndexResult, RecentSessionIndexItem,
};

pub(crate) const MAX_RECENT_SESSIONS: usize = 50;
pub(crate) const RECENT_INDEX_PREFIX_SCAN_LIMIT: usize = 80;
pub(crate) const RECENT_INDEX_TAIL_ENTRY_LIMIT: usize = 120;
pub(crate) const RECENT_INDEX_TAIL_BYTES: u64 = 131_072;
pub(crate) const ARCHIVED_INDEX_SCAN_LIMIT: usize = 50;
pub(crate) const DEFAULT_THREAD_TITLE: &str = "새 스레드";
pub(crate) const LIVE_SESSION_SOURCES: &[&str] = &["desktop", "cli", "vscode", "exec"];

pub(crate) struct ArchivedIndexQuery<'a> {
    pub(crate) offset: usize,
    pub(crate) limit: usize,
    pub(crate) search: Option<String>,
    pub(crate) index: &'a [ArchivedSessionIndex],
}

pub(crate) fn is_supported_live_session_source(source: &str) -> bool {
    LIVE_SESSION_SOURCES.contains(&source.trim())
}

pub(crate) fn should_hide_recent_boot_thread(item: &RecentSessionIndexItem) -> bool {
    item.title == DEFAULT_THREAD_TITLE
        && item.first_user_message.is_none()
        && item.last_event_summary == "No event summary yet."
}

pub(crate) fn filter_archived_index(query: ArchivedIndexQuery<'_>) -> ArchivedSessionIndexResult {
    let filtered: Vec<&ArchivedSessionIndex> = match &query.search {
        Some(search_query) if !search_query.trim().is_empty() => {
            let lower_query = search_query.to_lowercase();
            query
                .index
                .iter()
                .filter(|entry| matches_archived_search(entry, &lower_query))
                .collect()
        }
        _ => query.index.iter().collect(),
    };

    let total = filtered.len();
    let items: Vec<ArchivedSessionIndex> = filtered
        .into_iter()
        .skip(query.offset)
        .take(query.limit)
        .cloned()
        .collect();
    let has_more = query.offset + items.len() < total;

    ArchivedSessionIndexResult {
        items,
        total,
        has_more,
    }
}

fn matches_archived_search(entry: &&ArchivedSessionIndex, lower_query: &str) -> bool {
    entry.display_name.to_lowercase().contains(lower_query)
        || entry.workspace_path.to_lowercase().contains(lower_query)
        || entry
            .first_user_message
            .as_ref()
            .map(|message| message.to_lowercase().contains(lower_query))
            .unwrap_or(false)
}
