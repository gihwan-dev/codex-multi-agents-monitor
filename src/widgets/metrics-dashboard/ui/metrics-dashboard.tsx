import { GlassSurface } from "@/app/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  BarChart3,
  Clock3,
  Gauge,
  Layers3,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

const KPI_CARDS = [
  {
    accent: "text-emerald-200",
    icon: Activity,
    label: "Active live",
    tone: "bg-emerald-400/18",
    trend: "+1 session",
    value: "03",
  },
  {
    accent: "text-sky-200",
    icon: Clock3,
    label: "Median latency",
    tone: "bg-sky-400/18",
    trend: "-12ms",
    value: "680ms",
  },
  {
    accent: "text-amber-200",
    icon: Layers3,
    label: "Spawn depth",
    tone: "bg-amber-400/18",
    trend: "2.4 avg",
    value: "L2",
  },
  {
    accent: "text-rose-200",
    icon: TriangleAlert,
    label: "Flagged loops",
    tone: "bg-rose-400/18",
    trend: "-3 today",
    value: "12",
  },
];

const UTILIZATION_BARS = [
  { label: "Main", value: 88, tone: "from-emerald-300/95 to-emerald-400/30" },
  { label: "Worker", value: 64, tone: "from-sky-300/95 to-sky-400/30" },
  { label: "Review", value: 42, tone: "from-cyan-300/95 to-cyan-400/30" },
];

const LATENCY_POINTS = [
  38, 56, 44, 68, 62, 74, 58, 70,
];

const PANEL_CARD_CLASS =
  "gap-0 border-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.078),rgba(255,255,255,0.03)_18%,rgba(12,21,37,0.16)_44%,rgba(2,6,23,0.14)_100%)] shadow-none ring-0";

export function MetricsDashboard() {
  return (
    <div className="flex h-full flex-col gap-5 overflow-auto">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {KPI_CARDS.map((item) => (
          <GlassSurface key={item.label} refraction="none" variant="panel">
            <Card className={PANEL_CARD_CLASS}>
              <CardContent className="bg-transparent p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-3 text-[1.9rem] font-normal tracking-tight text-white">
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{item.trend}</p>
                  </div>
                  <GlassSurface className="rounded-[1.1rem]" refraction="none" variant="control">
                    <div className={`flex h-12 w-12 items-center justify-center ${item.tone}`}>
                      <item.icon className={`h-4.5 w-4.5 ${item.accent}`} />
                    </div>
                  </GlassSurface>
                </div>
              </CardContent>
            </Card>
          </GlassSurface>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <GlassSurface refraction="none" variant="panel" className="flex flex-col">
          <Card className={`flex flex-1 flex-col ${PANEL_CARD_CLASS}`}>
            <CardHeader className="bg-transparent px-6 pb-4 pt-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="max-w-[34rem]">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-sky-300">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Agent utilization
                  </p>
                  <CardTitle className="text-[1.55rem] font-normal tracking-tight text-white">
                    Workload stays visible without leaving the shell
                  </CardTitle>
                </div>
                <GlassSurface className="rounded-full" refraction="none" variant="control">
                  <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-100">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                    Live metrics
                  </div>
                </GlassSurface>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5 bg-transparent p-6">
              {UTILIZATION_BARS.map((bar) => (
                <div key={bar.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono uppercase tracking-[0.18em] text-slate-400">
                      {bar.label}
                    </span>
                    <span className="font-mono text-slate-200">{bar.value}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/[0.05]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.tone}`}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MetricBlock label="Avg wait ratio" value="14%" accent="text-amber-200" />
                <MetricBlock label="Longest tool span" value="2.1s" accent="text-sky-200" />
              </div>
            </CardContent>
          </Card>
        </GlassSurface>

        <GlassSurface refraction="none" variant="panel" className="flex flex-col">
          <Card className={`flex flex-1 flex-col ${PANEL_CARD_CLASS}`}>
            <CardHeader className="bg-transparent px-6 pb-4 pt-5">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-amber-200">
                <Gauge className="h-3.5 w-3.5" />
                Latency and pacing
              </div>
              <CardTitle className="max-w-[24ch] text-[1.55rem] font-normal tracking-tight text-white">
                Glass-heavy UI, but motion and density stay controlled
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5 bg-transparent p-6">
              <div className="flex h-48 items-end gap-2 rounded-[1.5rem] border border-white/7 bg-white/[0.04] px-4 pb-4 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                {LATENCY_POINTS.map((point, index) => (
                  <div
                    key={index}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-sky-500/32 via-sky-300/82 to-white/95 shadow-[0_0_24px_rgba(56,189,248,0.14)]"
                      style={{ height: `${Math.max(point, 18)}%` }}
                    />
                    <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-500">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MetricBlock label="Frame budget" value="Stable" accent="text-emerald-200" />
                <MetricBlock label="Blur pressure" value="Moderate" accent="text-sky-200" />
              </div>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}

function MetricBlock({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <GlassSurface className="rounded-[1.35rem]" refraction="none" variant="control">
      <div className="px-4 py-3.5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <p className={`mt-2 text-lg ${accent}`}>{value}</p>
      </div>
    </GlassSurface>
  );
}
