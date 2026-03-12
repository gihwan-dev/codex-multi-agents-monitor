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
    <SidebarProvider>
      <WorkspaceSidebar
        loading={loading}
        onSelectSession={selectSession}
        selectedSessionId={selectedSessionId}
        snapshot={snapshot}
      />

      <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#05070D]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#05070D_0%,#0B0E14_44%,#111827_100%)]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 16% 18%, rgba(37, 99, 235, 0.18) 0%, transparent 32%), radial-gradient(circle at 82% 14%, rgba(16, 185, 129, 0.14) 0%, transparent 28%), radial-gradient(circle at 50% 100%, rgba(245, 158, 11, 0.1) 0%, transparent 36%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, transparent 40%), radial-gradient(circle at center, transparent 0%, rgba(5, 7, 13, 0.38) 68%, rgba(5, 7, 13, 0.76) 100%)",
          }}
        />

        <MonitorHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          refreshedAt={snapshot?.refreshed_at ?? null}
        />

        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 flex flex-col">
          <div className="mx-auto w-full max-w-[1600px] flex-1 flex flex-col space-y-4 h-[calc(100vh-8rem)]">
            {activeTab === "live" && (
              <>
                <LiveSessionOverview
                  degradedMessage={degradedMessage}
                  errorMessage={errorMessage}
                  loading={loading}
                  selectedSession={selectedSession}
                  snapshot={snapshot}
                />
                <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
                  {/* Timeline takes up remaining space */}
                  <div className="flex-[2] min-w-0 flex flex-col">
                    <TimelineCanvas />
                  </div>
                  {/* Detail drawer sits on the right as a split pane */}
                  <div className="flex-1 min-w-[320px] max-w-[500px] flex flex-col">
                    <DetailDrawer />
                  </div>
                </div>
              </>
            )}
            {activeTab === "archive" && (
              <ArchiveMonitor />
            )}
            {activeTab === "metrics" && (
              <MetricsDashboard />
            )}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
