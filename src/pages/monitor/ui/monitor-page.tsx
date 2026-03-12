import { useState } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useWorkspaceSessionsQuery } from "@/features/live-session-feed";
import { useSessionSelection } from "@/features/session-selection";
import type { SessionDetailSnapshot, WorkspaceSessionsSnapshot } from "@/shared/queries";
import { type MonitorTab } from "@/shared/model";
import { DetailDrawer } from "@/widgets/detail-drawer";
import { LiveSessionOverview } from "@/widgets/live-session-overview";
import { MonitorHeader } from "@/widgets/monitor-header";
import { ArchiveMonitor } from "@/widgets/archive-monitor";
import { MetricsDashboard } from "@/widgets/metrics-dashboard";
import { TimelineCanvas } from "@/widgets/timeline";
import { WorkspaceSidebar } from "@/widgets/workspace-sidebar";
import type { MonitorUiQaState } from "../lib/ui-qa-fixtures";

interface MonitorPageProps {
  degradedMessage: string | null;
}

interface MonitorPageShellProps {
  degradedMessage: string | null;
  detailBySessionId?: Record<string, SessionDetailSnapshot>;
  errorMessage: string | null;
  initialActiveTab?: MonitorTab;
  initialSidebarOpen?: boolean;
  loading: boolean;
  preferredSessionId?: string | null;
  snapshot: WorkspaceSessionsSnapshot | null;
  uiQaMode?: boolean;
}

export function MonitorPage({ degradedMessage }: MonitorPageProps) {
  const { errorMessage, loading, snapshot } = useWorkspaceSessionsQuery();

  return (
    <MonitorPageShell
      degradedMessage={degradedMessage}
      errorMessage={errorMessage}
      loading={loading}
      snapshot={snapshot}
    />
  );
}

export function DemoMonitorPage({ uiQaState }: { uiQaState: MonitorUiQaState }) {
  return (
    <MonitorPageShell
      degradedMessage={null}
      detailBySessionId={uiQaState.detailBySessionId}
      errorMessage={null}
      initialActiveTab={uiQaState.activeTab}
      initialSidebarOpen={uiQaState.sidebarOpen}
      loading={false}
      preferredSessionId={uiQaState.selectedSessionId}
      snapshot={uiQaState.snapshot}
      uiQaMode
    />
  );
}

export function MonitorPageShell({
  degradedMessage,
  detailBySessionId,
  errorMessage,
  initialActiveTab = "live",
  initialSidebarOpen = true,
  loading,
  preferredSessionId = null,
  snapshot,
  uiQaMode = false,
}: MonitorPageShellProps) {
  const [activeTab, setActiveTab] = useState<MonitorTab>(initialActiveTab);
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const { selectSession, selectedSession, selectedSessionId } =
    useSessionSelection(snapshot, preferredSessionId);
  const activeDetail =
    detailBySessionId && selectedSessionId
      ? detailBySessionId[selectedSessionId] ?? null
      : null;

  return (
    <div
      className="dark relative min-h-screen overflow-hidden bg-[#04060D] text-slate-100"
      data-monitor-shell=""
      data-ui-qa-mode={uiQaMode ? "true" : "false"}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(4, 6, 13, 0.78) 0%, rgba(7, 11, 20, 0.84) 48%, rgba(9, 13, 24, 0.96) 100%), radial-gradient(circle at 14% 14%, rgba(56, 189, 248, 0.16) 0%, transparent 26%), radial-gradient(circle at 78% 12%, rgba(16, 185, 129, 0.12) 0%, transparent 24%), radial-gradient(circle at 50% 100%, rgba(245, 158, 11, 0.08) 0%, transparent 34%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, transparent 0%, rgba(4, 6, 13, 0.26) 68%, rgba(4, 6, 13, 0.8) 100%), linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px)",
          backgroundSize: "auto, 96px 96px, 96px 96px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)] opacity-35" />

      <SidebarProvider
        className="relative z-10"
        open={uiQaMode ? sidebarOpen : undefined}
        onOpenChange={uiQaMode ? setSidebarOpen : undefined}
      >
        <WorkspaceSidebar
          loading={loading}
          onSelectSession={selectSession}
          selectedSessionId={selectedSessionId}
          snapshot={snapshot}
        />

        <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-transparent">
          <MonitorHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            refreshedAt={snapshot?.refreshed_at ?? null}
          />

          <div className="flex-1 overflow-auto px-4 pb-8 pt-3 md:px-6 lg:px-8">
            <div className="flex min-h-full w-full flex-col gap-5">
              {activeTab === "live" ? (
                <>
                  <LiveSessionOverview
                    degradedMessage={degradedMessage}
                    errorMessage={errorMessage}
                    loading={loading}
                    selectedSession={selectedSession}
                    snapshot={snapshot}
                  />
                  <div className="flex min-h-[560px] flex-1 flex-col gap-5 xl:flex-row">
                    <div className="min-w-0 flex-[2]">
                      <TimelineCanvas selectedSession={selectedSession} />
                    </div>
                    <div className="min-w-0 xl:min-w-[340px] xl:max-w-[520px] xl:flex-1">
                      <DetailDrawer
                        detail={activeDetail}
                        disableLiveQuery={uiQaMode}
                        selectedSession={selectedSession}
                      />
                    </div>
                  </div>
                </>
              ) : activeTab === "archive" ? (
                <ArchiveMonitor />
              ) : (
                <MetricsDashboard />
              )}
            </div>
          </div>
        </main>
      </SidebarProvider>
    </div>
  );
}
