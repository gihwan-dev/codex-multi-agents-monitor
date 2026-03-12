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
    <Sidebar className="border-r-0 bg-transparent">
      <GlassSurface className="h-full rounded-none" refraction="none" variant="sidebar">
        <SidebarHeader className="border-b border-white/10 bg-white/[0.03] px-4 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-400">
              Codex Monitor
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">Live Sessions</span>
              <Badge
                variant="secondary"
                className="border-0 bg-white/80 px-2.5 text-[10px] font-mono text-slate-900 shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
              >
                {snapshot ? snapshot.workspaces.length : 0} WS
              </Badge>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-transparent/0 px-2 py-3">
          {loading ? (
            <div className="space-y-4 px-2 py-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse flex-col gap-2">
                  <div className="h-4 w-1/3 rounded bg-white/8" />
                  <div className="h-16 w-full rounded-xl border border-white/8 bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && snapshot && snapshot.workspaces.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-300/70">
              <HardDrive className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p className="text-sm">No Codex sessions discovered.</p>
            </div>
          ) : null}

          {!loading && snapshot
            ? snapshot.workspaces.map((workspace) => (
                <SidebarGroup key={workspace.workspace_path} className="px-1 py-1">
                  <SidebarGroupLabel className="px-2 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-400/90">
                    {formatWorkspaceLabel(workspace.workspace_path)}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="mt-2 px-1">
                      {workspace.sessions.map((session) => {
                        const isSelected = session.session_id === selectedSessionId;

                        return (
                          <SidebarMenuItem key={session.session_id} className="mb-1.5">
                            <SidebarMenuButton
                              isActive={isSelected}
                              onClick={() => onSelectSession(session.session_id)}
                              className={`h-auto cursor-pointer flex-col items-start rounded-xl border px-3 py-3 transition-all duration-200 ${
                                isSelected
                                  ? "border-white/16 bg-white/[0.09] shadow-[0_18px_32px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_0_0_1px_rgba(16,185,129,0.22)]"
                                  : "border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"
                              }`}
                            >
                              <div className="mb-1.5 flex w-full items-start justify-between gap-3">
                                <span
                                  className={`truncate pr-2 text-sm font-medium ${
                                    isSelected ? "text-slate-50" : "text-slate-200"
                                  }`}
                                >
                                  {session.title ?? "Untitled session"}
                                </span>
                                <span
                                  className={`mt-0.5 shrink-0 text-[10px] font-mono ${
                                    isSelected ? "text-emerald-200/90" : "text-slate-500"
                                  }`}
                                >
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
