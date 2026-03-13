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

const HEADER_TAB_TRIGGER_CLASS =
  "rounded-[0.9rem] px-3.5 text-[12px] font-medium tracking-[-0.01em] text-slate-400/78 transition-[background-color,color,box-shadow] duration-200 hover:text-slate-200 data-[active]:border-white/9 data-[active]:bg-white/[0.11] data-[active]:text-white data-[active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] focus-visible:border-white/18 focus-visible:bg-white/[0.16] focus-visible:text-white focus-visible:ring-[3px] focus-visible:ring-sky-200/26 focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_28px_rgba(125,211,252,0.18)] focus-visible:outline-none";

export function MonitorHeader({
  activeTab,
  onTabChange,
  refreshedAt,
}: MonitorHeaderProps) {
  return (
    <header className="sticky top-0 z-20 px-4 pb-0 pt-3 md:px-5 lg:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <GlassSurface
          className="inline-flex rounded-[1.8rem]"
          interactive
          refraction="soft"
          variant="toolbar"
        >
          <div className="flex min-h-[3rem] items-center gap-1.5 px-1.5 py-1.5">
            <GlassSurface
              className="rounded-[1.05rem]"
              interactive
              refraction="soft"
              variant="control"
            >
              <SidebarTrigger className="size-9 rounded-[inherit] border-0 bg-transparent text-slate-100 hover:bg-transparent hover:text-white focus-visible:ring-0 [&_svg]:size-[0.95rem]" />
            </GlassSurface>
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as MonitorTab)}
              className="h-full items-center"
            >
              <TabsList className="h-9 gap-1 rounded-[1.05rem] border-0 bg-transparent p-0 shadow-none">
                <TabsTrigger
                  value="live"
                  className={HEADER_TAB_TRIGGER_CLASS}
                >
                  Live
                </TabsTrigger>
                <TabsTrigger
                  value="archive"
                  className={HEADER_TAB_TRIGGER_CLASS}
                >
                  Archive
                </TabsTrigger>
                <TabsTrigger
                  value="metrics"
                  className={HEADER_TAB_TRIGGER_CLASS}
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
          <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200">
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
