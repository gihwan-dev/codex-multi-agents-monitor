import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  LiveSessionUpdate,
  SessionSummary,
  WorkspaceSessionGroup,
  WorkspaceSessionsSnapshot,
} from "./shared/queries";

type ActiveTab = "live" | "archive" | "dashboard";

const LIVE_SESSION_UPDATED_EVENT = "codex://live-session-updated";

const TAB_COPY: Record<
  Exclude<ActiveTab, "live">,
  { eyebrow: string; title: string; body: string }
> = {
  archive: {
    eyebrow: "SLICE-6",
    title: "Archive Monitor is staged next.",
    body:
      "Filter rails, dense results, and detail replay stay deferred until the archive slice lands.",
  },
  dashboard: {
    eyebrow: "SLICE-7",
    title: "Dashboard metrics are not wired yet.",
    body:
      "The shell reserves the KPI and anomaly surface, but metric aggregation and drill-down remain future work.",
  },
};

function isTauriRuntimeAvailable() {
  const runtime = globalThis as typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return runtime.__TAURI__ !== undefined || runtime.__TAURI_INTERNALS__ !== undefined;
}

function compareSessionSummary(left: SessionSummary, right: SessionSummary) {
  const leftTimestamp = left.last_event_at ?? "";
  const rightTimestamp = right.last_event_at ?? "";

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }

  return left.session_id.localeCompare(right.session_id);
}

function sortWorkspaceGroup(group: WorkspaceSessionGroup): WorkspaceSessionGroup {
  return {
    ...group,
    sessions: [...group.sessions].sort(compareSessionSummary),
  };
}

function sortSnapshot(
  snapshot: WorkspaceSessionsSnapshot,
): WorkspaceSessionsSnapshot {
  return {
    refreshed_at: snapshot.refreshed_at,
    workspaces: [...snapshot.workspaces]
      .map(sortWorkspaceGroup)
      .sort((left, right) => left.workspace_path.localeCompare(right.workspace_path)),
  };
}

function upsertSessionSummary(
  current: WorkspaceSessionsSnapshot | null,
  summary: SessionSummary,
  refreshedAt: string,
) {
  const seed = current ?? { refreshed_at: refreshedAt, workspaces: [] };
  const stripped = seed.workspaces
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => session.session_id !== summary.session_id),
    }))
    .filter(
      (group) => group.sessions.length > 0 || group.workspace_path === summary.workspace_path,
    );
  const targetIndex = stripped.findIndex(
    (group) => group.workspace_path === summary.workspace_path,
  );

  if (targetIndex >= 0) {
    stripped[targetIndex] = {
      ...stripped[targetIndex],
      sessions: [...stripped[targetIndex].sessions, summary],
    };
  } else {
    stripped.push({
      workspace_path: summary.workspace_path,
      sessions: [summary],
    });
  }

  return sortSnapshot({
    refreshed_at: refreshedAt,
    workspaces: stripped,
  });
}

function upsertLiveSummary(
  current: WorkspaceSessionsSnapshot | null,
  update: LiveSessionUpdate,
) {
  return upsertSessionSummary(current, update.summary, update.refreshed_at);
}

function mergeBootstrapSnapshot(
  bootstrapSnapshot: WorkspaceSessionsSnapshot,
  liveSnapshot: WorkspaceSessionsSnapshot | null,
) {
  let merged = sortSnapshot(bootstrapSnapshot);

  if (!liveSnapshot) {
    return merged;
  }

  for (const workspace of liveSnapshot.workspaces) {
    for (const session of workspace.sessions) {
      merged = upsertSessionSummary(merged, session, liveSnapshot.refreshed_at);
    }
  }

  return merged;
}

function firstSessionId(snapshot: WorkspaceSessionsSnapshot | null) {
  return snapshot?.workspaces[0]?.sessions[0]?.session_id ?? null;
}

function findSelectedSession(
  snapshot: WorkspaceSessionsSnapshot | null,
  sessionId: string | null,
) {
  if (!snapshot || !sessionId) {
    return null;
  }

  for (const workspace of snapshot.workspaces) {
    for (const session of workspace.sessions) {
      if (session.session_id === sessionId) {
        return session;
      }
    }
  }

  return null;
}

function formatWorkspaceLabel(workspacePath: string) {
  const segments = workspacePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? workspacePath;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatRuntimeError(prefix: string, error: unknown) {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return `${prefix}: ${error}`;
  }

  return prefix;
}

function statusTone(status: SessionSummary["status"]) {
  switch (status) {
    case "live":
      return "status-live";
    case "stalled":
      return "status-stalled";
    case "aborted":
      return "status-aborted";
    case "completed":
      return "status-completed";
    case "archived":
      return "status-archived";
    default:
      return "status-default";
  }
}

function SessionBadges({ session }: { session: SessionSummary }) {
  return (
    <div className="session-badges" aria-label="session badges">
      <span className={`status-pill ${statusTone(session.status)}`}>
        {session.status}
      </span>
      <span className="status-pill status-muted">
        {session.is_archived ? "archived" : "active"}
      </span>
      <span className="status-pill status-muted">{session.event_count} events</span>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="sidebar-skeleton" aria-hidden="true">
      <div className="skeleton-row" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-row" />
      <div className="skeleton-card" />
    </div>
  );
}

function PlaceholderPanel({ tab }: { tab: Exclude<ActiveTab, "live"> }) {
  const copy = TAB_COPY[tab];

  return (
    <section className="placeholder-panel surface">
      <p className="panel-eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
    </section>
  );
}

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("live");
  const [snapshot, setSnapshot] = useState<WorkspaceSessionsSnapshot | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const snapshotRef = useRef<WorkspaceSessionsSnapshot | null>(null);

  const selectedSession = findSelectedSession(snapshot, selectedSessionId);

  const handleLiveUpdate = useEffectEvent((update: LiveSessionUpdate) => {
    startTransition(() => {
      setSnapshot((current) => {
        const nextSnapshot = upsertLiveSummary(current, update);
        snapshotRef.current = nextSnapshot;
        return nextSnapshot;
      });
      setSelectedSessionId((current) => current ?? update.summary.session_id);
    });
  });

  useEffect(() => {
    if (!isTauriRuntimeAvailable()) {
      setLoading(false);
      setErrorMessage("Tauri runtime unavailable. Launch the app with `pnpm tauri:dev`.");
      return;
    }

    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    async function bootstrap() {
      try {
        const nextUnlisten = await listen<LiveSessionUpdate>(
          LIVE_SESSION_UPDATED_EVENT,
          (event) => {
            handleLiveUpdate(event.payload);
          },
        );

        if (cancelled) {
          void nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      } catch (error) {
        if (!cancelled) {
          setDegradedMessage(
            formatRuntimeError("Live update subscription unavailable", error),
          );
        }
      }

      const [snapshotResult, bridgeResult] = await Promise.allSettled([
        invoke<WorkspaceSessionsSnapshot>("query_workspace_sessions"),
        invoke("start_live_bridge"),
      ]);

      if (cancelled) {
        return;
      }

      if (snapshotResult.status === "fulfilled") {
        const nextSnapshot = mergeBootstrapSnapshot(
          snapshotResult.value,
          snapshotRef.current,
        );
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        setSelectedSessionId((current) => current ?? firstSessionId(nextSnapshot));
        setErrorMessage(null);
      } else {
        setErrorMessage(
          formatRuntimeError(
            "Failed to load workspace snapshot",
            snapshotResult.reason,
          ),
        );
      }

      if (bridgeResult.status === "rejected") {
        setDegradedMessage(
          formatRuntimeError("Live bridge unavailable", bridgeResult.reason),
        );
      }

      setLoading(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [handleLiveUpdate]);

  return (
    <main className="monitor-shell">
      <header className="topbar surface">
        <div>
          <p className="eyebrow">Codex Multi-Agent Monitor</p>
          <h1>Observe live workspaces before the renderer lands.</h1>
        </div>
        <div className="topbar-meta">
          <span className="status-pill status-muted">
            {snapshot?.refreshed_at
              ? `Refreshed ${formatTimestamp(snapshot.refreshed_at)}`
              : "Snapshot pending"}
          </span>
          {degradedMessage ? (
            <span className="status-pill status-warning">Degraded</span>
          ) : null}
        </div>
      </header>

      <div className="tab-strip" role="tablist" aria-label="monitor views">
        {(["live", "archive", "dashboard"] as const).map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? "is-active" : ""}`}
            role="tab"
            aria-selected={activeTab === tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {degradedMessage ? (
        <div className="banner banner-warning" role="status">
          <strong>Live updates degraded.</strong> {degradedMessage}
        </div>
      ) : null}

      {errorMessage && !snapshot ? (
        <div className="banner banner-danger" role="alert">
          <strong>Shell fallback.</strong> {errorMessage}
        </div>
      ) : null}

      <div className="workspace-layout">
        <aside className="workspace-sidebar surface">
          <div className="sidebar-header">
            <div>
              <p className="panel-eyebrow">Workspace sidebar</p>
              <h2>Grouped live sessions</h2>
            </div>
            <span className="status-pill status-muted">
              {snapshot
                ? `${snapshot.workspaces.length} workspace${
                    snapshot.workspaces.length === 1 ? "" : "s"
                  }`
                : "Awaiting snapshot"}
            </span>
          </div>

          {loading ? <WorkspaceSkeleton /> : null}

          {!loading && snapshot && snapshot.workspaces.length === 0 ? (
            <div className="sidebar-empty">
              <p className="panel-eyebrow">Empty state</p>
              <h3>No Codex sessions discovered.</h3>
              <p>Start a live session or archive a sample log to populate this sidebar.</p>
            </div>
          ) : null}

          {!loading && snapshot
            ? snapshot.workspaces.map((workspace) => (
                <section
                  key={workspace.workspace_path}
                  className="workspace-group"
                  aria-labelledby={`workspace-${workspace.workspace_path}`}
                >
                  <div className="workspace-group-header">
                    <div>
                      <h3 id={`workspace-${workspace.workspace_path}`}>
                        {formatWorkspaceLabel(workspace.workspace_path)}
                      </h3>
                      <p>{workspace.workspace_path}</p>
                    </div>
                    <span className="status-pill status-muted">
                      {workspace.sessions.length}
                    </span>
                  </div>

                  <div className="session-list">
                    {workspace.sessions.map((session) => {
                      const isSelected = session.session_id === selectedSessionId;
                      return (
                        <button
                          key={session.session_id}
                          type="button"
                          className={`session-card ${isSelected ? "is-selected" : ""}`}
                          onClick={() => setSelectedSessionId(session.session_id)}
                        >
                          <div className="session-card-header">
                            <strong>{session.title ?? "Untitled session"}</strong>
                            <span className="session-time">
                              {formatTimestamp(session.last_event_at)}
                            </span>
                          </div>
                          <SessionBadges session={session} />
                          <p className="session-meta">
                            Started {formatTimestamp(session.started_at)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            : null}
        </aside>

        <section className="workspace-main">
          {activeTab === "live" ? (
            <>
              <section className="summary-grid">
                <article className="surface summary-card">
                  <p className="panel-eyebrow">Selected session</p>
                  {selectedSession ? (
                    <>
                      <h2>{selectedSession.title ?? "Untitled session"}</h2>
                      <p className="summary-copy">
                        Workspace {formatWorkspaceLabel(selectedSession.workspace_path)} is
                        staged for timeline wiring. The shell keeps summary-level
                        selection only until `SLICE-5`.
                      </p>
                      <dl className="session-facts">
                        <div>
                          <dt>Status</dt>
                          <dd>{selectedSession.status}</dd>
                        </div>
                        <div>
                          <dt>Last event</dt>
                          <dd>{formatTimestamp(selectedSession.last_event_at)}</dd>
                        </div>
                        <div>
                          <dt>Events</dt>
                          <dd>{selectedSession.event_count}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{selectedSession.source_kind}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <>
                      <h2>No session selected.</h2>
                      <p className="summary-copy">
                        Choose a session from the sidebar once discovery returns data.
                      </p>
                    </>
                  )}
                </article>

                <article className="surface summary-card">
                  <p className="panel-eyebrow">Shell status</p>
                  <h2>{loading ? "Scanning local Codex logs" : "Live shell is ready"}</h2>
                  <p className="summary-copy">
                    Sidebar grouping and summary selection are active. Timeline detail,
                    archive filters, and dashboard metrics remain deferred to later
                    slices.
                  </p>
                </article>
              </section>

              <section className="canvas-placeholder surface">
                <div className="placeholder-heading">
                  <div>
                    <p className="panel-eyebrow">Timeline canvas</p>
                    <h2>Renderer placeholder</h2>
                  </div>
                  <span className="status-pill status-muted">SLICE-5</span>
                </div>
                <div className="lane-preview" aria-hidden="true">
                  <div className="lane-row">
                    <span>User</span>
                    <div className="lane-bar lane-bar-user" />
                  </div>
                  <div className="lane-row">
                    <span>Main</span>
                    <div className="lane-bar lane-bar-main" />
                  </div>
                  <div className="lane-row">
                    <span>Sub-agent</span>
                    <div className="lane-bar lane-bar-agent" />
                  </div>
                </div>
              </section>

              <section className="drawer-placeholder surface">
                <div className="placeholder-heading">
                  <div>
                    <p className="panel-eyebrow">Detail drawer</p>
                    <h2>Summary-first shell boundary</h2>
                  </div>
                  <span className="status-pill status-muted">Deferred</span>
                </div>
                <p>
                  Tabs for raw payloads, tokens, and related metrics are intentionally
                  stubbed here so the shell layout stays stable when detail queries are
                  wired in the next slice.
                </p>
                <div className="drawer-chip-row" aria-hidden="true">
                  <span className="drawer-chip">Summary</span>
                  <span className="drawer-chip">Input / Output</span>
                  <span className="drawer-chip">Raw event</span>
                  <span className="drawer-chip">Tokens</span>
                </div>
              </section>
            </>
          ) : (
            <PlaceholderPanel tab={activeTab} />
          )}
        </section>
      </div>
    </main>
  );
}
