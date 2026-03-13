import { GlassSurface } from "@/app/ui";
import { HardDrive } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  formatSessionDisplayTitle,
  formatTime,
  formatWorkspaceLabel,
  SessionBadges,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";

const SESSION_TITLE_CLASS =
  "block pr-1 text-[12.5px] font-medium leading-[1.24] [display:-webkit-box] break-words overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
const SIDEBAR_SURFACE_CLASS =
  "mx-1.5 my-2 h-[calc(100svh-1rem)] rounded-[1.6rem] xl:mx-2.5 xl:my-3 xl:h-[calc(100svh-1.5rem)] xl:rounded-[1.75rem]";

interface WorkspaceSidebarProps {
  loading: boolean;
  onSelectSession: (sessionId: string) => void;
  selectedSessionId: string | null;
  snapshot: WorkspaceSessionsSnapshot | null;
}

export function WorkspaceSidebar({
  loading,
  onSelectSession,
  selectedSessionId,
  snapshot,
}: WorkspaceSidebarProps) {
  const { isMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sidebar className="bg-transparent">
        <WorkspaceSidebarBody
          loading={loading}
          onSelectSession={onSelectSession}
          selectedSessionId={selectedSessionId}
          snapshot={snapshot}
        />
        <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <WorkspaceSidebarBody
      loading={loading}
      onSelectSession={onSelectSession}
      selectedSessionId={selectedSessionId}
      snapshot={snapshot}
    />
  );
}

function WorkspaceSidebarBody({
  loading,
  onSelectSession,
  selectedSessionId,
  snapshot,
}: WorkspaceSidebarProps) {
  const workspaceCount = snapshot?.workspaces.length ?? 0;
  const sessionCount =
    snapshot?.workspaces.reduce((total, workspace) => total + workspace.sessions.length, 0) ?? 0;
  const liveCount =
    snapshot?.workspaces.reduce(
      (total, workspace) =>
        total + workspace.sessions.filter((session) => session.status === "live").length,
      0,
    ) ?? 0;
  const stalledCount =
    snapshot?.workspaces.reduce(
      (total, workspace) =>
        total + workspace.sessions.filter((session) => session.status === "stalled").length,
      0,
    ) ?? 0;
  const summaryParts = [
    liveCount > 0 ? `${liveCount} live` : null,
    stalledCount > 0 ? `${stalledCount} stalled` : null,
  ].filter(Boolean);
  const sessionSummary =
    summaryParts.length > 0
      ? summaryParts.join(", ")
      : sessionCount > 0
        ? "No live sessions"
        : "No sessions";

  return (
    <GlassSurface
      className={SIDEBAR_SURFACE_CLASS}
      refraction="none"
      variant="sidebar"
    >
      <SidebarHeader className="px-2.5 pb-0 pt-2.25">
        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-medium tracking-[-0.01em] text-slate-100/78">
                Sessions
              </p>
              <p className="mt-1 text-[11px] text-slate-500/86">{sessionSummary}</p>
            </div>
            <p className="text-[10px] text-slate-500/70">{workspaceCount} workspaces</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent px-1.5 pb-2 pt-0 no-scrollbar">
        {loading ? (
          <div className="space-y-4 px-1 py-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex animate-pulse flex-col gap-2.5">
                <div className="h-3 w-1/3 rounded-full bg-white/8" />
                <div className="h-20 rounded-[1.3rem] border border-white/8 bg-white/[0.05]" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && snapshot && snapshot.workspaces.length === 0 ? (
          <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-6 py-8 text-center text-slate-300/70">
            <HardDrive className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm">No Codex sessions discovered.</p>
          </div>
        ) : null}

        {!loading && snapshot
          ? snapshot.workspaces.map((workspace) => (
              <SidebarGroup key={workspace.workspace_path} className="px-0 py-1.5">
                <SidebarGroupLabel className="px-1.5 text-[10.5px] font-medium text-slate-500/70">
                  {formatWorkspaceLabel(workspace.workspace_path)}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="mt-1 gap-1 px-0">
                    {workspace.sessions.map((session) => {
                      const isSelected = session.session_id === selectedSessionId;
                      const titlePresentation = formatSessionDisplayTitle({
                        rawTitle: session.title,
                        workspacePath: session.workspace_path,
                      });

                      return (
                        <SidebarMenuItem key={session.session_id}>
                          <SidebarMenuButton
                            isActive={isSelected}
                            onClick={() => onSelectSession(session.session_id)}
                            title={titlePresentation.tooltip}
                            className={`h-auto cursor-pointer flex-col items-start rounded-[1.15rem] border px-2.5 py-2 transition-all duration-200 ${
                              isSelected
                                ? "border-white/12 bg-white/[0.06] shadow-[0_10px_18px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.12)]"
                                : "border-white/4 bg-white/[0.012] hover:border-white/7 hover:bg-white/[0.026]"
                            }`}
                          >
                            <div className="mb-1 flex w-full items-start gap-2">
                              <div className="min-w-0">
                                <span
                                  className={`${SESSION_TITLE_CLASS} ${
                                    isSelected ? "text-white" : "text-slate-200"
                                  }`}
                                >
                                  {titlePresentation.displayTitle}
                                </span>
                                <span className="mt-0.5 block text-[10.5px] text-slate-500/84">
                                  {session.source_kind === "archive_log"
                                    ? "Archive replay"
                                    : "Live monitor"}{" "}
                                  {session.last_event_at
                                    ? `· ${formatTime(session.last_event_at)}`
                                    : ""}
                                </span>
                              </div>
                            </div>
                            <SessionBadges session={session} />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          : null}
      </SidebarContent>
    </GlassSurface>
  );
}
