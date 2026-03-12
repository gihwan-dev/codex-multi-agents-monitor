import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Activity, Clock, Server, User } from "lucide-react";

export function TimelineCanvas() {
  return (
    <GlassSurface refraction="none" variant="panel" className="flex h-full min-h-[460px] flex-col">
      <Card className="flex flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="flex-none shrink-0 border-b border-white/8 bg-white/[0.045] pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-xl text-slate-50">Timeline Canvas</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/25 bg-emerald-500/10 font-mono text-[10px] text-emerald-300"
              >
                Live
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] font-mono text-[10px] text-slate-200"
              >
                Level 2: Diagnostic
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative flex flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(2,6,23,0.08),transparent_42%)] p-0">
          <div className="flex w-[120px] shrink-0 flex-col gap-6 border-r border-white/8 bg-white/[0.04] py-5 font-mono text-xs text-slate-400">
            <div className="flex h-8 items-center gap-2 px-3">
              <User className="h-3.5 w-3.5" /> User
            </div>
            <div className="flex h-8 items-center gap-2 px-3">
              <Server className="h-3.5 w-3.5" /> Main
            </div>
            <div className="flex h-8 items-center gap-2 px-3">
              <Server className="h-3.5 w-3.5 text-blue-400" /> Sub-agent
            </div>
          </div>

          <ScrollArea className="flex-1 max-w-full">
            <div className="relative h-full min-h-[340px] min-w-[920px] px-6 py-6 pr-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-65"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px), radial-gradient(circle at 18% 12%, rgba(59, 130, 246, 0.12), transparent 24%), radial-gradient(circle at 80% 22%, rgba(16, 185, 129, 0.1), transparent 28%)",
                  backgroundSize: "88px 100%, 100% 72px, auto, auto",
                }}
              />

              <div className="relative z-10 space-y-6">
                {[
                  { icon: User, label: "User" },
                  { icon: Server, label: "Main" },
                  { icon: Server, label: "Sub-agent", accent: "text-blue-400" },
                ].map(({ icon: Icon, label, accent }) => (
                  <div key={label} className="grid grid-cols-[80px_1fr] items-center gap-4">
                    <span className="text-right text-xs font-mono text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${accent ?? ""}`} />
                        {label}
                      </span>
                    </span>
                    <div className="relative h-3.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${
                          label === "User"
                            ? "w-[28%] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500/20"
                            : label === "Main"
                              ? "w-[54%] bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500/20"
                              : "w-[42%] bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500/20"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative space-y-3 pl-[96px] pt-5">
                <GlassSurface
                  className="inline-flex rounded-full"
                  interactive
                  refraction="soft"
                  variant="panel"
                >
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-mono text-amber-100">Trigger Event</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-200/70">
                      user
                    </span>
                  </div>
                </GlassSurface>

                <GlassSurface
                  className="ml-32 inline-flex rounded-full"
                  interactive
                  refraction="soft"
                  variant="panel"
                >
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-mono text-emerald-100">
                      Planning Phase
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-200/70">
                      <Clock className="h-3 w-3" /> 2.1s
                    </span>
                  </div>
                </GlassSurface>

                <div className="relative ml-56 pt-4">
                  <svg
                    className="pointer-events-none absolute -top-8 -left-16 h-10 w-32 opacity-35"
                    viewBox="0 0 128 40"
                  >
                    <path
                      d="M 0 0 C 0 26, 20 40, 64 40"
                      fill="none"
                      stroke="#60a5fa"
                      strokeDasharray="4 3"
                      strokeWidth="2"
                    />
                  </svg>
                  <GlassSurface
                    className="inline-flex rounded-full"
                    interactive
                    refraction="soft"
                    variant="panel"
                  >
                    <div className="flex items-center gap-3 px-4 py-2">
                      <span className="text-xs font-mono text-sky-100">Tool Call: rg</span>
                      <span className="text-[10px] font-mono text-sky-200/70">
                        running...
                      </span>
                    </div>
                  </GlassSurface>
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
