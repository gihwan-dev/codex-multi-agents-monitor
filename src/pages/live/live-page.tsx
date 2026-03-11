import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { formatDuration } from "@/features/overview/lib/live-overview-formatters";
import { SessionWorkspaceShell } from "@/features/session-browser/ui/session-workspace-shell";
import { SessionFlowWorkspace } from "@/features/session-flow/ui/session-flow-workspace";
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
    return [
      ...new Set((liveQuery.data ?? []).map((thread) => thread.cwd)),
    ].sort();
  }, [liveQuery.data]);
  const activeWorkspace = searchParams.get("workspace");
  const filteredThreads = useMemo(() => {
    if (!activeWorkspace) {
      return liveQuery.data ?? [];
    }
    return (liveQuery.data ?? []).filter(
      (thread) => thread.cwd === activeWorkspace,
    );
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
      title="실시간 챗 세션"
      description="workspace sidebar, root session list, embedded flow workspace를 한 화면에서 유지한다."
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
            <p className="text-sm font-medium">Live chat sessions</p>
            <span className="text-xs text-[hsl(var(--muted))]">
              {filteredThreads.length} sessions
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
                    className={`block rounded-2xl border px-3 py-3 text-sm transition-colors ${
                      thread.thread_id === sessionId
                        ? "border-[hsl(var(--accent-strong))] bg-[hsl(var(--panel)/0.84)]"
                        : "border-[hsl(var(--line))] hover:border-[hsl(var(--line-strong))]"
                    }`}
                    to={`/live/${thread.thread_id}${activeWorkspace ? `?workspace=${encodeURIComponent(activeWorkspace)}` : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{thread.title}</div>
                        <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                          {thread.cwd}
                        </div>
                      </div>
                      <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[11px] text-[hsl(var(--muted))]">
                        {thread.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                      {thread.latest_activity_summary ??
                        "latest activity summary 없음"}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[hsl(var(--muted))]">
                      <span>
                        {thread.agent_roles.join(", ") || "role 없음"}
                      </span>
                      <span>
                        {thread.longest_wait_ms !== null
                          ? `wait ${formatDuration(thread.longest_wait_ms)}`
                          : "active wait 없음"}
                      </span>
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
          <SessionFlowWorkspace sessionId={selectedSession.thread_id} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
            live session을 선택하면 같은 shell 안에서 flow workspace가 열린다.
          </div>
        )
      }
    />
  );
}
