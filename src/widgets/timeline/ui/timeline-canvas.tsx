import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatTimestamp, type SessionSummary } from "@/entities/session";
import { Activity, Clock3, Dot, Server, Sparkles, User } from "lucide-react";

interface TimelineCanvasProps {
  selectedSession: SessionSummary | null;
}

const TIMELINE_EVENTS = [
  {
    accent: "text-amber-100",
    actor: "User",
    lane: "user",
    label: "Refine shell chrome",
    meta: "prompt",
  },
  {
    accent: "text-emerald-100",
    actor: "Main",
    lane: "main",
    label: "Plan shared glass depth",
    meta: "2.1s",
  },
  {
    accent: "text-sky-100",
    actor: "Sub-agent",
    lane: "worker",
    label: "Inspect primitive boundaries",
    meta: "rg + review",
  },
  {
    accent: "text-cyan-100",
    actor: "Worker",
    lane: "worker",
    label: "Apply unified control language",
    meta: "apply_patch",
  },
];

export function TimelineCanvas({ selectedSession }: TimelineCanvasProps) {
  return (
    <GlassSurface
      refraction="none"
      variant="panel"
      className="flex h-full min-h-[520px] flex-col"
    >
      <Card className="flex flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="border-b border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">
                <Activity className="h-3.5 w-3.5" />
                Timeline canvas
              </div>
              <CardTitle className="text-[1.7rem] font-normal tracking-tight text-white">
                {selectedSession?.title ?? "No active session context"}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-200">
                  Live flow
                </div>
              </GlassSurface>
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-100">
                  <Clock3 className="h-3.5 w-3.5 text-sky-300" />
                  {selectedSession
                    ? formatTimestamp(selectedSession.last_event_at)
                    : "Awaiting selection"}
                </div>
              </GlassSurface>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(2,6,23,0.14),transparent_48%)] p-0">
          <div className="flex w-[126px] shrink-0 flex-col gap-6 px-4 py-6">
            {[
              { icon: User, label: "User", accent: "text-amber-300" },
              { icon: Server, label: "Main", accent: "text-emerald-300" },
              { icon: Server, label: "Sub-agent", accent: "text-sky-300" },
            ].map(({ icon: Icon, label, accent }) => (
              <GlassSurface
                key={label}
                className="rounded-[1.25rem]"
                refraction="none"
                variant="control"
              >
                <div className="flex h-12 items-center gap-2 px-3 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-300">
                  <Icon className={`h-3.5 w-3.5 ${accent}`} />
                  {label}
                </div>
              </GlassSurface>
            ))}
          </div>

          <ScrollArea className="flex-1 max-w-full">
            <div className="relative h-full min-h-[360px] min-w-[920px] px-6 py-6 pr-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 12% 16%, rgba(56, 189, 248, 0.08), transparent 26%), radial-gradient(circle at 78% 18%, rgba(16, 185, 129, 0.07), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 28%)",
                }}
              />

              <div className="relative z-10 space-y-8">
                <div className="grid grid-cols-[96px_1fr] gap-4">
                  <div className="pt-2 text-right text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    lanes
                  </div>
                  <div className="space-y-5">
                    {[
                      { accent: "bg-amber-400/60", label: "User" },
                      { accent: "bg-emerald-400/60", label: "Main" },
                      { accent: "bg-sky-400/60", label: "Sub-agent" },
                    ].map((lane) => (
                      <div key={lane.label} className="flex items-center gap-4">
                        <span className="w-24 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400">
                          {lane.label}
                        </span>
                        <div className="relative h-px flex-1 bg-white/[0.06]">
                          <div className={`absolute inset-y-0 left-0 w-[28%] rounded-full ${lane.accent}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pl-[116px]">
                  <div className="space-y-4">
                    {TIMELINE_EVENTS.map((event, index) => (
                      <div
                        key={event.label}
                        className={`relative ${index % 2 === 1 ? "ml-28" : index === 2 ? "ml-44" : ""}`}
                      >
                        {index > 0 ? (
                          <svg
                            className="pointer-events-none absolute -left-18 -top-6 h-10 w-24 opacity-35"
                            viewBox="0 0 96 40"
                          >
                            <path
                              d="M 4 0 C 4 26, 22 40, 62 40"
                              fill="none"
                              stroke={index % 2 === 0 ? "#7dd3fc" : "#86efac"}
                              strokeDasharray="4 4"
                              strokeWidth="1.6"
                            />
                          </svg>
                        ) : null}
                        <GlassSurface
                          className="inline-flex rounded-full"
                          interactive
                          refraction="soft"
                          variant="control"
                        >
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <span className={`text-xs font-medium ${event.accent}`}>
                              {event.label}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
                              <Dot className="h-3.5 w-3.5 text-slate-500" />
                              {event.actor}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-white/8 bg-white/[0.04] font-mono text-[10px] text-slate-300"
                            >
                              {event.meta}
                            </Badge>
                          </div>
                        </GlassSurface>
                      </div>
                    ))}
                  </div>
                </div>

                <GlassSurface className="rounded-[1.5rem]" refraction="none" variant="control">
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                        Current focus
                      </p>
                      <p className="mt-1 text-sm text-slate-100">
                        Floating diagnostics, shared backdrop, and zero hard shell
                        dividers.
                      </p>
                    </div>
                    <Sparkles className="h-4.5 w-4.5 shrink-0 text-sky-300" />
                  </div>
                </GlassSurface>
              </div>
            </div>
            <ScrollBar orientation="horizontal" className="h-2" />
          </ScrollArea>
        </CardContent>
      </Card>
    </GlassSurface>
  );
}
