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
          <CardHeader>
            <div className="mb-2 flex items-center space-x-2 text-sm font-mono font-medium text-emerald-400">
              <Archive className="h-4 w-4" />
              <span>{copy.eyebrow}</span>
            </div>
            <CardTitle className="text-xl">{copy.title}</CardTitle>
            <CardDescription className="text-base text-slate-400">
              {copy.body}
            </CardDescription>
          </CardHeader>
        </Card>
      </GlassSurface>
    </div>
  );
}
