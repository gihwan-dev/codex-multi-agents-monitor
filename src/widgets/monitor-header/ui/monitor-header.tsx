import { GlassSurface } from "@/app/ui";
import { Clock, Sparkles } from "lucide-react";

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
          className="inline-flex rounded-[1.75rem]"
          interactive
          refraction="none"
          variant="toolbar"
        >
          <div className="flex min-h-14 items-center gap-2 px-2 py-2">
            <SidebarTrigger className="size-10 rounded-[1.2rem] border-0 bg-white/[0.06] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-white/[0.12] hover:text-white [&_svg]:size-[1.05rem]" />
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as MonitorTab)}
              className="h-full items-center"
            >
              <TabsList className="h-10 gap-1 rounded-[1.2rem] border-0 bg-transparent p-0 shadow-none">
                <TabsTrigger
                  value="live"
                  className="rounded-[1rem] px-4 text-[11px] font-mono uppercase tracking-[0.22em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
                >
                  Live
                </TabsTrigger>
                <TabsTrigger
                  value="archive"
                  className="rounded-[1rem] px-4 text-[11px] font-mono uppercase tracking-[0.22em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
                >
                  Archive
                </TabsTrigger>
                <TabsTrigger
                  value="metrics"
                  className="rounded-[1rem] px-4 text-[11px] font-mono uppercase tracking-[0.22em] text-slate-300 data-[active]:border-white/10 data-[active]:bg-white/[0.14] data-[active]:text-white"
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
          <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            <span className="font-mono uppercase tracking-[0.22em] text-slate-400">
              Refreshed
            </span>
            <span className="flex items-center gap-1.5 font-mono text-slate-100">
              <Clock className="h-3.5 w-3.5 text-emerald-300" />
              {refreshedAt ? formatTimestamp(refreshedAt) : "Awaiting signal"}
            </span>
          </div>
        </GlassSurface>
      </div>
    </header>
  );
}
