import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DRAWER_TABS = ["Summary", "Input / Output", "Raw Event", "Tokens"];

export function DetailDrawerPlaceholder() {
  return (
    <Card className="glass-surface border border-dashed border-white/10 bg-white/[0.02]">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Detail Drawer
            </p>
            <CardTitle className="text-xl text-slate-300">
              Summary-first boundary
            </CardTitle>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            Deferred
          </Badge>
        </div>
        <CardDescription className="mt-2 text-slate-500">
          Tabs for raw payloads, tokens, and metrics are intentionally stubbed here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {DRAWER_TABS.map((tab) => (
            <Badge
              key={tab}
              variant="outline"
              className="cursor-pointer border-white/10 text-slate-400 hover:bg-white/5"
            >
              {tab}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
