import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TimelinePlaceholder() {
  return (
    <Card className="glass-surface group relative overflow-hidden border-white/10 bg-transparent">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Timeline Canvas
            </p>
            <CardTitle className="text-xl">Renderer Placeholder</CardTitle>
          </div>
          <Badge variant="outline" className="border-white/10 font-mono text-[10px]">
            SLICE-5
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="liquid-glass-element relative grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6 mix-blend-screen transition-all">
          <div className="grid grid-cols-[80px_1fr] items-center gap-4">
            <span className="text-right text-xs font-mono text-slate-400">User</span>
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-800/50 shadow-inner">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-amber-500 to-amber-500/20 blur-[1px]" />
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-4">
            <span className="text-right text-xs font-mono text-slate-400">Main</span>
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-800/50 shadow-inner">
              <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-emerald-500 to-emerald-500/20 blur-[1px]" />
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-4">
            <span className="text-right text-xs font-mono text-slate-400">Sub-agent</span>
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-800/50 shadow-inner">
              <div className="absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-blue-500 to-blue-500/20 blur-[1px]" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
