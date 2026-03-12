import { useState } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useLiveSessionFeed } from "@/features/live-session-feed";
import { useSessionSelection } from "@/features/session-selection";
import { type MonitorTab } from "@/shared/model";
import { DetailDrawerPlaceholder } from "@/widgets/detail-drawer-placeholder";
import { LiveSessionOverview } from "@/widgets/live-session-overview";
import { MonitorHeader } from "@/widgets/monitor-header";
import { TabPlaceholderPanel } from "@/widgets/tab-placeholder-panel";
import { TimelinePlaceholder } from "@/widgets/timeline-placeholder";
import { WorkspaceSidebar } from "@/widgets/workspace-sidebar";

export function MonitorPage() {
  const [activeTab, setActiveTab] = useState<MonitorTab>("live");
  const { degradedMessage, errorMessage, loading, snapshot } = useLiveSessionFeed();
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

      <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#0B0E14]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(16, 185, 129, 0.03) 0%, transparent 60%)",
          }}
        />

        <MonitorHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          refreshedAt={snapshot?.refreshed_at ?? null}
        />

        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {activeTab === "live" ? (
              <>
                <LiveSessionOverview
                  degradedMessage={degradedMessage}
                  errorMessage={errorMessage}
                  loading={loading}
                  selectedSession={selectedSession}
                  snapshot={snapshot}
                />
                <TimelinePlaceholder />
                <DetailDrawerPlaceholder />
              </>
            ) : (
              <TabPlaceholderPanel tab={activeTab} />
            )}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
