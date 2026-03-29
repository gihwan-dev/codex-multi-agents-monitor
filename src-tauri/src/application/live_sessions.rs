use crate::{
    application::recent_sessions::{
        load_recent_session_snapshot, resolve_recent_snapshot_selection, RecentSnapshotSelection,
    },
    domain::session::{
        RecentSessionLiveConnection, RecentSessionLiveSubscription, RecentSessionLiveUpdate,
    },
    state::live_session_subscriptions::LiveSessionSubscriptionRegistry,
};
use std::{
    fs, io,
    path::Path,
    sync::{atomic::AtomicBool, Arc},
    thread,
    time::{Duration, Instant, SystemTime},
};
use tauri::{Emitter, Runtime, Window};

pub(crate) const RECENT_SESSION_LIVE_UPDATE_EVENT: &str = "recent-session-live-update";

const POLL_INTERVAL: Duration = Duration::from_secs(1);
const STALE_AFTER: Duration = Duration::from_secs(5);
const DISCONNECTED_AFTER: Duration = Duration::from_secs(20);

#[derive(Clone, Debug, PartialEq, Eq)]
struct FileVersion {
    len: u64,
    modified_at: Option<SystemTime>,
}

#[derive(Clone, Debug)]
struct RecentSessionWatch {
    subscription_id: String,
    file_path: String,
    selection: RecentSnapshotSelection,
    last_version: Option<FileVersion>,
    last_change_at: Instant,
    connection: RecentSessionLiveConnection,
}

struct RecentSessionWatchLoop<'a> {
    cancel: Arc<AtomicBool>,
    watch: &'a mut RecentSessionWatch,
    poll_interval: Duration,
}

impl RecentSessionWatch {
    fn new(selection: RecentSnapshotSelection, subscription_id: String) -> io::Result<Self> {
        Self::new_at(selection, subscription_id, Instant::now())
    }

    fn new_at(
        selection: RecentSnapshotSelection,
        subscription_id: String,
        now: Instant,
    ) -> io::Result<Self> {
        let last_version = Some(read_file_version(&selection.candidate.file_path)?);
        Ok(Self {
            file_path: selection.candidate.file_path.display().to_string(),
            selection,
            subscription_id,
            last_version,
            last_change_at: now,
            connection: RecentSessionLiveConnection::Live,
        })
    }

    fn poll(&mut self) -> Option<RecentSessionLiveUpdate> {
        self.poll_at(Instant::now())
    }

    fn poll_at(&mut self, now: Instant) -> Option<RecentSessionLiveUpdate> {
        match read_file_version(&self.selection.candidate.file_path) {
            Ok(version) => {
                if self.last_version.as_ref() != Some(&version) {
                    return self.refresh_snapshot(version, now);
                }

                self.transition_connection(now)
            }
            Err(_) => self.set_connection(RecentSessionLiveConnection::Disconnected, None),
        }
    }

    fn transition_connection(&mut self, now: Instant) -> Option<RecentSessionLiveUpdate> {
        let elapsed = now.saturating_duration_since(self.last_change_at);
        if elapsed >= DISCONNECTED_AFTER {
            return self.set_connection(RecentSessionLiveConnection::Disconnected, None);
        }
        if elapsed >= STALE_AFTER
            && !matches!(
                self.connection,
                RecentSessionLiveConnection::Stale | RecentSessionLiveConnection::Disconnected
            )
        {
            return self.set_connection(RecentSessionLiveConnection::Stale, None);
        }

        None
    }

    fn refresh_snapshot(
        &mut self,
        version: FileVersion,
        now: Instant,
    ) -> Option<RecentSessionLiveUpdate> {
        let snapshot = load_recent_session_snapshot(&self.selection);
        let next_connection = if matches!(
            self.connection,
            RecentSessionLiveConnection::Stale | RecentSessionLiveConnection::Disconnected
        ) {
            RecentSessionLiveConnection::Reconnected
        } else {
            RecentSessionLiveConnection::Live
        };

        if let Some(snapshot) = snapshot {
            self.last_version = Some(version);
            self.last_change_at = now;
            self.connection = next_connection;
            return Some(self.build_update(next_connection, Some(snapshot)));
        }

        self.set_connection(RecentSessionLiveConnection::Disconnected, None)
    }

    fn set_connection(
        &mut self,
        connection: RecentSessionLiveConnection,
        snapshot: Option<crate::domain::session::SessionLogSnapshot>,
    ) -> Option<RecentSessionLiveUpdate> {
        if self.connection == connection && snapshot.is_none() {
            return None;
        }

        self.connection = connection;
        Some(self.build_update(connection, snapshot))
    }

    fn build_update(
        &self,
        connection: RecentSessionLiveConnection,
        snapshot: Option<crate::domain::session::SessionLogSnapshot>,
    ) -> RecentSessionLiveUpdate {
        RecentSessionLiveUpdate {
            subscription_id: self.subscription_id.clone(),
            file_path: self.file_path.clone(),
            connection,
            snapshot,
        }
    }
}

pub(crate) fn start_recent_session_live_subscription<R: Runtime>(
    window: Window<R>,
    registry: LiveSessionSubscriptionRegistry,
    file_path: &str,
) -> Result<RecentSessionLiveSubscription, String> {
    let selection = prepare_recent_session_live_watch(file_path)?;
    let (subscription_id, cancel) = registry.register();
    let mut watch = RecentSessionWatch::new(selection, subscription_id.clone())
        .map_err(|error| format!("failed to start live watch: {error}"))?;
    let registry_for_thread = registry.clone();
    let thread_subscription_id = subscription_id.clone();

    thread::spawn(move || {
        let watch_loop = RecentSessionWatchLoop {
            cancel,
            watch: &mut watch,
            poll_interval: POLL_INTERVAL,
        };
        run_recent_session_live_watch_loop(watch_loop, |update| {
            window.emit(RECENT_SESSION_LIVE_UPDATE_EVENT, update).is_ok()
        });
        registry_for_thread.finish(&thread_subscription_id);
    });

    Ok(RecentSessionLiveSubscription { subscription_id })
}

pub(crate) fn stop_recent_session_live_subscription(
    registry: &LiveSessionSubscriptionRegistry,
    subscription_id: &str,
) {
    registry.stop(subscription_id);
}

fn prepare_recent_session_live_watch(file_path: &str) -> Result<RecentSnapshotSelection, String> {
    resolve_recent_snapshot_selection(file_path).ok_or_else(|| {
        "recent live session subscription requires a valid live session file".to_owned()
    })
}

fn run_recent_session_live_watch_loop<F>(
    watch_loop: RecentSessionWatchLoop<'_>,
    mut emit: F,
) where
    F: FnMut(RecentSessionLiveUpdate) -> bool,
{
    let RecentSessionWatchLoop {
        cancel,
        watch,
        poll_interval,
    } = watch_loop;

    while !cancel.load(std::sync::atomic::Ordering::Relaxed) {
        if let Some(update) = watch.poll() {
            if !emit(update) {
                break;
            }
        }

        thread::sleep(poll_interval);
    }
}

fn read_file_version(path: &Path) -> io::Result<FileVersion> {
    let metadata = fs::metadata(path)?;
    Ok(FileVersion {
        len: metadata.len(),
        modified_at: metadata.modified().ok(),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        prepare_recent_session_live_watch, run_recent_session_live_watch_loop,
        RecentSessionWatch, RecentSessionWatchLoop, DISCONNECTED_AFTER, STALE_AFTER,
    };
    use crate::test_support::{
        create_git_workspace, create_state_database, insert_thread_row, session_meta_line,
        write_session_lines, RecentSessionTestContext,
    };
    use std::{
        fs::{self, OpenOptions},
        io::Write,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Mutex,
        },
        thread,
        time::{Duration, Instant},
    };

    fn append_session_line(path: &std::path::Path, line: &str) {
        let mut file = OpenOptions::new()
            .append(true)
            .open(path)
            .expect("session file should open for append");
        writeln!(file, "{line}").expect("session line should append");
    }

    fn create_live_watch_fixture(name: &str) -> (RecentSessionTestContext, std::path::PathBuf) {
        let context = RecentSessionTestContext::new(name);
        let workspace_path = context.projects_root.join("live-watch-project");
        create_git_workspace(&workspace_path);

        let state_database = context.codex_home.join("state.sqlite");
        create_state_database(&state_database, &[]);

        let session_file = context.sessions_root.join("2026/03/29/rollout-live-watch.jsonl");
        write_session_lines(
            &session_file,
            [
                session_meta_line("session-live-watch", &workspace_path),
                r#"{"timestamp":"2026-03-29T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-29T00:00:02.000Z","type":"turn_context","payload":{"model":"gpt-5","turn_id":"turn-1"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-29T00:00:03.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Watch this live session"}]}}"#.to_owned(),
                r#"{"timestamp":"2026-03-29T00:00:04.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Working on it"}]}}"#.to_owned(),
            ],
        );
        insert_thread_row(
            &state_database,
            "session-live-watch",
            &session_file,
            "desktop",
            &workspace_path,
            100,
        );

        (context, session_file)
    }

    #[test]
    fn rejects_invalid_recent_live_subscription_paths() {
        let context = RecentSessionTestContext::new("invalid-live-watch");
        let workspace_path = context.projects_root.join("live-watch-project");
        create_git_workspace(&workspace_path);
        create_state_database(&context.codex_home.join("state.sqlite"), &[]);

        let result = prepare_recent_session_live_watch("/tmp/missing-live-session.jsonl");

        assert!(result.is_err());
    }

    #[test]
    fn transitions_live_watch_from_stale_to_disconnected_to_reconnected() {
        let (_context, session_file) = create_live_watch_fixture("watch-transitions");
        let selection = prepare_recent_session_live_watch(session_file.to_string_lossy().as_ref())
            .expect("watch should prepare");
        let start = Instant::now();
        let mut watch = RecentSessionWatch::new_at(selection, "sub-1".to_owned(), start)
            .expect("watch should start");

        let stale = watch
            .poll_at(start + STALE_AFTER + Duration::from_millis(1))
            .expect("stale update should emit");
        assert_eq!(stale.connection, crate::domain::session::RecentSessionLiveConnection::Stale);
        assert!(stale.snapshot.is_none());

        let disconnected = watch
            .poll_at(start + DISCONNECTED_AFTER + Duration::from_millis(1))
            .expect("disconnected update should emit");
        assert_eq!(
            disconnected.connection,
            crate::domain::session::RecentSessionLiveConnection::Disconnected
        );
        assert!(disconnected.snapshot.is_none());

        append_session_line(
            &session_file,
            r#"{"timestamp":"2026-03-29T00:00:05.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Resumed after reconnect"}]}}"#,
        );

        let reconnected = watch
            .poll_at(start + DISCONNECTED_AFTER + Duration::from_secs(1))
            .expect("reconnected update should emit");
        assert_eq!(
            reconnected.connection,
            crate::domain::session::RecentSessionLiveConnection::Reconnected
        );
        assert!(reconnected.snapshot.is_some());
    }

    #[test]
    fn recovers_after_temporary_session_file_read_failure() {
        let (context, session_file) = create_live_watch_fixture("watch-read-recovery");
        let workspace_path = context.projects_root.join("live-watch-project");
        let selection = prepare_recent_session_live_watch(session_file.to_string_lossy().as_ref())
            .expect("watch should prepare");
        let start = Instant::now();
        let mut watch = RecentSessionWatch::new_at(selection, "sub-1".to_owned(), start)
            .expect("watch should start");

        fs::remove_file(&session_file).expect("session file should be removed");

        let disconnected = watch
            .poll_at(start + Duration::from_secs(1))
            .expect("disconnected update should emit");
        assert_eq!(
            disconnected.connection,
            crate::domain::session::RecentSessionLiveConnection::Disconnected
        );
        assert!(disconnected.snapshot.is_none());

        write_session_lines(
            &session_file,
            [
                session_meta_line("session-live-watch", &workspace_path),
                r#"{"timestamp":"2026-03-29T00:00:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-29T00:00:02.000Z","type":"turn_context","payload":{"model":"gpt-5","turn_id":"turn-1"}}"#.to_owned(),
                r#"{"timestamp":"2026-03-29T00:00:03.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Recovered after temporary read failure"}]}}"#.to_owned(),
            ],
        );

        let reconnected = watch
            .poll_at(start + Duration::from_secs(2))
            .expect("reconnected update should emit");
        assert_eq!(
            reconnected.connection,
            crate::domain::session::RecentSessionLiveConnection::Reconnected
        );
        assert!(reconnected.snapshot.is_some());
    }

    #[test]
    fn stops_live_watch_loop_after_unsubscribe_signal() {
        let (_context, session_file) = create_live_watch_fixture("watch-stop");
        let selection = prepare_recent_session_live_watch(session_file.to_string_lossy().as_ref())
            .expect("watch should prepare");
        let mut watch =
            RecentSessionWatch::new(selection, "sub-1".to_owned()).expect("watch should start");
        let cancel = Arc::new(AtomicBool::new(false));
        let observed_connections = Arc::new(Mutex::new(Vec::new()));
        let observed_connections_for_thread = observed_connections.clone();
        let cancel_for_thread = cancel.clone();

        let handle = thread::spawn(move || {
            run_recent_session_live_watch_loop(
                RecentSessionWatchLoop {
                    cancel: cancel_for_thread,
                    watch: &mut watch,
                    poll_interval: Duration::from_millis(10),
                },
                |update| {
                    observed_connections_for_thread
                        .lock()
                        .expect("observed connections should lock")
                        .push(update.connection);
                    true
                },
            );
        });

        thread::sleep(Duration::from_millis(30));
        cancel.store(true, Ordering::Relaxed);
        handle.join().expect("watch thread should join");

        assert!(
            observed_connections
                .lock()
                .expect("observed connections should lock")
                .len()
                <= 1
        );
    }
}
