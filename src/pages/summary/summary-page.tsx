import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getSummaryDashboard } from "@/shared/lib/tauri/commands";

export function SummaryPage() {
  const summaryQuery = useQuery({
    queryKey: ["monitor", "summary_dashboard"],
    queryFn: () => getSummaryDashboard({}),
  });
  const kpis = useMemo(() => summaryQuery.data?.kpis ?? null, [summaryQuery.data]);

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Summary
        </p>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Filter-driven dashboard
          </h2>
          <p className="max-w-3xl text-sm text-[hsl(var(--muted))]">
            summary shell skeleton입니다. 다음 slice에서 filter bar와 visuals가
            이 페이지 semantics에 맞게 고정됩니다.
          </p>
        </div>
      </header>

      {summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))]"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="sessions" value={`${kpis?.session_count ?? 0}`} />
          <MetricCard label="active" value={`${kpis?.active_session_count ?? 0}`} />
          <MetricCard
            label="completed"
            value={`${kpis?.completed_session_count ?? 0}`}
          />
          <MetricCard
            label="avg duration"
            value={
              kpis?.average_duration_ms !== null && kpis?.average_duration_ms !== undefined
                ? `${Math.round(kpis.average_duration_ms / 1000)}s`
                : "-"
            }
          />
          <MetricCard
            label="workspaces"
            value={`${kpis?.workspace_count ?? 0}`}
          />
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
        {label}
      </p>
      <p className="mt-3 font-mono text-2xl">{value}</p>
    </article>
  );
}
