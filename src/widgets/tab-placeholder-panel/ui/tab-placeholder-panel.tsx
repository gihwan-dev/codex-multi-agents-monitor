import { GlassSurface } from "@/app/ui";
import { Archive } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TAB_COPY, type DeferredMonitorTab } from "@/shared/model";

export function TabPlaceholderPanel({ tab }: { tab: DeferredMonitorTab }) {
  const copy = TAB_COPY[tab];

  return (
    <div className="flex h-full items-center justify-center p-8">
      <GlassSurface className="w-full max-w-md" refraction="none" variant="panel">
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="border-b border-white/8 bg-white/[0.045] pb-4">
            <div className="mb-2 flex items-center space-x-2 text-sm font-mono font-medium text-emerald-300">
              <Archive className="h-4 w-4" />
              <span>{copy.eyebrow}</span>
            </div>
            <CardTitle className="text-xl text-slate-50">{copy.title}</CardTitle>
            <CardDescription className="text-base text-slate-300/80">
              {copy.body}
            </CardDescription>
          </CardHeader>
          <div className="px-4 py-5">
            <div className="rounded-2xl border border-white/6 bg-slate-950/20 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-sm leading-relaxed text-slate-300/80">
                This view remains intentionally deferred while the live monitor shell
                establishes the navigation, contrast, and glass hierarchy.
              </p>
            </div>
          </div>
        </Card>
      </GlassSurface>
    </div>
  );
}
