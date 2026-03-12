import { GlassSurface } from "@/app/ui";
import { Clock } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimestamp } from "@/entities/session";
import type { MonitorTab } from "@/shared/model";

interface MonitorHeaderProps {
  activeTab: MonitorTab;
  onTabChange: (tab: MonitorTab) => void;
  refreshedAt: string | null;
}

export function MonitorHeader({
  activeTab,
  onTabChange,
  refreshedAt,
}: MonitorHeaderProps) {
  return (
    <GlassSurface
      className="sticky top-0 z-10 rounded-none border-b border-white/8"
      refraction="none"
      variant="chrome"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-slate-400 hover:text-white" />
          <div className="h-4 w-px bg-white/10" />
          <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as MonitorTab)}
            className="h-full items-center"
          >
            <TabsList className="h-9 border border-white/10 bg-white/8">
              <TabsTrigger value="live" className="text-xs">
                Live Shell
              </TabsTrigger>
              <TabsTrigger value="archive" className="text-xs">
                Archive
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="text-xs">
                Metrics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            {refreshedAt ? formatTimestamp(refreshedAt) : "Awaiting"}
          </span>
        </div>
      </header>
    </GlassSurface>
  );
}
