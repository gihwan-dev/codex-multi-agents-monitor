import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Activity, Clock, Server, User } from "lucide-react";

export function TimelineCanvas() {
  return (
    <GlassSurface refraction="none" variant="panel" className="h-[400px] flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="pb-2 flex-none shrink-0 border-b border-white/5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-xl">Timeline Canvas</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-[10px] bg-emerald-500/10">
                Live
              </Badge>
              <Badge variant="outline" className="border-white/10 font-mono text-[10px]">
                Level 2: Diagnostic
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative overflow-hidden flex">
          {/* Lane Labels */}
          <div className="w-[120px] shrink-0 border-r border-white/5 flex flex-col py-4 gap-6 bg-slate-900/30 z-10 font-mono text-xs text-slate-400">
            <div className="flex items-center gap-2 px-3 h-8">
              <User className="w-3.5 h-3.5" /> User
            </div>
            <div className="flex items-center gap-2 px-3 h-8">
              <Server className="w-3.5 h-3.5" /> Main
            </div>
            <div className="flex items-center gap-2 px-3 h-8">
              <Server className="w-3.5 h-3.5 text-blue-400" /> Sub-agent
            </div>
          </div>
          
          {/* Scrollable Tracks Area */}
          <ScrollArea className="flex-1 max-w-full">
            <div className="relative min-w-[800px] h-[200px] py-4 pr-10">
              {/* Background Ticks */}
              <div className="absolute inset-x-0 inset-y-0 opacity-10 flex">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex-1 border-l border-dashed border-white" />
                ))}
              </div>

              {/* Tracks */}
              <div className="flex flex-col gap-6 relative z-10">
                
                {/* User Track */}
                <div className="h-8 flex items-center px-4">
                  <div className="glass-surface__fx absolute -z-10 bg-amber-500/10 rounded-full h-8 w-[100px] blur-[2px]" style={{ left: '20px' }} />
                  <div className="h-6 flex items-center px-3 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)] whitespace-nowrap cursor-pointer hover:bg-amber-500/30 transition-colors" style={{ marginLeft: '20px', width: '100px' }}>
                    Trigger Event
                  </div>
                </div>

                {/* Main Track */}
                <div className="h-8 flex items-center px-4 relative">
                  <div className="glass-surface__fx absolute -z-10 bg-emerald-500/10 rounded-full h-8 w-[250px] blur-[2px]" style={{ left: '140px' }} />
                  <div className="h-6 flex items-center justify-between px-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)] whitespace-nowrap absolute cursor-pointer hover:bg-emerald-500/30 transition-colors" style={{ left: '155px', width: '250px' }}>
                    <span className="font-mono">Planning Phase</span>
                    <span className="opacity-50 flex items-center gap-1"><Clock className="w-3 h-3"/> 2.1s</span>
                  </div>
                </div>

                {/* Sub-agent Track */}
                <div className="h-8 flex items-center px-4 relative">
                  {/* Spawn connection line */}
                  <svg className="absolute w-[400px] h-10 -top-10 left-[250px] pointer-events-none opacity-30" style={{ zIndex: 0 }}>
                    <path d="M 0 0 C 0 30, 20 40, 50 40" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 2" />
                  </svg>
                  
                  <div className="glass-surface__fx absolute -z-10 bg-blue-500/10 rounded-full h-8 w-[180px] blur-[2px]" style={{ left: '290px' }} />
                  <div className="h-6 flex items-center justify-between px-3 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.15)] whitespace-nowrap absolute animate-pulse cursor-pointer hover:bg-blue-500/30 transition-colors" style={{ left: '300px', width: '180px' }}>
                    <span className="font-mono">Tool Call: rg</span>
                    <span className="opacity-50">running...</span>
                  </div>
                </div>

              </div>
            </div>
            <ScrollBar orientation="horizontal" className="h-2" />
          </ScrollArea>
        </CardContent>
      </Card>
    </GlassSurface>
  );
}
