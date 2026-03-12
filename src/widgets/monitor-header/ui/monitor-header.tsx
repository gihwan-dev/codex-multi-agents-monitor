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
    <header className="sticky top-0 z-20 px-4 pb-1 pt-4 md:px-6 lg:px-8">
      <div className="flex w-full items-center justify-between gap-4">
        <GlassSurface
          className="inline-flex rounded-[1.8rem]"
          interactive
          refraction="soft"
          variant="toolbar"
        >
          <div className="flex min-h-[3.25rem] items-center gap-2 px-2 py-2">
            <GlassSurface
              className="rounded-[1.15rem]"
              interactive
              refraction="soft"
              variant="control"
            >
              <SidebarTrigger className="size-10 rounded-[inherit] border-0 bg-transparent text-slate-100 hover:bg-transparent hover:text-white focus-visible:ring-0 [&_svg]:size-[1rem]" />
            </GlassSurface>
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as MonitorTab)}
              className="h-full items-center"
            >
              <TabsList className="h-10 gap-1 rounded-[1.15rem] border-0 bg-transparent p-0 shadow-none">
                <TabsTrigger
                  value="live"
                  className="rounded-[0.95rem] px-4 text-[12.5px] font-medium tracking-[-0.01em] text-slate-400/78 data-[active]:border-white/9 data-[active]:bg-white/[0.11] data-[active]:text-white data-[active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  Live
                </TabsTrigger>
                <TabsTrigger
                  value="archive"
                  className="rounded-[0.95rem] px-4 text-[12.5px] font-medium tracking-[-0.01em] text-slate-400/78 data-[active]:border-white/9 data-[active]:bg-white/[0.11] data-[active]:text-white data-[active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  Archive
                </TabsTrigger>
                <TabsTrigger
                  value="metrics"
                  className="rounded-[0.95rem] px-4 text-[12.5px] font-medium tracking-[-0.01em] text-slate-400/78 data-[active]:border-white/9 data-[active]:bg-white/[0.11] data-[active]:text-white data-[active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  Metrics
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </GlassSurface>

        <GlassSurface
          className="rounded-full"
          interactive
          refraction="soft"
          variant="control"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-200">
            <span className="flex items-center gap-1.5 text-[12px] text-slate-200/86">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {refreshedAt ? formatTimestamp(refreshedAt) : "Awaiting signal"}
            </span>
          </div>
        </GlassSurface>
      </div>
    </header>
  );
}
