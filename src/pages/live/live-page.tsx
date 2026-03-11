import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { SessionWorkspaceShell } from "@/features/session-browser/ui/session-workspace-shell";
import { listLiveThreads } from "@/shared/lib/tauri/commands";
import { Button } from "@/shared/ui/button";

export function LivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const setSelectedThreadId = useThreadUiStore(
    (state) => state.setSelectedThreadId,
  );
  const liveQuery = useQuery({
    queryKey: ["monitor", "live_threads"],
    queryFn: listLiveThreads,
    refetchInterval: 2_000,
  });

  const workspaces = useMemo(() => {
    return [...new Set((liveQuery.data ?? []).map((thread) => thread.cwd))].sort();
  }, [liveQuery.data]);
  const activeWorkspace = searchParams.get("workspace");
  const filteredThreads = useMemo(() => {
    if (!activeWorkspace) {
      return liveQuery.data ?? [];
    }
    return (liveQuery.data ?? []).filter((thread) => thread.cwd === activeWorkspace);
  }, [activeWorkspace, liveQuery.data]);
  const selectedSession =
    filteredThreads.find((thread) => thread.thread_id === sessionId) ?? null;

  useEffect(() => {
    setSelectedThreadId(sessionId ?? null);
    return () => setSelectedThreadId(null);
  }, [sessionId, setSelectedThreadId]);

  return (
    <SessionWorkspaceShell
      eyebrow="Live"
      title="현재 진행 중인 챗"
      description="route IA skeleton 단계입니다. 다음 slice에서 session list와 flow workspace를 이 shell에 그대로 결합합니다."
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
            All live sessions
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
            <p className="text-sm font-medium">Current sessions</p>
            <span className="text-xs text-[hsl(var(--muted))]">
              {filteredThreads.length} items
            </span>
          </div>
          {liveQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] p-4 text-sm text-[hsl(var(--muted))]">
              live sessions loading...
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredThreads.map((thread) => (
                <li key={thread.thread_id}>
                  <Link
                    className="block rounded-2xl border border-[hsl(var(--line))] px-3 py-3 text-sm hover:border-[hsl(var(--line-strong))]"
                    to={`/live/${thread.thread_id}${activeWorkspace ? `?workspace=${encodeURIComponent(activeWorkspace)}` : ""}`}
                  >
                    <div className="font-medium">{thread.title}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      {thread.cwd}
                    </div>
                  </Link>
                </li>
              ))}
              {!filteredThreads.length ? (
                <li className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] px-3 py-4 text-sm text-[hsl(var(--muted))]">
                  No live session matches this workspace.
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
              Session workspace
            </p>
            <h3 className="text-base font-semibold">{selectedSession.title}</h3>
            <p className="text-sm text-[hsl(var(--muted))]">
              `session flow` diagram과 inspector는 다음 slice에서 이 영역에 들어온다.
            </p>
            <dl className="grid gap-2 text-sm">
              <div className="rounded-xl border border-[hsl(var(--line))] px-3 py-2">
                <dt className="text-[hsl(var(--muted))]">session id</dt>
                <dd className="font-mono">{selectedSession.thread_id}</dd>
              </div>
              <div className="rounded-xl border border-[hsl(var(--line))] px-3 py-2">
                <dt className="text-[hsl(var(--muted))]">workspace</dt>
                <dd>{selectedSession.cwd}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
            live session을 선택하면 같은 shell 안에서 flow workspace가 열린다.
          </div>
        )
      }
    />
  );
}
