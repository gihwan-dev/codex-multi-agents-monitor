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
      className="sticky top-0 z-20 rounded-none"
      refraction="none"
      variant="toolbar"
    >
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="rounded-full border border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white" />
          <div className="h-4 w-px bg-white/10" />
          <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as MonitorTab)}
            className="h-full items-center"
          >
            <TabsList className="h-10 rounded-full border border-white/14 bg-white/[0.06] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <TabsTrigger
                value="live"
                className="rounded-full px-3 text-xs text-slate-300 data-[active]:border-white/16 data-[active]:bg-white/[0.14] data-[active]:text-slate-50"
              >
                Live Shell
              </TabsTrigger>
              <TabsTrigger
                value="archive"
                className="rounded-full px-3 text-xs text-slate-300 data-[active]:border-white/16 data-[active]:bg-white/[0.14] data-[active]:text-slate-50"
              >
                Archive
              </TabsTrigger>
              <TabsTrigger
                value="metrics"
                className="rounded-full px-3 text-xs text-slate-300 data-[active]:border-white/16 data-[active]:bg-white/[0.14] data-[active]:text-slate-50"
              >
                Metrics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-mono text-slate-300/80">
            <Clock className="h-3.5 w-3.5" />
            {refreshedAt ? formatTimestamp(refreshedAt) : "Awaiting"}
          </span>
        </div>
      </header>
    </GlassSurface>
  );
}
