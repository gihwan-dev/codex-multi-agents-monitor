import { GlassSurface } from "@/app/ui";
import { HardDrive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/sidebar";
import {
  formatTime,
  formatWorkspaceLabel,
  SessionBadges,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";

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
  return (
    <Sidebar className="border-r-0 bg-transparent p-4 hidden md:flex">
      <GlassSurface
        className="h-[calc(100vh-2rem)] rounded-3xl border border-border shadow-md overflow-hidden"
        refraction="none"
        variant="chrome"
      >
        <SidebarHeader className="border-b border-border bg-transparent p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Codex Monitor
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Live Sessions</span>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {snapshot ? snapshot.workspaces.length : 0} WS
              </Badge>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-transparent/0">
          {loading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse flex-col gap-2">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-16 w-full rounded-xl bg-muted" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && snapshot && snapshot.workspaces.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <HardDrive className="mx-auto mb-3 h-8 w-8 opacity-20" />
              <p className="text-sm">No Codex sessions discovered.</p>
            </div>
          ) : null}

          {!loading && snapshot
            ? snapshot.workspaces.map((workspace) => (
                <SidebarGroup key={workspace.workspace_path}>
                  <SidebarGroupLabel className="text-xs font-mono tracking-wider text-slate-400">
                    {formatWorkspaceLabel(workspace.workspace_path)}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="mt-1 px-2">
                      {workspace.sessions.map((session) => {
                        const isSelected = session.session_id === selectedSessionId;

                        return (
                          <SidebarMenuItem key={session.session_id} className="mb-1.5">
                            <SidebarMenuButton
                              isActive={isSelected}
                              onClick={() => onSelectSession(session.session_id)}
                              className={`h-auto flex-col items-start rounded-xl border p-3 transition-all duration-200 ${
                                isSelected
                                  ? "border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10 shadow-[inset_2px_0_0_0_rgb(16,185,129)]"
                                  : "border-transparent bg-transparent hover:bg-muted"
                              }`}
                            >
                              <div className="mb-1 flex w-full items-start justify-between">
                                <span
                                  className={`truncate pr-2 text-sm font-medium ${
                                    isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                                  }`}
                                >
                                  {session.title ?? "Untitled session"}
                                </span>
                                <span className="mt-0.5 shrink-0 text-[10px] font-mono text-slate-500">
                                  {formatTime(session.last_event_at)}
                                </span>
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
      <SidebarRail />
    </Sidebar>
  );
}
