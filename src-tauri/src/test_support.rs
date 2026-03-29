use crate::infrastructure::filesystem::normalize_path;
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, MutexGuard,
    },
    time::{SystemTime, UNIX_EPOCH},
};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);
static TEST_ENV_MUTEX: Mutex<()> = Mutex::new(());

pub(crate) struct TempDir {
    pub(crate) path: PathBuf,
}

struct EnvVarGuard {
    key: &'static str,
    original: Option<std::ffi::OsString>,
}

pub(crate) struct RecentSessionTestContext {
    _temp_dir: TempDir,
    _env_lock: MutexGuard<'static, ()>,
    _home_guard: EnvVarGuard,
    _codex_home_guard: EnvVarGuard,
    pub(crate) temp_root: PathBuf,
    pub(crate) codex_home: PathBuf,
    pub(crate) sessions_root: PathBuf,
    pub(crate) projects_root: PathBuf,
}

impl TempDir {
    pub(crate) fn new(name: &str) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let unique = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "codex-multi-agent-monitor-{name}-{timestamp}-{unique}"
        ));
        fs::create_dir_all(&path).expect("temp dir should be created");
        Self { path }
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

impl EnvVarGuard {
    fn set(key: &'static str, value: &Path) -> Self {
        let original = std::env::var_os(key);
        std::env::set_var(key, value);
        Self { key, original }
    }
}

impl Drop for EnvVarGuard {
    fn drop(&mut self) {
        if let Some(value) = &self.original {
            std::env::set_var(self.key, value);
        } else {
            std::env::remove_var(self.key);
        }
    }
}

impl RecentSessionTestContext {
    pub(crate) fn new(name: &str) -> Self {
        let env_lock = TEST_ENV_MUTEX.lock().expect("test env mutex should lock");
        let temp_dir = TempDir::new(name);
        let home_root = normalize_path(&temp_dir.path).expect("temp path should normalize");
        let home_guard = EnvVarGuard::set("HOME", &home_root);
        let codex_home = home_root.join(".codex");
        let codex_home_guard = EnvVarGuard::set("CODEX_HOME", &codex_home);
        let sessions_root = codex_home.join("sessions");
        let projects_root = home_root.join("Documents/Projects");

        fs::create_dir_all(&sessions_root).expect("sessions root should exist");
        fs::create_dir_all(&projects_root).expect("projects root should exist");

        Self {
            _temp_dir: temp_dir,
            _env_lock: env_lock,
            _home_guard: home_guard,
            _codex_home_guard: codex_home_guard,
            temp_root: home_root,
            codex_home,
            sessions_root,
            projects_root,
        }
    }
}

pub(crate) fn create_state_database(path: &Path, archived_ids: &[&str]) {
    let connection = Connection::open(path).expect("state database should be created");
    connection
        .execute_batch(
            "CREATE TABLE threads (
                id TEXT PRIMARY KEY,
                rollout_path TEXT NOT NULL DEFAULT '',
                updated_at INTEGER NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT '',
                cwd TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                first_user_message TEXT NOT NULL DEFAULT '',
                archived INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE thread_spawn_edges (
                parent_thread_id TEXT NOT NULL,
                child_thread_id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'closed'
            );",
        )
        .expect("threads table should be created");

    for thread_id in archived_ids {
        connection
            .execute(
                "INSERT INTO threads (id, archived) VALUES (?1, 1)",
                [thread_id],
            )
            .expect("archived thread should be inserted");
    }
}

pub(crate) fn insert_thread_row(
    path: &Path,
    session_id: &str,
    rollout_path: &Path,
    source: &str,
    workspace_path: &Path,
    updated_at: i64,
) {
    insert_thread_row_with_archive_flag(
        path,
        session_id,
        rollout_path,
        source,
        workspace_path,
        updated_at,
        false,
    );
}

pub(crate) type LiveThreadFixtureArgs<'a> = (
    &'a Path,
    &'a str,
    &'a Path,
    &'a str,
    &'a Path,
    i64,
    String,
    &'a [&'a str],
);

pub(crate) fn persist_live_thread_fixture(fixture: LiveThreadFixtureArgs<'_>) {
    let (
        state_database,
        session_id,
        session_file,
        source,
        workspace_path,
        updated_at,
        header,
        events,
    ) = fixture;
    write_session_lines(
        session_file,
        std::iter::once(header)
            .chain(events.iter().map(|line| (*line).to_owned()))
            .collect::<Vec<_>>(),
    );
    insert_thread_row(
        state_database,
        session_id,
        session_file,
        source,
        workspace_path,
        updated_at,
    );
}

pub(crate) fn insert_thread_row_with_archive_flag(
    path: &Path,
    session_id: &str,
    rollout_path: &Path,
    source: &str,
    workspace_path: &Path,
    updated_at: i64,
    archived: bool,
) {
    let connection = Connection::open(path).expect("state database should open");
    connection
        .execute(
            "INSERT INTO threads (
                id,
                rollout_path,
                updated_at,
                source,
                cwd,
                archived
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                session_id,
                rollout_path.display().to_string(),
                updated_at,
                source,
                workspace_path.display().to_string(),
                if archived { 1_i64 } else { 0_i64 },
            ),
        )
        .expect("thread row should be inserted");
}

pub(crate) fn insert_thread_spawn_edge(path: &Path, parent_thread_id: &str, child_thread_id: &str) {
    let connection = Connection::open(path).expect("state database should open");
    connection
        .execute(
            "INSERT INTO thread_spawn_edges (
                parent_thread_id,
                child_thread_id,
                status
            ) VALUES (?1, ?2, 'closed')",
            (parent_thread_id, child_thread_id),
        )
        .expect("thread spawn edge should be inserted");
}

pub(crate) fn write_session_lines<I, S>(path: &Path, lines: I)
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("session parent dir should exist");
    }
    let contents = lines
        .into_iter()
        .map(|line| line.as_ref().to_owned())
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(path, contents).expect("session file should be written");
}

pub(crate) fn write_worker_subagent_session(
    path: &Path,
    session_id: &str,
    parent_thread_id: &str,
    nickname: &str,
    message: &str,
) {
    write_session_lines(
        path,
        [
            format!(
                r#"{{"timestamp":"2026-03-20T00:01:00.000Z","type":"session_meta","payload":{{"id":"{session_id}","source":{{"subagent":{{"thread_spawn":{{"parent_thread_id":"{parent_thread_id}","depth":1,"agent_nickname":"{nickname}","agent_role":"worker"}}}}}},"cwd":"/tmp/workspace","timestamp":"2026-03-20T00:01:00.000Z"}}}}"#
            ),
            r#"{"timestamp":"2026-03-20T00:01:01.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub"}}"#.to_owned(),
            r#"{"timestamp":"2026-03-20T00:01:01.100Z","type":"turn_context","payload":{"model":"gpt-5-mini","turn_id":"turn-sub"}}"#.to_owned(),
            format!(
                r#"{{"timestamp":"2026-03-20T00:01:02.000Z","type":"response_item","payload":{{"type":"message","role":"assistant","content":[{{"type":"output_text","text":"{message}"}}]}}}}"#
            ),
            r#"{"timestamp":"2026-03-20T00:01:03.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub","last_agent_message":"done"}}"#.to_owned(),
        ],
    );
}

pub(crate) fn write_late_subagent_resume_session(
    path: &Path,
    session_id: &str,
    forked_from_id: &str,
    parent_thread_id: &str,
    nickname: &str,
    child_message: &str,
) {
    write_session_lines(
        path,
        [
            r#"{"timestamp":"2026-03-18T09:12:02.000Z","type":"session_meta","payload":{"id":"parent-001","source":"vscode","cwd":"/tmp/test","timestamp":"2026-03-18T09:12:02.000Z"}}"#.to_owned(),
            r#"{"timestamp":"2026-03-18T09:12:03.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p1"}}"#.to_owned(),
            r#"{"timestamp":"2026-03-18T09:12:04.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Parent prelude"}]}}"#.to_owned(),
            format!(
                r#"{{"timestamp":"2026-03-18T09:14:09.000Z","type":"session_meta","payload":{{"id":"{session_id}","forked_from_id":"{forked_from_id}","source":{{"subagent":{{"thread_spawn":{{"parent_thread_id":"{parent_thread_id}","depth":1,"agent_nickname":"{nickname}","agent_role":"explorer"}}}}}},"cwd":"/tmp/test","timestamp":"2026-03-18T09:14:09.000Z"}}}}"#
            ),
            r#"{"timestamp":"2026-03-18T09:14:10.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-sub-1"}}"#.to_owned(),
            format!(
                r#"{{"timestamp":"2026-03-18T09:14:11.000Z","type":"response_item","payload":{{"type":"message","role":"assistant","content":[{{"type":"output_text","text":"{child_message}"}}]}}}}"#
            ),
            r#"{"timestamp":"2026-03-18T09:14:30.000Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-sub-1","last_agent_message":"done"}}"#.to_owned(),
            r#"{"timestamp":"2026-03-18T09:15:00.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-p2"}}"#.to_owned(),
            r#"{"timestamp":"2026-03-18T09:15:05.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Parent resumed"}]}}"#.to_owned(),
        ],
    );
}

pub(crate) fn create_git_workspace(path: &Path) {
    fs::create_dir_all(path.join(".git")).expect("workspace git dir should exist");
}

pub(crate) fn create_linked_worktree(
    origin_repo_path: &Path,
    worktree_repo_path: &Path,
    name: &str,
) {
    let worktree_git_dir = origin_repo_path.join(".git/worktrees").join(name);

    fs::create_dir_all(origin_repo_path.join(".git")).expect("origin git dir should exist");
    fs::create_dir_all(&worktree_git_dir).expect("worktree git dir should exist");
    fs::create_dir_all(worktree_repo_path).expect("worktree repo should exist");
    fs::write(
        worktree_repo_path.join(".git"),
        format!("gitdir: {}\n", worktree_git_dir.display()),
    )
    .expect("gitdir file should be written");
    fs::write(worktree_git_dir.join("commondir"), "../..\n")
        .expect("commondir file should be written");
}

pub(crate) fn session_meta_line(session_id: &str, workspace_path: &Path) -> String {
    session_meta_line_with_source(session_id, workspace_path, "desktop")
}

pub(crate) fn session_meta_line_with_source(
    session_id: &str,
    workspace_path: &Path,
    source: &str,
) -> String {
    session_meta_line_with_source_and_fork(session_id, workspace_path, source, None)
}

pub(crate) fn session_meta_line_with_fork(
    session_id: &str,
    workspace_path: &Path,
    forked_from_id: Option<&str>,
) -> String {
    session_meta_line_with_source_and_fork(session_id, workspace_path, "desktop", forked_from_id)
}

pub(crate) fn session_meta_line_with_source_and_fork(
    session_id: &str,
    workspace_path: &Path,
    source: &str,
    forked_from_id: Option<&str>,
) -> String {
    let forked_from = forked_from_id
        .map(|value| format!(r#","forked_from_id":"{value}""#))
        .unwrap_or_default();

    format!(
        r#"{{"timestamp":"2026-03-20T00:00:00.000Z","type":"session_meta","payload":{{"id":"{session_id}"{forked_from},"source":"{source}","cwd":"{}","timestamp":"2026-03-20T00:00:00.000Z"}}}}"#,
        workspace_path.display()
    )
}
