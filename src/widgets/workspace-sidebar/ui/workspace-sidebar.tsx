import { GlassSurface } from "@/app/ui";
import { HardDrive, Layers3 } from "lucide-react";

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
    <Sidebar className="bg-transparent">
      <GlassSurface
        className="mx-3 my-4 h-[calc(100svh-2rem)] rounded-[2rem]"
        refraction="none"
        variant="sidebar"
      >
        <SidebarHeader className="px-4 pb-3 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-emerald-300/90">
                  Codex Monitor
                </p>
                <p className="mt-1 text-sm text-slate-100">Live Sessions</p>
              </div>
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Layers3 className="h-3.5 w-3.5 text-sky-300" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-100">
                    {snapshot ? snapshot.workspaces.length : 0} workspaces
                  </span>
                </div>
              </GlassSurface>
            </div>

            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-[11px] leading-relaxed text-slate-300/78">
                One shared backdrop, no shell split. Sessions, timeline, and detail
                all float on the same diagnostic field.
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-transparent px-3 pb-4 pt-1">
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
                <SidebarGroup key={workspace.workspace_path} className="px-0 py-2">
                  <SidebarGroupLabel className="px-2 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-400/80">
                    {formatWorkspaceLabel(workspace.workspace_path)}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="mt-2 gap-2 px-0">
                      {workspace.sessions.map((session) => {
                        const isSelected = session.session_id === selectedSessionId;

                        return (
                          <SidebarMenuItem key={session.session_id}>
                            <SidebarMenuButton
                              isActive={isSelected}
                              onClick={() => onSelectSession(session.session_id)}
                              className={`h-auto cursor-pointer flex-col items-start rounded-[1.4rem] border px-3.5 py-3.5 transition-all duration-200 ${
                                isSelected
                                  ? "border-white/14 bg-white/[0.11] shadow-[0_18px_36px_rgba(2,6,23,0.2),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_0_0_1px_rgba(16,185,129,0.22)]"
                                  : "border-white/6 bg-white/[0.04] hover:border-white/12 hover:bg-white/[0.08]"
                              }`}
                            >
                              <div className="mb-2 flex w-full items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <span
                                    className={`block truncate text-sm font-medium ${
                                      isSelected ? "text-white" : "text-slate-200"
                                    }`}
                                  >
                                    {session.title ?? "Untitled session"}
                                  </span>
                                  <span className="mt-1 block text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">
                                    {session.source_kind === "archive_log"
                                      ? "archive replay"
                                      : "live monitor"}
                                  </span>
                                </div>
                                <GlassSurface
                                  className="rounded-full"
                                  refraction="none"
                                  variant="control"
                                >
                                  <div className="px-2.5 py-1 font-mono text-[10px] text-slate-100">
                                    {formatTime(session.last_event_at)}
                                  </div>
                                </GlassSurface>
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
