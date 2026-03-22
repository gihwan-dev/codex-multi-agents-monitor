use crate::domain::session::ArchivedSessionIndex;
use std::sync::Mutex;

pub(crate) struct ArchivedIndexCache(Mutex<Option<Vec<ArchivedSessionIndex>>>);

impl ArchivedIndexCache {
    pub(crate) fn new() -> Self {
        Self(Mutex::new(None))
    }

    pub(crate) fn clone_entries(&self) -> Option<Vec<ArchivedSessionIndex>> {
        let guard = self.0.lock().unwrap_or_else(|error| error.into_inner());
        guard.clone()
    }

    pub(crate) fn populate_if_empty(
        &self,
        entries: Vec<ArchivedSessionIndex>,
    ) -> Vec<ArchivedSessionIndex> {
        let mut guard = self.0.lock().unwrap_or_else(|error| error.into_inner());
        if guard.is_none() {
            *guard = Some(entries.clone());
            entries
        } else {
            guard.clone().unwrap_or_default()
        }
    }

    pub(crate) fn clear(&self) {
        let mut guard = self.0.lock().unwrap_or_else(|error| error.into_inner());
        *guard = None;
    }
}
