import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { SessionWorkspaceShell } from "@/features/session-browser/ui/session-workspace-shell";
import { SessionFlowWorkspace } from "@/features/session-flow/ui/session-flow-workspace";
import { listArchivedSessions } from "@/shared/lib/tauri/commands";
import { Button } from "@/shared/ui/button";

export function ArchivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const setSelectedThreadId = useThreadUiStore(
    (state) => state.setSelectedThreadId,
  );
  const activeWorkspace = searchParams.get("workspace");
  const archiveQuery = useQuery({
    queryKey: ["monitor", "archived_sessions", activeWorkspace],
    queryFn: () =>
      listArchivedSessions({
        workspace: activeWorkspace,
      }),
  });

  const selectedSession =
    archiveQuery.data?.sessions.find((session) => session.thread_id === sessionId) ??
    null;
  const workspaces = useMemo(
    () => archiveQuery.data?.workspaces ?? [],
    [archiveQuery.data],
  );

  useEffect(() => {
    setSelectedThreadId(sessionId ?? null);
    return () => setSelectedThreadId(null);
  }, [sessionId, setSelectedThreadId]);

  return (
    <SessionWorkspaceShell
      eyebrow="Archive"
      title="아카이브 챗 세션"
      description="workspace별로 archived root session을 탐색하고 같은 shell 안에서 flow workspace를 연다."
      sidebar={
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
            Workspace
          </p>
          <Button
            size="sm"
            variant={!activeWorkspace ? "solid" : "ghost"}
            className="w-full justify-start"
            onClick={() => setSearchParams({})}
          >
            All archived sessions
          </Button>
          {workspaces.map((workspace) => (
            <Button
              key={workspace}
              size="sm"
              variant={workspace === activeWorkspace ? "solid" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSearchParams({ workspace })}
            >
              {workspace}
            </Button>
          ))}
        </div>
      }
      listPane={
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Archived chat sessions</p>
            <span className="text-xs text-[hsl(var(--muted))]">
              {archiveQuery.data?.sessions.length ?? 0} sessions
            </span>
          </div>
          {archiveQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] p-4 text-sm text-[hsl(var(--muted))]">
              archived sessions loading...
            </div>
          ) : (
            <ul className="space-y-2">
              {(archiveQuery.data?.sessions ?? []).map((session) => (
                <li key={session.thread_id}>
                  <Link
                    className={`block rounded-2xl border px-3 py-3 text-sm transition-colors ${
                      session.thread_id === sessionId
                        ? "border-[hsl(var(--accent-strong))] bg-[hsl(var(--panel)/0.84)]"
                        : "border-[hsl(var(--line))] hover:border-[hsl(var(--line-strong))]"
                    }`}
                    to={`/archive/${session.thread_id}${activeWorkspace ? `?workspace=${encodeURIComponent(activeWorkspace)}` : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{session.title}</div>
                        <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                          {session.cwd}
                        </div>
                      </div>
                      <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[11px] text-[hsl(var(--muted))]">
                        {session.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                      {session.latest_activity_summary ?? "latest activity summary 없음"}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[hsl(var(--muted))]">
                      <span>{session.agent_roles.join(", ") || "role 없음"}</span>
                      <span>{session.rollout_path ?? "rollout 없음"}</span>
                    </div>
                  </Link>
                </li>
              ))}
              {!(archiveQuery.data?.sessions.length ?? 0) ? (
                <li className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] px-3 py-4 text-sm text-[hsl(var(--muted))]">
                  No archived session matches this workspace.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      }
      detailPane={
        selectedSession ? (
          <SessionFlowWorkspace sessionId={selectedSession.thread_id} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
            archive session을 선택하면 이 shell 안에서 flow workspace가 열린다.
          </div>
        )
      }
    />
  );
}
