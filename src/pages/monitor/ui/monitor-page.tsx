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

      <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
        <div className="pointer-events-none absolute inset-0 opacity-[0.6] dark:opacity-[0.4] mix-blend-plus-lighter dark:mix-blend-color-dodge" 
             style={{ backgroundImage: 'radial-gradient(circle at 100% 0, var(--color-primary) 0, transparent 40%), radial-gradient(circle at 0 100%, var(--color-emerald-500) 0, transparent 40%)' }} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:32px_32px] mask-[radial-gradient(ellipse_80%_80%_at_50%_0%,#000_80%,transparent_100%)] opacity-30 dark:opacity-20" />

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
