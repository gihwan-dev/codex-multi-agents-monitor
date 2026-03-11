import { useSessionBrowserPage } from "@/features/session-browser/lib/use-session-browser-page";
import { SessionListCard } from "@/features/session-browser/ui/session-list-card";
import { SessionWorkspaceShell } from "@/features/session-browser/ui/session-workspace-shell";
import { SessionFlowWorkspace } from "@/features/session-flow/ui/session-flow-workspace";
import { Button } from "@/shared/ui/button";

export function LivePage() {
  const {
    activeWorkspace,
    sessionId,
    sessionListQuery,
    selectedSession,
    workspaces,
    selectWorkspace,
  } = useSessionBrowserPage("live");

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
            onClick={() => selectWorkspace(null)}
          >
            All live sessions
          </Button>
          {workspaces.map((workspace) => (
            <Button
              key={workspace}
              size="sm"
              variant={workspace === activeWorkspace ? "solid" : "ghost"}
              className="w-full justify-start"
              onClick={() => selectWorkspace(workspace)}
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
              {sessionListQuery.data?.sessions.length ?? 0} sessions
            </span>
          </div>
          {sessionListQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] p-4 text-sm text-[hsl(var(--muted))]">
              live sessions loading...
            </div>
          ) : (
            <ul className="space-y-2">
              {(sessionListQuery.data?.sessions ?? []).map((session) => (
                <li key={session.session_id}>
                  <SessionListCard
                    scope="live"
                    session={session}
                    isSelected={session.session_id === sessionId}
                    activeWorkspace={activeWorkspace}
                  />
                </li>
              ))}
              {!sessionListQuery.data?.sessions.length ? (
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
          <SessionFlowWorkspace sessionId={selectedSession.session_id} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
            live session을 선택하면 같은 shell 안에서 flow workspace가 열린다.
          </div>
        )
      }
    />
  );
}
