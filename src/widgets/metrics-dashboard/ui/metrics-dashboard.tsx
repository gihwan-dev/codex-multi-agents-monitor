import { GlassSurface } from "@/app/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  BarChart3,
  Clock3,
  Gauge,
  Layers3,
  TriangleAlert,
} from "lucide-react";

const KPI_CARDS = [
  {
    accent: "text-slate-100",
    icon: Activity,
    label: "Active sessions",
    tone: "bg-white/[0.08]",
    trend: "1 live change",
    value: "3",
  },
  {
    accent: "text-sky-200",
    icon: Clock3,
    label: "Latency",
    tone: "bg-sky-300/14",
    trend: "p95 -12 ms",
    value: "680 ms",
  },
  {
    accent: "text-slate-200",
    icon: Layers3,
    label: "Spawn depth",
    tone: "bg-white/[0.07]",
    trend: "2.4 avg",
    value: "L2",
  },
  {
    accent: "text-slate-200",
    icon: TriangleAlert,
    label: "Alerts",
    tone: "bg-white/[0.07]",
    trend: "3 cleared",
    value: "12",
  },
];

const UTILIZATION_BARS = [
  { label: "Main", value: 88, tone: "from-slate-100/80 to-slate-400/18" },
  { label: "Worker", value: 64, tone: "from-sky-200/78 to-sky-400/16" },
  { label: "Review", value: 42, tone: "from-slate-300/70 to-slate-500/16" },
];

const LATENCY_POINTS = [
  38, 56, 44, 68, 62, 74, 58, 70,
];

const LATENCY_CHART_WIDTH = 360;
const LATENCY_CHART_HEIGHT = 176;
const LATENCY_CHART = buildLatencyChart(LATENCY_POINTS);

const PANEL_CARD_CLASS =
  "gap-0 border-0 bg-transparent shadow-none ring-0";

export function MetricsDashboard() {
  return (
    <div className="flex h-full flex-col gap-5 overflow-auto no-scrollbar">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((item) => (
          <GlassSurface key={item.label} refraction="none" variant="panel">
            <Card className={PANEL_CARD_CLASS}>
              <CardContent className="bg-transparent p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.01em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-3 text-[1.9rem] font-normal tracking-tight text-white">
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{item.trend}</p>
                  </div>
                  <GlassSurface className="rounded-[1.1rem]" refraction="none" variant="control">
                    <div className={`flex h-11 w-11 items-center justify-center ${item.tone}`}>
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
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                    Agent utilization
                  </p>
                  <CardTitle className="text-[1.55rem] font-normal tracking-tight text-white">
                    Agent utilization
                  </CardTitle>
                </div>
                <GlassSurface className="rounded-full" refraction="none" variant="control">
                  <div className="px-3 py-2 text-[11px] font-medium tracking-[0.01em] text-slate-200">
                    Live
                  </div>
                </GlassSurface>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5 bg-transparent p-6">
              {UTILIZATION_BARS.map((bar) => (
                <div key={bar.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-400">
                      {bar.label}
                    </span>
                    <span className="text-slate-200">{bar.value}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/[0.045]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.tone}`}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MetricBlock label="Avg wait ratio" value="14%" tone="text-slate-100" />
                <MetricBlock label="Longest tool span" value="2.1s" tone="text-sky-200" />
              </div>
            </CardContent>
          </Card>
        </GlassSurface>

        <GlassSurface refraction="none" variant="panel" className="flex flex-col">
          <Card className={`flex flex-1 flex-col ${PANEL_CARD_CLASS}`}>
            <CardHeader className="bg-transparent px-6 pb-4 pt-5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                <Gauge className="h-3.5 w-3.5 text-slate-400" />
                Latency
              </div>
              <CardTitle className="max-w-[24ch] text-[1.55rem] font-normal tracking-tight text-white">
                Latency
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5 bg-transparent p-6">
              <div className="rounded-[1.5rem] border border-white/6 bg-white/[0.03] px-4 pb-4 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">P95 latency</p>
                    <p className="mt-2 text-[1.7rem] font-normal tracking-tight text-white">
                      740 ms
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <p>Last 8 samples</p>
                    <p className="mt-1 text-slate-300">Stable</p>
                  </div>
                </div>
                <div className="mt-4 h-44 overflow-hidden rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-2 py-3">
                  <svg
                    aria-hidden="true"
                    className="h-full w-full"
                    viewBox={`0 0 ${LATENCY_CHART_WIDTH} ${LATENCY_CHART_HEIGHT}`}
                  >
                    <defs>
                      <linearGradient id="latencyArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(191,219,254,0.34)" />
                        <stop offset="100%" stopColor="rgba(191,219,254,0.02)" />
                      </linearGradient>
                    </defs>
                    <path
                      d={LATENCY_CHART.areaPath}
                      fill="url(#latencyArea)"
                    />
                    <polyline
                      fill="none"
                      points={LATENCY_CHART.linePoints}
                      stroke="rgba(219, 234, 254, 0.88)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                    />
                    {LATENCY_CHART.points.map((point) => (
                      <circle
                        key={point.x}
                        cx={point.x}
                        cy={point.y}
                        fill="rgba(7, 11, 20, 0.92)"
                        r="4"
                        stroke="rgba(219, 234, 254, 0.78)"
                        strokeWidth="1.5"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MetricBlock label="Frame budget" value="Stable" tone="text-slate-100" />
                <MetricBlock label="Variance" value="Low" tone="text-sky-200" />
              </div>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <GlassSurface className="rounded-[1.35rem]" refraction="none" variant="control">
      <div className="px-4 py-3.5">
        <p className="text-[11px] font-medium tracking-[0.01em] text-slate-500">
          {label}
        </p>
        <p className={`mt-2 text-lg ${tone}`}>{value}</p>
      </div>
    </GlassSurface>
  );
}

function buildLatencyChart(points: number[]) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const xStep = (LATENCY_CHART_WIDTH - 28) / Math.max(points.length - 1, 1);

  const normalizedPoints = points.map((point, index) => {
    const x = 14 + index * xStep;
    const y =
      LATENCY_CHART_HEIGHT -
      (24 + ((point - min) / range) * (LATENCY_CHART_HEIGHT - 52));

    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });

  const linePoints = normalizedPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const firstPoint = normalizedPoints[0];
  const lastPoint = normalizedPoints[normalizedPoints.length - 1];
  const areaPath =
    firstPoint && lastPoint
      ? `M ${firstPoint.x} ${LATENCY_CHART_HEIGHT} L ${normalizedPoints
          .map((point) => `${point.x} ${point.y}`)
          .join(" L ")} L ${lastPoint.x} ${LATENCY_CHART_HEIGHT} Z`
      : "";

  return {
    areaPath,
    linePoints,
    points: normalizedPoints,
  };
}
