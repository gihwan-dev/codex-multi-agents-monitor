import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, Terminal, AlertCircle, HardDrive, Archive } from "lucide-react";

import type {
  LiveSessionUpdate,
  SessionSummary,
  WorkspaceSessionGroup,
  WorkspaceSessionsSnapshot,
} from "./shared/queries";

type ActiveTab = "live" | "archive" | "dashboard";

const LIVE_SESSION_UPDATED_EVENT = "codex://live-session-updated";

const TAB_COPY: Record<
  Exclude<ActiveTab, "live">,
  { eyebrow: string; title: string; body: string }
> = {
  archive: {
    eyebrow: "SLICE-6",
    title: "Archive Monitor is staged next.",
    body:
      "Filter rails, dense results, and detail replay stay deferred until the archive slice lands.",
  },
  dashboard: {
    eyebrow: "SLICE-7",
    title: "Dashboard metrics are not wired yet.",
    body:
      "The shell reserves the KPI and anomaly surface, but metric aggregation and drill-down remain future work.",
  },
};

function isTauriRuntimeAvailable() {
  const runtime = globalThis as typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return runtime.__TAURI__ !== undefined || runtime.__TAURI_INTERNALS__ !== undefined;
}

function compareSessionSummary(left: SessionSummary, right: SessionSummary) {
  const leftTimestamp = left.last_event_at ?? "";
  const rightTimestamp = right.last_event_at ?? "";

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }

  return left.session_id.localeCompare(right.session_id);
}

function sortWorkspaceGroup(group: WorkspaceSessionGroup): WorkspaceSessionGroup {
  return {
    ...group,
    sessions: [...group.sessions].sort(compareSessionSummary),
  };
}

function sortSnapshot(
  snapshot: WorkspaceSessionsSnapshot,
): WorkspaceSessionsSnapshot {
  return {
    refreshed_at: snapshot.refreshed_at,
    workspaces: [...snapshot.workspaces]
      .map(sortWorkspaceGroup)
      .sort((left, right) => left.workspace_path.localeCompare(right.workspace_path)),
  };
}

function upsertSessionSummary(
  current: WorkspaceSessionsSnapshot | null,
  summary: SessionSummary,
  refreshedAt: string,
) {
  const seed = current ?? { refreshed_at: refreshedAt, workspaces: [] };
  const stripped = seed.workspaces
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => session.session_id !== summary.session_id),
    }))
    .filter(
      (group) => group.sessions.length > 0 || group.workspace_path === summary.workspace_path,
    );
  const targetIndex = stripped.findIndex(
    (group) => group.workspace_path === summary.workspace_path,
  );

  if (targetIndex >= 0) {
    stripped[targetIndex] = {
      ...stripped[targetIndex],
      sessions: [...stripped[targetIndex].sessions, summary],
    };
  } else {
    stripped.push({
      workspace_path: summary.workspace_path,
      sessions: [summary],
    });
  }

  return sortSnapshot({
    refreshed_at: refreshedAt,
    workspaces: stripped,
  });
}

function upsertLiveSummary(
  current: WorkspaceSessionsSnapshot | null,
  update: LiveSessionUpdate,
) {
  return upsertSessionSummary(current, update.summary, update.refreshed_at);
}

function mergeBootstrapSnapshot(
  bootstrapSnapshot: WorkspaceSessionsSnapshot,
  liveSnapshot: WorkspaceSessionsSnapshot | null,
) {
  let merged = sortSnapshot(bootstrapSnapshot);

  if (!liveSnapshot) {
    return merged;
  }

  for (const workspace of liveSnapshot.workspaces) {
    for (const session of workspace.sessions) {
      merged = upsertSessionSummary(merged, session, liveSnapshot.refreshed_at);
    }
  }

  return merged;
}

function firstSessionId(snapshot: WorkspaceSessionsSnapshot | null) {
  return snapshot?.workspaces[0]?.sessions[0]?.session_id ?? null;
}

function findSelectedSession(
  snapshot: WorkspaceSessionsSnapshot | null,
  sessionId: string | null,
) {
  if (!snapshot || !sessionId) {
    return null;
  }

  for (const workspace of snapshot.workspaces) {
    for (const session of workspace.sessions) {
      if (session.session_id === sessionId) {
        return session;
      }
    }
  }

  return null;
}

function formatWorkspaceLabel(workspacePath: string) {
  const segments = workspacePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? workspacePath;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatRuntimeError(prefix: string, error: unknown) {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return `${prefix}: ${error}`;
  }

  return prefix;
}

function statusBadgeVariant(status: SessionSummary["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "live":
      return "default";
    case "stalled":
    case "aborted":
      return "destructive";
    case "completed":
    case "archived":
      return "secondary";
    default:
      return "outline";
  }
}

function SessionBadges({ session }: { session: SessionSummary }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1" aria-label="session badges">
      <Badge variant={statusBadgeVariant(session.status)} className="px-1.5 py-0 text-[10px] font-mono leading-tight">
        {session.status}
      </Badge>
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono leading-tight text-muted-foreground border-white/10">
        {session.is_archived ? "archived" : "active"}
      </Badge>
      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono leading-tight">
        {session.event_count} evts
      </Badge>
    </div>
  );
}

function PlaceholderPanel({ tab }: { tab: Exclude<ActiveTab, "live"> }) {
  const copy = TAB_COPY[tab];

  return (
    <div className="flex items-center justify-center p-8 h-full">
      <Card className="max-w-md w-full glass-surface">
        <CardHeader>
          <div className="flex items-center space-x-2 text-sm text-emerald-400 font-mono font-medium mb-2">
            <Archive className="w-4 h-4" />
            <span>{copy.eyebrow}</span>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription className="text-base text-slate-400">
            {copy.body}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function LiquidGlassFilter() {
  return (
    <svg width={0} height={0} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" version="2" style={{ display: 'none' }}>
      <defs>
        <filter id="liquidGlassFilter" filterUnits="userSpaceOnUse">
          <feTurbulence type="turbulence" baseFrequency="0.005" numOctaves="2" result="fractal" stitchTiles="stitch" />
          <feDisplacementMap in2="fractal" in="SourceGraphic" scale="25" result="turbDisplaced" />
          
          <feColorMatrix in="SourceGraphic" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feOffset dx="3" dy="0" in="red" result="shiftedRed" />
          
          <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feOffset dx="0" dy="2" in="green" result="shiftedGreen" />
          
          <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feOffset dx="-3" dy="0" in="blue" result="shiftedBlue" />
          
          <feBlend in="shiftedRed" in2="shiftedGreen" result="comp1" mode="screen" />
          <feBlend in="shiftedBlue" in2="comp1" result="comp2" mode="screen" />
          <feBlend in="SourceGraphic" in2="comp2" result="out" mode="lighten" />
        </filter>
      </defs>
    </svg>
  );
}

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("live");
  const [snapshot, setSnapshot] = useState<WorkspaceSessionsSnapshot | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const snapshotRef = useRef<WorkspaceSessionsSnapshot | null>(null);

  const selectedSession = findSelectedSession(snapshot, selectedSessionId);

  const handleLiveUpdate = useEffectEvent((update: LiveSessionUpdate) => {
    startTransition(() => {
      setSnapshot((current) => {
        const nextSnapshot = upsertLiveSummary(current, update);
        snapshotRef.current = nextSnapshot;
        return nextSnapshot;
      });
      setSelectedSessionId((current) => current ?? update.summary.session_id);
    });
  });

  useEffect(() => {
    if (!isTauriRuntimeAvailable()) {
      setLoading(false);
      setErrorMessage("Tauri runtime unavailable. Launch the app with `pnpm tauri:dev`.");
      return;
    }

    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    async function bootstrap() {
      try {
        const nextUnlisten = await listen<LiveSessionUpdate>(
          LIVE_SESSION_UPDATED_EVENT,
          (event) => {
            handleLiveUpdate(event.payload);
          },
        );

        if (cancelled) {
          void nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      } catch (error) {
        if (!cancelled) {
          setDegradedMessage(
            formatRuntimeError("Live update subscription unavailable", error),
          );
        }
      }

      const [snapshotResult, bridgeResult] = await Promise.allSettled([
        invoke<WorkspaceSessionsSnapshot>("query_workspace_sessions"),
        invoke("start_live_bridge"),
      ]);

      if (cancelled) {
        return;
      }

      if (snapshotResult.status === "fulfilled") {
        const nextSnapshot = mergeBootstrapSnapshot(
          snapshotResult.value,
          snapshotRef.current,
        );
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        setSelectedSessionId((current) => current ?? firstSessionId(nextSnapshot));
        setErrorMessage(null);
      } else {
        setErrorMessage(
          formatRuntimeError(
            "Failed to load workspace snapshot",
            snapshotResult.reason,
          ),
        );
      }

      if (bridgeResult.status === "rejected") {
        setDegradedMessage(
          formatRuntimeError("Live bridge unavailable", bridgeResult.reason),
        );
      }

      setLoading(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [handleLiveUpdate]);

  return (
    <>
      <LiquidGlassFilter />
      <SidebarProvider>
        <Sidebar className="border-r border-white/5 bg-[#0B0E14]/80 backdrop-blur-2xl">
          <SidebarHeader className="p-4 border-b border-white/5 bg-transparent">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-widest uppercase">
                Codex Monitor
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">Live Sessions</span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {snapshot ? snapshot.workspaces.length : 0} WS
                </Badge>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="bg-transparent/0">
            {loading && (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex flex-col gap-2">
                    <div className="h-4 bg-white/5 rounded w-1/3" />
                    <div className="h-16 bg-white/5 rounded-xl w-full" />
                  </div>
                ))}
              </div>
            )}
            
            {!loading && snapshot && snapshot.workspaces.length === 0 && (
              <div className="p-6 text-center text-slate-500">
                <HardDrive className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No Codex sessions discovered.</p>
              </div>
            )}

            {!loading && snapshot && snapshot.workspaces.map((workspace) => (
              <SidebarGroup key={workspace.workspace_path}>
                <SidebarGroupLabel className="text-xs font-mono text-slate-400 tracking-wider">
                  {formatWorkspaceLabel(workspace.workspace_path)}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="px-2 mt-1">
                    {workspace.sessions.map((session) => {
                      const isSelected = session.session_id === selectedSessionId;
                      return (
                        <SidebarMenuItem key={session.session_id} className="mb-1.5">
                          <SidebarMenuButton 
                            isActive={isSelected}
                            onClick={() => setSelectedSessionId(session.session_id)}
                            className={`h-auto flex flex-col items-start p-3 rounded-lg border transition-all duration-200 ${
                              isSelected 
                                ? "bg-emerald-500/10 border-emerald-500/20 shadow-[inset_2px_0_0_0_rgb(16,185,129)]" 
                                : "bg-white/5 border-transparent hover:bg-white/10"
                            }`}
                          >
                            <div className="flex w-full items-start justify-between mb-1">
                              <span className={`font-medium text-sm truncate pr-2 ${isSelected ? "text-emerald-100" : "text-slate-200"}`}>
                                {session.title ?? "Untitled session"}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 shrink-0 mt-0.5">
                                {new Date(session.last_event_at ?? "").toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
            ))}
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <main className="flex-1 min-h-screen flex flex-col bg-[#0B0E14] relative overflow-hidden">
          {/* Main App Background Pattern */}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.03) 0%, transparent 60%)' }} />

          {/* Header */}
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/5 bg-[#0B0E14]/80 px-4 backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-slate-400 hover:text-white" />
              <div className="h-4 w-px bg-white/10" />
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="h-full items-center">
                <TabsList className="h-9 bg-white/5">
                  <TabsTrigger value="live" className="text-xs">Live Shell</TabsTrigger>
                  <TabsTrigger value="archive" className="text-xs">Archive</TabsTrigger>
                  <TabsTrigger value="dashboard" className="text-xs">Metrics</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {snapshot?.refreshed_at ? formatTimestamp(snapshot.refreshed_at) : "Awaiting"}
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              
              {errorMessage && !snapshot && (
                <Alert variant="destructive" className="glass-surface bg-red-500/10 border-red-500/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Shell Fallback</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              
              {degradedMessage && (
                <Alert className="glass-surface bg-amber-500/10 border-amber-500/20 text-amber-200">
                  <AlertCircle className="h-4 w-4 stroke-amber-500" />
                  <AlertTitle className="text-amber-500">Live Updates Degraded</AlertTitle>
                  <AlertDescription>{degradedMessage}</AlertDescription>
                </Alert>
              )}

              {activeTab === "live" ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="glass-surface bg-white/5 border-white/10 overflow-hidden">
                      <CardHeader className="bg-white/5 border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-widest mb-1">
                          <Activity className="w-3.5 h-3.5" />
                          Selected Session
                        </div>
                        <CardTitle className="text-2xl font-normal text-slate-100">
                          {selectedSession ? (selectedSession.title ?? "Untitled session") : "No session selected"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 text-slate-400 p-6">
                        {selectedSession ? (
                          <>
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Status</p>
                                <p className="text-sm font-medium text-slate-200 capitalize">{selectedSession.status}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Last Event</p>
                                <p className="text-sm font-medium text-slate-200">{formatTimestamp(selectedSession.last_event_at)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Events</p>
                                <p className="text-sm font-medium text-slate-200">{selectedSession.event_count}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Source</p>
                                <p className="text-sm font-medium text-slate-200">{selectedSession.source_kind}</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm">Choose a session from the sidebar once discovery returns data.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="glass-surface bg-white/5 border-white/10 overflow-hidden">
                      <CardHeader className="bg-white/5 border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2 text-blue-400 font-mono text-xs font-semibold uppercase tracking-widest mb-1">
                          <Terminal className="w-3.5 h-3.5" />
                          Shell Status
                        </div>
                        <CardTitle className="text-2xl font-normal text-slate-100">
                          {loading ? "Scanning logs..." : "Live shell ready."}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 p-6">
                        <p className="text-sm text-slate-400 leading-relaxed">
                          Sidebar grouping and summary selection are active. Timeline detail,
                          archive filters, and dashboard metrics remain deferred to later
                          slices.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="glass-surface bg-transparent border-white/10 mt-6 relative overflow-hidden group">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Timeline Canvas</p>
                          <CardTitle className="text-xl">Renderer Placeholder</CardTitle>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] border-white/10">SLICE-5</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 bg-white/5 border border-white/10 rounded-xl p-6 liquid-glass-element relative mix-blend-screen transition-all">
                        {/* Fake Lanes */}
                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                          <span className="text-xs font-mono text-slate-400 text-right">User</span>
                          <div className="h-4 rounded-full bg-slate-800/50 shadow-inner relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-amber-500 to-amber-500/20 blur-[1px]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                          <span className="text-xs font-mono text-slate-400 text-right">Main</span>
                          <div className="h-4 rounded-full bg-slate-800/50 shadow-inner relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-emerald-500 to-emerald-500/20 blur-[1px]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                          <span className="text-xs font-mono text-slate-400 text-right">Sub-agent</span>
                          <div className="h-4 rounded-full bg-slate-800/50 shadow-inner relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-blue-500 to-blue-500/20 blur-[1px]" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="glass-surface bg-white/[0.02] border-white/10 border-dashed mt-6">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Detail Drawer</p>
                          <CardTitle className="text-xl text-slate-300">Summary-first boundary</CardTitle>
                        </div>
                        <Badge variant="secondary" className="font-mono text-[10px]">Deferred</Badge>
                      </div>
                      <CardDescription className="text-slate-500 mt-2">
                        Tabs for raw payloads, tokens, and metrics are intentionally stubbed here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {["Summary", "Input / Output", "Raw Event", "Tokens"].map(tab => (
                          <Badge key={tab} variant="outline" className="text-slate-400 border-white/10 hover:bg-white/5 cursor-pointer">
                            {tab}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <PlaceholderPanel tab={activeTab} />
              )}
            </div>
          </div>
        </main>
      </SidebarProvider>
    </>
  );
}

