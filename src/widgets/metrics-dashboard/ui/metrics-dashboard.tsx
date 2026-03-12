import { GlassSurface } from "@/app/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Users, Zap, AlertTriangle, TrendingUp } from "lucide-react";

export function MetricsDashboard() {
  return (
    <div className="flex flex-col h-full gap-6 overflow-auto">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
        <KPICard title="Active Live" value="3" icon={<Activity className="text-emerald-600 dark:text-emerald-400" />} trend="+1" />
        <KPICard title="Avg Duration" value="4m 12s" icon={<Clock className="text-blue-600 dark:text-blue-400" />} trend="-12s" />
        <KPICard title="Avg Spawn Depth" value="2.4" icon={<Users className="text-amber-600 dark:text-amber-400" />} trend="+0.2" />
        <KPICard title="Flagged Repeats" value="12" icon={<AlertTriangle className="text-red-600 dark:text-red-400" />} trend="-3" />
        <KPICard title="Total Tokens" value="1.2M" icon={<Zap className="text-purple-600 dark:text-purple-400" />} trend="+15%" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
        
        {/* Workload / Efficiency */}
        <GlassSurface refraction="none" variant="panel" className="flex flex-col">
          <Card className="border-0 bg-transparent flex-1 shadow-none ring-0">
            <CardHeader className="pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg text-foreground">Agent Utilization</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-center h-[300px]">
              <div className="text-muted-foreground font-mono text-sm border border-dashed border-border rounded-xl w-full h-full flex items-center justify-center bg-muted">
                [ Chart Placeholder: Bar Chart ]
              </div>
            </CardContent>
          </Card>
        </GlassSurface>

        {/* Latency / Performance */}
        <GlassSurface refraction="none" variant="panel" className="flex flex-col">
          <Card className="border-0 bg-transparent flex-1 shadow-none ring-0">
            <CardHeader className="pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg text-foreground">Tool Latency & Wait Ratio</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-center h-[300px]">
              <div className="text-muted-foreground font-mono text-sm border border-dashed border-border rounded-xl w-full h-full flex items-center justify-center bg-muted">
                [ Chart Placeholder: Line Trend ]
              </div>
            </CardContent>
          </Card>
        </GlassSurface>

      </div>
    </div>
  );
}

function KPICard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  const isPositive = trend.startsWith("+");
  return (
    <GlassSurface refraction="none" variant="panel">
      <Card className="border-0 bg-transparent shadow-none ring-0">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">{title}</span>
            <div className="p-1.5 bg-muted rounded-md border border-border">
              {icon}
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-sans font-semibold text-foreground">{value}</span>
            <span className={`text-[10px] font-mono ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              {trend}
            </span>
          </div>
        </CardContent>
      </Card>
    </GlassSurface>
  );
}
