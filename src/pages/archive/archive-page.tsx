import { useSessionBrowserPage } from "@/features/session-browser/lib/use-session-browser-page";
import { SessionListCard } from "@/features/session-browser/ui/session-list-card";
import { SessionWorkspaceShell } from "@/features/session-browser/ui/session-workspace-shell";
import { SessionFlowWorkspace } from "@/features/session-flow/ui/session-flow-workspace";
import { Button } from "@/shared/ui/button";

export function ArchivePage() {
  const {
    activeWorkspace,
    sessionId,
    sessionListQuery,
    selectedSession,
    workspaces,
    selectWorkspace,
  } = useSessionBrowserPage("archive");

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
            onClick={() => selectWorkspace(null)}
          >
            All archived sessions
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
            <p className="text-sm font-medium">Archived chat sessions</p>
            <span className="text-xs text-[hsl(var(--muted))]">
              {sessionListQuery.data?.sessions.length ?? 0} sessions
            </span>
          </div>
          {sessionListQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] p-4 text-sm text-[hsl(var(--muted))]">
              archived sessions loading...
            </div>
          ) : (
            <ul className="space-y-2">
              {(sessionListQuery.data?.sessions ?? []).map((session) => (
                <li key={session.session_id}>
                  <SessionListCard
                    scope="archive"
                    session={session}
                    isSelected={session.session_id === sessionId}
                    activeWorkspace={activeWorkspace}
                  />
                </li>
              ))}
              {!sessionListQuery.data?.sessions.length ? (
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
          <SessionFlowWorkspace sessionId={selectedSession.session_id} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--line-strong))] text-sm text-[hsl(var(--muted))]">
            archive session을 선택하면 이 shell 안에서 flow workspace가 열린다.
          </div>
        )
      }
    />
  );
}
