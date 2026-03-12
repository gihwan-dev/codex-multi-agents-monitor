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
    <div className="sticky top-0 z-20 flex p-4 md:p-6 items-start justify-between pointer-events-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pointer-events-auto">
        <GlassSurface className="h-10 w-10 flex items-center justify-center rounded-2xl shadow-sm border border-border" variant="chrome" refraction="none">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        </GlassSurface>

        <GlassSurface
          className="rounded-2xl flex items-center p-1 shadow-sm border border-border"
          variant="chrome"
          refraction="none"
        >
          <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as MonitorTab)}
            className="h-full items-center"
          >
            <TabsList className="h-8 bg-transparent">
              <TabsTrigger value="live" className="text-xs rounded-lg data-[state=active]:bg-white/60 dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">
                Live Shell
              </TabsTrigger>
              <TabsTrigger value="archive" className="text-xs rounded-lg data-[state=active]:bg-white/60 dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">
                Archive
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs rounded-lg data-[state=active]:bg-white/60 dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">
                Metrics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </GlassSurface>
      </div>

      <div className="pointer-events-auto hidden sm:block">
        <GlassSurface className="h-10 px-4 flex items-center gap-2 rounded-2xl shadow-sm border border-border" variant="chrome" refraction="none">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">
            {refreshedAt ? formatTimestamp(refreshedAt) : "Awaiting"}
          </span>
        </GlassSurface>
      </div>
    </div>
  );
}
