import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { SessionWorkspaceShell } from "@/features/session-browser/ui/session-workspace-shell";
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
      title="아카이브된 챗"
      description="archived root session browser skeleton입니다. 다음 slice에서 reusable flow workspace를 그대로 연결합니다."
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
            <p className="text-sm font-medium">Archived sessions</p>
            <span className="text-xs text-[hsl(var(--muted))]">
              {archiveQuery.data?.sessions.length ?? 0} items
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
                    className="block rounded-2xl border border-[hsl(var(--line))] px-3 py-3 text-sm hover:border-[hsl(var(--line-strong))]"
                    to={`/archive/${session.thread_id}${activeWorkspace ? `?workspace=${encodeURIComponent(activeWorkspace)}` : ""}`}
                  >
                    <div className="font-medium">{session.title}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      {session.cwd}
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
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              Archive inspector
            </p>
            <h3 className="text-base font-semibold">{selectedSession.title}</h3>
            <p className="text-sm text-[hsl(var(--muted))]">
              archive browser detail과 flow workspace는 다음 slice에서 결합된다.
            </p>
            <dl className="grid gap-2 text-sm">
              <div className="rounded-xl border border-[hsl(var(--line))] px-3 py-2">
                <dt className="text-[hsl(var(--muted))]">session id</dt>
                <dd className="font-mono">{selectedSession.thread_id}</dd>
              </div>
              <div className="rounded-xl border border-[hsl(var(--line))] px-3 py-2">
                <dt className="text-[hsl(var(--muted))]">rollout</dt>
                <dd>{selectedSession.rollout_path ?? "-"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
            archive session을 선택하면 이 shell 안에서 flow workspace가 열린다.
          </div>
        )
      }
    />
  );
}
