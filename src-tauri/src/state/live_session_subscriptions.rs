use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};

#[derive(Clone, Default)]
pub(crate) struct LiveSessionSubscriptionRegistry {
    inner: Arc<LiveSessionSubscriptionRegistryInner>,
}

#[derive(Default)]
struct LiveSessionSubscriptionRegistryInner {
    next_id: AtomicU64,
    handles: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl LiveSessionSubscriptionRegistry {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn register(&self) -> (String, Arc<AtomicBool>) {
        let next_id = self.inner.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let subscription_id = format!("recent-live-{next_id}");
        let cancel = Arc::new(AtomicBool::new(false));

        self.inner
            .handles
            .lock()
            .expect("live subscription registry should lock")
            .insert(subscription_id.clone(), cancel.clone());

        (subscription_id, cancel)
    }

    pub(crate) fn stop(&self, subscription_id: &str) -> bool {
        let cancel = self
            .inner
            .handles
            .lock()
            .expect("live subscription registry should lock")
            .remove(subscription_id);

        if let Some(cancel) = cancel {
            cancel.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    pub(crate) fn finish(&self, subscription_id: &str) {
        self.inner
            .handles
            .lock()
            .expect("live subscription registry should lock")
            .remove(subscription_id);
    }
}
