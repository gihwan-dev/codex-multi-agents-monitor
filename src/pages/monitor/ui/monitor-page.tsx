import { useState } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useWorkspaceSessionsQuery } from "@/features/live-session-feed";
import { useSessionSelection } from "@/features/session-selection";
import { type MonitorTab } from "@/shared/model";
import { DetailDrawer } from "@/widgets/detail-drawer";
import { LiveSessionOverview } from "@/widgets/live-session-overview";
import { MonitorHeader } from "@/widgets/monitor-header";
import { ArchiveMonitor } from "@/widgets/archive-monitor";
import { MetricsDashboard } from "@/widgets/metrics-dashboard";
import { TimelineCanvas } from "@/widgets/timeline";
import { WorkspaceSidebar } from "@/widgets/workspace-sidebar";

interface MonitorPageProps {
  degradedMessage: string | null;
}

export function MonitorPage({ degradedMessage }: MonitorPageProps) {
  const [activeTab, setActiveTab] = useState<MonitorTab>("live");
  const { errorMessage, loading, snapshot } = useWorkspaceSessionsQuery();
  const { selectSession, selectedSession, selectedSessionId } =
    useSessionSelection(snapshot);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04060D] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#04060D_0%,#09101A_46%,#101827_100%)]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 14%, rgba(56, 189, 248, 0.18) 0%, transparent 26%), radial-gradient(circle at 82% 10%, rgba(34, 197, 94, 0.14) 0%, transparent 22%), radial-gradient(circle at 50% 100%, rgba(245, 158, 11, 0.1) 0%, transparent 32%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, transparent 40%), radial-gradient(circle at center, transparent 0%, rgba(4, 6, 13, 0.34) 70%, rgba(4, 6, 13, 0.82) 100%), linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 80px 80px, 80px 80px",
        }}
      />

      <SidebarProvider className="relative z-10">
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

          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4">
              {activeTab === "live" ? (
                <>
                  <LiveSessionOverview
                    degradedMessage={degradedMessage}
                    errorMessage={errorMessage}
                    loading={loading}
                    selectedSession={selectedSession}
                    snapshot={snapshot}
                  />
                  <div className="flex flex-1 min-h-[520px] flex-col gap-4 xl:flex-row">
                    <div className="min-w-0 flex-[2]">
                      <TimelineCanvas />
                    </div>
                    <div className="min-w-0 xl:min-w-[340px] xl:max-w-[520px] xl:flex-1">
                      <DetailDrawer />
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
